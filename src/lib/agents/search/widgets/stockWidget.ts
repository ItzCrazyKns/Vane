import z from 'zod';
import { Widget } from '../types';
import formatChatHistoryAsString from '@/lib/utils/formatHistory';

const schema = z.object({
  name: z
    .string()
    .describe(
      "The stock name for example Nvidia, Google, Apple, Microsoft etc. You can also return ticker if you're aware of it otherwise just use the name.",
    ),
  comparisonNames: z
    .array(z.string())
    .max(3)
    .describe(
      "Optional array of up to 3 stock names to compare against the base name (e.g., ['Microsoft', 'GOOGL', 'Meta']). Charts will show percentage change comparison.",
    ),
  notPresent: z
    .boolean()
    .describe('Whether there is no need for the stock widget.'),
});

const systemPrompt = `
<role>
You are a stock ticker/name extractor. You will receive a user follow up and a conversation history.
Your task is to determine if the user is asking about stock information and extract the stock name(s) they want data for.
</role>

<instructions>
- If the user is asking about a stock, extract the primary stock name or ticker.
- If the user wants to compare stocks, extract up to 3 comparison stock names in comparisonNames.
- You can use either stock names (e.g., "Nvidia", "Apple") or tickers (e.g., "NVDA", "AAPL").
- If you cannot determine a valid stock or the query is not stock-related, set notPresent to true.
- If no comparison is needed, set comparisonNames to an empty array.
</instructions>

<output_format>
You must respond in the following JSON format without any extra text, explanations or filler sentences:
{
  "name": string,
  "comparisonNames": string[],
  "notPresent": boolean
}
</output_format>
`;

