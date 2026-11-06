import React from 'react';
import { Widget } from '../ChatWindow';
import Weather from './Weather';
import Calculation from './Calculation';
import Stock from './Stock';
import { useTranslations } from 'next-intl';

const Renderer = ({ widgets }: { widgets: Widget[] }) => {
  const t = useTranslations('Widgets');

  return widgets.map((widget, index) => {
    switch (widget.widgetType) {
      case 'weather':
        return (
          <Weather
            key={index}
            location={widget.params.location}
            current={widget.params.current}
            daily={widget.params.daily}
            timezone={widget.params.timezone}
          />
        );
      case 'calculation_result':
        return (
          <Calculation
            expression={widget.params.expression}
            result={widget.params.result}
            key={index}
          />
        );
      case 'stock':
        return (
          <Stock
            key={index}
            symbol={widget.params.symbol}
            shortName={widget.params.shortName}
            longName={widget.params.longName}
            exchange={widget.params.exchange}
            currency={widget.params.currency}
            marketState={widget.params.marketState}
            regularMarketPrice={widget.params.regularMarketPrice}
            regularMarketChange={widget.params.regularMarketChange}
            regularMarketChangePercent={
              widget.params.regularMarketChangePercent
            }
            regularMarketPreviousClose={
              widget.params.regularMarketPreviousClose
            }
            regularMarketOpen={widget.params.regularMarketOpen}
            regularMarketDayHigh={widget.params.regularMarketDayHigh}
            regularMarketDayLow={widget.params.regularMarketDayLow}
            regularMarketVolume={widget.params.regularMarketVolume}
            averageDailyVolume3Month={widget.params.averageDailyVolume3Month}
            marketCap={widget.params.marketCap}
            fiftyTwoWeekLow={widget.params.fiftyTwoWeekLow}
            fiftyTwoWeekHigh={widget.params.fiftyTwoWeekHigh}
            trailingPE={widget.params.trailingPE}
            forwardPE={widget.params.forwardPE}
            dividendYield={widget.params.dividendYield}
            earningsPerShare={widget.params.earningsPerShare}
            website={widget.params.website}
            postMarketPrice={widget.params.postMarketPrice}
            postMarketChange={widget.params.postMarketChange}
            postMarketChangePercent={widget.params.postMarketChangePercent}
            preMarketPrice={widget.params.preMarketPrice}
            preMarketChange={widget.params.preMarketChange}
            preMarketChangePercent={widget.params.preMarketChangePercent}
            chartData={widget.params.chartData}
            comparisonData={widget.params.comparisonData}
            error={widget.params.error}
          />
        );
      default:
        return (
          <div key={index}>{t('unknownType', { type: widget.widgetType })}</div>
        );
    }
  });
};

export default Renderer;
