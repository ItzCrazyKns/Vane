import z from 'zod';
import { Widget } from '../types';
import formatChatHistoryAsString from '@/lib/utils/formatHistory';

// Exchange rates API - using a free API
const EXCHANGE_API_BASE = 'https://api.exchangerate-api.com/v4/latest';

const schema = z.object({
  amount: z
    .number()
    .describe('The amount of currency to convert. Default to 1 if not specified.'),
  fromCurrency: z
    .string()
    .describe('The source currency code (e.g., "USD", "EUR", "GBP", "JPY").'),
  toCurrency: z
    .string()
    .describe('The target currency code (e.g., "USD", "EUR", "GBP", "JPY").'),
  notPresent: z
    .boolean()
    .describe('Whether there is no need for the currency widget.'),
});

const systemPrompt = `
<role>
You are a currency conversion extractor. You will receive a user follow up and a conversation history.
Your task is to determine if the user is asking about currency conversion and extract the amount, source currency, and target currency.
</role>

<instructions>
- If the user is asking about currency conversion, extract the amount (default to 1 if not specified), source currency, and target currency.
- Currency codes should be standard 3-letter ISO codes (e.g., USD, EUR, GBP, JPY, CAD, AUD, CHF, CNY, etc.).
- Common currency names should be converted to their codes: "dollars" -> "USD", "euros" -> "EUR", "pounds" -> "GBP", "yen" -> "JPY", etc.
- Infer the context - if someone says "dollars" without specifying, assume USD. If they say "pounds" assume GBP.
- If you cannot determine valid currencies or the query is not currency-related, set notPresent to true.
</instructions>

<output_format>
You must respond in the following JSON format without any extra text, explanations or filler sentences:
{
  "amount": number,
  "fromCurrency": string,
  "toCurrency": string,
  "notPresent": boolean
}
</output_format>
`;

// Common currency symbols to code mapping
const currencySymbolMap: Record<string, string> = {
  '$': 'USD',
  '€': 'EUR',
  '£': 'GBP',
  '¥': 'JPY',
  '₹': 'INR',
  '₽': 'RUB',
  '₩': 'KRW',
  'A$': 'AUD',
  'C$': 'CAD',
  'CHF': 'CHF',
  'CN¥': 'CNY',
  'HK$': 'HKD',
  'NZ$': 'NZD',
  'S$': 'SGD',
};

// Common currency names to code mapping
const currencyNameMap: Record<string, string> = {
  'dollar': 'USD',
  'dollars': 'USD',
  'usd': 'USD',
  'euro': 'EUR',
  'euros': 'EUR',
  'eur': 'EUR',
  'pound': 'GBP',
  'pounds': 'GBP',
  'gbp': 'GBP',
  'sterling': 'GBP',
  'yen': 'JPY',
  'jpy': 'JPY',
  'rupee': 'INR',
  'rupees': 'INR',
  'inr': 'INR',
  'ruble': 'RUB',
  'rubles': 'RUB',
  'rub': 'RUB',
  'won': 'KRW',
  'krw': 'KRW',
  'yuan': 'CNY',
  'cny': 'CNY',
  'renminbi': 'CNY',
  'franc': 'CHF',
  'francs': 'CHF',
  'chf': 'CHF',
  'canadian dollar': 'CAD',
  'canadian dollars': 'CAD',
  'cad': 'CAD',
  'australian dollar': 'AUD',
  'australian dollars': 'AUD',
  'aud': 'AUD',
  'singapore dollar': 'SGD',
  'singapore dollars': 'SGD',
  'sgd': 'SGD',
  'hong kong dollar': 'HKD',
  'hong kong dollars': 'HKD',
  'hkd': 'HKD',
  'new zealand dollar': 'NZD',
  'new zealand dollars': 'NZD',
  'nzd': 'NZD',
};

const normalizeCurrencyCode = (currency: string): string => {
  const upper = currency.toUpperCase().trim();
  
  // Check if it's already a valid 3-letter code
  if (upper.length === 3) {
    return upper;
  }
  
  // Check symbol map
  if (currencySymbolMap[currency]) {
    return currencySymbolMap[currency];
  }
  
  // Check name map
  const lower = currency.toLowerCase().trim();
  if (currencyNameMap[lower]) {
    return currencyNameMap[lower];
  }
  
  return upper;
};

const currencyWidget: Widget = {
  type: 'currencyWidget',
  shouldExecute: (classification) =>
    classification.classification.showCurrencyWidget,
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

    const params = {
      amount: output.amount || 1,
      fromCurrency: normalizeCurrencyCode(output.fromCurrency),
      toCurrency: normalizeCurrencyCode(output.toCurrency),
    };

    try {
      // Fetch exchange rates from the base currency
      const response = await fetch(
        `${EXCHANGE_API_BASE}/${params.fromCurrency}`,
        {
          headers: {
            'User-Agent': 'Perplexica',
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch exchange rates: ${response.status}`);
      }

      const data = await response.json();
      const rates = data.rates as Record<string, number>;

      // Check if target currency is available
      if (!rates[params.toCurrency]) {
        throw new Error(
          `Currency ${params.toCurrency} not found in exchange rates`,
        );
      }

      const exchangeRate = rates[params.toCurrency];
      const convertedAmount = params.amount * exchangeRate;

      // Get a list of popular currency rates for context
      const popularCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY'];
      const relatedRates: Record<string, number> = {};
      
      popularCurrencies.forEach((currency) => {
        if (currency !== params.fromCurrency && rates[currency]) {
          relatedRates[currency] = rates[currency];
        }
      });

      return {
        type: 'currency',
        llmContext: `${params.amount} ${params.fromCurrency} is equal to ${convertedAmount.toFixed(2)} ${params.toCurrency} at an exchange rate of 1 ${params.fromCurrency} = ${exchangeRate.toFixed(6)} ${params.toCurrency}. The rates were last updated on ${data.date}.`,
        data: {
          amount: params.amount,
          fromCurrency: params.fromCurrency,
          toCurrency: params.toCurrency,
          exchangeRate,
          convertedAmount,
          lastUpdated: data.date,
          baseCurrency: data.base,
          relatedRates,
        },
      };
    } catch (err: any) {
      return {
        type: 'currency',
        llmContext: 'Failed to fetch currency conversion data.',
        data: {
          error: `Error fetching exchange rates: ${err.message || err}`,
          fromCurrency: params.fromCurrency,
          toCurrency: params.toCurrency,
          amount: params.amount,
        },
      };
    }
  },
};

export default currencyWidget;