const stockWidget: Widget = {
  type: 'stockWidget',
  shouldExecute: (classification) =>
    classification.classification.showStockWidget,
  execute: async (input) => {
    const output = await input.llm.generateObject<typeof schema>({
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: `<conversation_history>\n${formatChatHistoryAsString(input.chatHistory)}\n</conversation_history>\n<user_follow_up>\n${input.followUp}\n</user_follow_up>`,
        },
      ],
      schema,
    });

    if (output.notPresent) {
      return;
    }

    const params = output;
    try {
      const nodeMajorVersion = Number.parseInt(
        process.versions.node.split('.')[0] || '0',
        10,
      );

      if (
        nodeMajorVersion < 22 ||
        typeof (process as NodeJS.Process & { getBuiltinModule?: unknown })
          .getBuiltinModule !== 'function'
      ) {
        throw new Error(
          `Stock widget requires Node 22+ in this build. Current runtime: ${process.versions.node}.`,
        );
      }

      const { default: YahooFinance } = await import('yahoo-finance2');
      const yf = new YahooFinance({
        suppressNotices: ['yahooSurvey'],
      });

      const name = params.name;

      const findings = await yf.search(name);

      if (findings.quotes.length === 0)
        throw new Error(`Failed to find quote for name/symbol: ${name}`);

      const ticker = findings.quotes[0].symbol as string;

      const quote: any = await yf.quote(ticker);

      const chartPromises = {
        '1D': yf
          .chart(ticker, {
            period1: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            period2: new Date(),
            interval: '5m',
          })
          .catch(() => null),
        '5D': yf
          .chart(ticker, {
            period1: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
            period2: new Date(),
            interval: '15m',
          })
          .catch(() => null),
        '1M': yf
          .chart(ticker, {
            period1: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            interval: '1d',
          })
          .catch(() => null),
        '3M': yf
          .chart(ticker, {
            period1: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
            interval: '1d',
          })
          .catch(() => null),
        '6M': yf
          .chart(ticker, {
            period1: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
            interval: '1d',
          })
          .catch(() => null),
        '1Y': yf
          .chart(ticker, {
            period1: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
            interval: '1d',
          })
          .catch(() => null),
        MAX: yf
          .chart(ticker, {
            period1: new Date(Date.now() - 10 * 365 * 24 * 60 * 60 * 1000),
            interval: '1wk',
          })
          .catch(() => null),
      };

      const charts = await Promise.all([
        chartPromises['1D'],
        chartPromises['5D'],
        chartPromises['1M'],
        chartPromises['3M'],
        chartPromises['6M'],
        chartPromises['1Y'],
        chartPromises['MAX'],
      ]);

      const [chart1D, chart5D, chart1M, chart3M, chart6M, chart1Y, chartMAX] =
        charts;

      if (!quote) {
        throw new Error(`No data found for ticker: ${ticker}`);
      }

      let comparisonData: any = null;
      if (params.comparisonNames.length > 0) {
        const comparisonPromises = params.comparisonNames
          .slice(0, 3)
          .map(async (compName) => {
            try {
              const compFindings = await yf.search(compName);

              if (compFindings.quotes.length === 0) return null;

              const compTicker = compFindings.quotes[0].symbol as string;
              const compQuote = await yf.quote(compTicker);
              const compCharts = await Promise.all([
                yf
                  .chart(compTicker, {
                    period1: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
                    period2: new Date(),
                    interval: '5m',
                  })
                  .catch(() => null),
                yf
                  .chart(compTicker, {
                    period1: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
                    period2: new Date(),
                    interval: '15m',
                  })
                  .catch(() => null),
                yf
                  .chart(compTicker, {
                    period1: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                    interval: '1d',
                  })
                  .catch(() => null),
                yf
                  .chart(compTicker, {
                    period1: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
                    interval: '1d',
                  })
                  .catch(() => null),
                yf
                  .chart(compTicker, {
                    period1: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
                    interval: '1d',
                  })
                  .catch(() => null),
                yf
                  .chart(compTicker, {
                    period1: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
                    interval: '1d',
                  })
                  .catch(() => null),
                yf
                  .chart(compTicker, {
                    period1: new Date(
                      Date.now() - 10 * 365 * 24 * 60 * 60 * 1000,
                    ),
                    interval: '1wk',
                  })
                  .catch(() => null),
              ]);
              return {
                ticker: compTicker,
                name: compQuote.shortName || compTicker,
                charts: compCharts,
              };
            } catch (error) {
              console.error(
                `Failed to fetch comparison ticker ${compName}:`,
                error,
              );
              return null;
            }
          });
        const compResults = await Promise.all(comparisonPromises);
        comparisonData = compResults.filter((r) => r !== null);
      }

      const stockData = {
        symbol: quote.symbol,
        shortName: quote.shortName || quote.longName || ticker,
        longName: quote.longName,
        exchange: quote.fullExchangeName || quote.exchange,
        currency: quote.currency,
        quoteType: quote.quoteType,

        marketState: quote.marketState,
        regularMarketTime: quote.regularMarketTime,
        postMarketTime: quote.postMarketTime,
        preMarketTime: quote.preMarketTime,

        regularMarketPrice: quote.regularMarketPrice,
        regularMarketChange: quote.regularMarketChange,
        regularMarketChangePercent: quote.regularMarketChangePercent,
        regularMarketPreviousClose: quote.regularMarketPreviousClose,
        regularMarketOpen: quote.regularMarketOpen,
        regularMarketDayHigh: quote.regularMarketDayHigh,
        regularMarketDayLow: quote.regularMarketDayLow,

        postMarketPrice: quote.postMarketPrice,
        postMarketChange: quote.postMarketChange,
        postMarketChangePercent: quote.postMarketChangePercent,
        preMarketPrice: quote.preMarketPrice,
        preMarketChange: quote.preMarketChange,
        preMarketChangePercent: quote.preMarketChangePercent,

        regularMarketVolume: quote.regularMarketVolume,
        averageDailyVolume3Month: quote.averageDailyVolume3Month,
        averageDailyVolume10Day: quote.averageDailyVolume10Day,
        bid: quote.bid,
        bidSize: quote.bidSize,
        ask: quote.ask,
        askSize: quote.askSize,

        fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
        fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
        fiftyTwoWeekChange: quote.fiftyTwoWeekChange,
        fiftyTwoWeekChangePercent: quote.fiftyTwoWeekChangePercent,

        marketCap: quote.marketCap,
        trailingPE: quote.trailingPE,
        forwardPE: quote.forwardPE,
        priceToBook: quote.priceToBook,
        bookValue: quote.bookValue,
        earningsPerShare: quote.epsTrailingTwelveMonths,
        epsForward: quote.epsForward,

        dividendRate: quote.dividendRate,
        dividendYield: quote.dividendYield,
        exDividendDate: quote.exDividendDate,
        trailingAnnualDividendRate: quote.trailingAnnualDividendRate,
        trailingAnnualDividendYield: quote.trailingAnnualDividendYield,

        beta: quote.beta,

        fiftyDayAverage: quote.fiftyDayAverage,
        fiftyDayAverageChange: quote.fiftyDayAverageChange,
        fiftyDayAverageChangePercent: quote.fiftyDayAverageChangePercent,
        twoHundredDayAverage: quote.twoHundredDayAverage,
        twoHundredDayAverageChange: quote.twoHundredDayAverageChange,
        twoHundredDayAverageChangePercent:
          quote.twoHundredDayAverageChangePercent,

        sector: quote.sector,
        industry: quote.industry,
        website: quote.website,

        chartData: {
          '1D': chart1D
            ? {
                timestamps: chart1D.quotes.map((q: any) => q.date.getTime()),
                prices: chart1D.quotes.map((q: any) => q.close),
              }
            : null,
          '5D': chart5D
            ? {
                timestamps: chart5D.quotes.map((q: any) => q.date.getTime()),
                prices: chart5D.quotes.map((q: any) => q.close),
              }
            : null,
          '1M': chart1M
            ? {
                timestamps: chart1M.quotes.map((q: any) => q.date.getTime()),
                prices: chart1M.quotes.map((q: any) => q.close),
              }
            : null,
          '3M': chart3M
            ? {
                timestamps: chart3M.quotes.map((q: any) => q.date.getTime()),
                prices: chart3M.quotes.map((q: any) => q.close),
              }
            : null,
          '6M': chart6M
            ? {
                timestamps: chart6M.quotes.map((q: any) => q.date.getTime()),
                prices: chart6M.quotes.map((q: any) => q.close),
              }
            : null,
          '1Y': chart1Y
            ? {
                timestamps: chart1Y.quotes.map((q: any) => q.date.getTime()),
                prices: chart1Y.quotes.map((q: any) => q.close),
              }
            : null,
          MAX: chartMAX
            ? {
                timestamps: chartMAX.quotes.map((q: any) => q.date.getTime()),
                prices: chartMAX.quotes.map((q: any) => q.close),
              }
            : null,
        },
        comparisonData: comparisonData
          ? comparisonData.map((comp: any) => ({
              ticker: comp.ticker,
              name: comp.name,
              chartData: {
                '1D': comp.charts[0]
                  ? {
                      timestamps: comp.charts[0].quotes.map((q: any) =>
                        q.date.getTime(),
                      ),
                      prices: comp.charts[0].quotes.map((q: any) => q.close),
                    }
                  : null,
                '5D': comp.charts[1]
                  ? {
                      timestamps: comp.charts[1].quotes.map((q: any) =>
                        q.date.getTime(),
                      ),
                      prices: comp.charts[1].quotes.map((q: any) => q.close),
                    }
                  : null,
                '1M': comp.charts[2]
                  ? {
                      timestamps: comp.charts[2].quotes.map((q: any) =>
                        q.date.getTime(),
                      ),
                      prices: comp.charts[2].quotes.map((q: any) => q.close),
                    }
                  : null,
                '3M': comp.charts[3]
                  ? {
                      timestamps: comp.charts[3].quotes.map((q: any) =>
                        q.date.getTime(),
                      ),
                      prices: comp.charts[3].quotes.map((q: any) => q.close),
                    }
                  : null,
                '6M': comp.charts[4]
                  ? {
                      timestamps: comp.charts[4].quotes.map((q: any) =>
                        q.date.getTime(),
                      ),
                      prices: comp.charts[4].quotes.map((q: any) => q.close),
                    }
                  : null,
                '1Y': comp.charts[5]
                  ? {
                      timestamps: comp.charts[5].quotes.map((q: any) =>
                        q.date.getTime(),
                      ),
                      prices: comp.charts[5].quotes.map((q: any) => q.close),
                    }
                  : null,
                MAX: comp.charts[6]
                  ? {
                      timestamps: comp.charts[6].quotes.map((q: any) =>
                        q.date.getTime(),
                      ),
                      prices: comp.charts[6].quotes.map((q: any) => q.close),
                    }
                  : null,
              },
            }))
          : null,
      };

      return {
        type: 'stock',
        llmContext: `Current price of ${stockData.shortName} (${stockData.symbol}) is ${stockData.regularMarketPrice} ${stockData.currency}. Other details: ${JSON.stringify(
          {
            marketState: stockData.marketState,
            regularMarketChange: stockData.regularMarketChange,
            regularMarketChangePercent: stockData.regularMarketChangePercent,
            marketCap: stockData.marketCap,
            peRatio: stockData.trailingPE,
            dividendYield: stockData.dividendYield,
          },
        )}`,
        data: stockData,
      };
    } catch (error: any) {
      return {
        type: 'stock',
        llmContext: 'Failed to fetch stock data.',
        data: {
          error: `Error fetching stock data: ${error.message || error}`,
          ticker: params.name,
        },
      };
    }
  },
};

export default stockWidget;
