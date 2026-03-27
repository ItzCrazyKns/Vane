import calculationWidget from './calculationWidget';
import WidgetExecutor from './executor';
import weatherWidget from './weatherWidget';
import stockWidget from './stockWidget';
import currencyWidget from './currencyWidget';

WidgetExecutor.register(weatherWidget);
WidgetExecutor.register(calculationWidget);
WidgetExecutor.register(stockWidget);
WidgetExecutor.register(currencyWidget);

export { WidgetExecutor };
