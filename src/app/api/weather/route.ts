import { getTranslations } from 'next-intl/server';

export const POST = async (req: Request) => {
  try {
    const tc = await getTranslations('WeatherConditions');
    const body: {
      lat: number;
      lng: number;
      measureUnit: 'Imperial' | 'Metric';
    } = await req.json();

    // 0 is a valid coordinate (equator / prime meridian), so don't use a
    // falsy check here.
    const lat = Number(body.lat);
    const lng = Number(body.lng);

    if (
      body.lat === null ||
      body.lat === undefined ||
      body.lng === null ||
      body.lng === undefined ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      Math.abs(lat) > 90 ||
      Math.abs(lng) > 180
    ) {
      return Response.json(
        {
          message: 'Invalid request.',
        },
        { status: 400 },
      );
    }

    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=weather_code,temperature_2m,is_day,relative_humidity_2m,wind_speed_10m&timezone=auto${
        body.measureUnit === 'Metric' ? '' : '&temperature_unit=fahrenheit'
      }${body.measureUnit === 'Metric' ? '' : '&wind_speed_unit=mph'}`,
    );

    const data = await res.json();

    if (data.error) {
      console.error(`Error fetching weather data: ${data.reason}`);
      return Response.json(
        {
          message: 'An error has occurred.',
        },
        { status: 500 },
      );
    }

    const weather: {
      temperature: number;
      condition: string;
      humidity: number;
      windSpeed: number;
      icon: string;
      temperatureUnit: 'C' | 'F';
      windSpeedUnit: 'm/s' | 'mph';
    } = {
      temperature: data.current.temperature_2m,
      condition: '',
      humidity: data.current.relative_humidity_2m,
      windSpeed: data.current.wind_speed_10m,
      icon: '',
      temperatureUnit: body.measureUnit === 'Metric' ? 'C' : 'F',
      windSpeedUnit: body.measureUnit === 'Metric' ? 'm/s' : 'mph',
    };

    const code = data.current.weather_code;
    const isDay = data.current.is_day === 1;
    const dayOrNight = isDay ? 'day' : 'night';

    switch (code) {
      case 0:
        weather.icon = `clear-${dayOrNight}`;
        weather.condition = tc('clear');
        break;

      case 1:
        weather.icon = `cloudy-1-${dayOrNight}`;
        weather.condition = tc('mainlyClear');
        break;
      case 2:
        weather.icon = `cloudy-1-${dayOrNight}`;
        weather.condition = tc('partlyCloudy');
        break;
      case 3:
        weather.icon = `cloudy-1-${dayOrNight}`;
        weather.condition = tc('cloudy');
        break;

      case 45:
        weather.icon = `fog-${dayOrNight}`;
        weather.condition = tc('fog');
        break;
      case 48:
        weather.icon = `fog-${dayOrNight}`;
        weather.condition = tc('fog');
        break;

      case 51:
        weather.icon = `rainy-1-${dayOrNight}`;
        weather.condition = tc('lightDrizzle');
        break;
      case 53:
        weather.icon = `rainy-1-${dayOrNight}`;
        weather.condition = tc('moderateDrizzle');
        break;
      case 55:
        weather.icon = `rainy-1-${dayOrNight}`;
        weather.condition = tc('denseDrizzle');
        break;

      case 56:
        weather.icon = `frost-${dayOrNight}`;
        weather.condition = tc('lightFreezingDrizzle');
        break;
      case 57:
        weather.icon = `frost-${dayOrNight}`;
        weather.condition = tc('denseFreezingDrizzle');
        break;

      case 61:
        weather.icon = `rainy-2-${dayOrNight}`;
        weather.condition = tc('slightRain');
        break;
      case 63:
        weather.icon = `rainy-2-${dayOrNight}`;
        weather.condition = tc('moderateRain');
        break;
      case 65:
        weather.condition = tc('heavyRain');
        weather.icon = `rainy-2-${dayOrNight}`;
        break;

      case 66:
        weather.icon = 'rain-and-sleet-mix';
        weather.condition = tc('lightFreezingRain');
        break;
      case 67:
        weather.condition = tc('heavyFreezingRain');
        weather.icon = 'rain-and-sleet-mix';
        break;

      case 71:
        weather.icon = `snowy-2-${dayOrNight}`;
        weather.condition = tc('slightSnowFall');
        break;
      case 73:
        weather.icon = `snowy-2-${dayOrNight}`;
        weather.condition = tc('moderateSnowFall');
        break;
      case 75:
        weather.condition = tc('heavySnowFall');
        weather.icon = `snowy-2-${dayOrNight}`;
        break;

      case 77:
        weather.condition = tc('snow');
        weather.icon = `snowy-1-${dayOrNight}`;
        break;

      case 80:
        weather.icon = `rainy-3-${dayOrNight}`;
        weather.condition = tc('slightRainShowers');
        break;
      case 81:
        weather.icon = `rainy-3-${dayOrNight}`;
        weather.condition = tc('moderateRainShowers');
        break;
      case 82:
        weather.condition = tc('heavyRainShowers');
        weather.icon = `rainy-3-${dayOrNight}`;
        break;

      case 85:
        weather.icon = `snowy-3-${dayOrNight}`;
        weather.condition = tc('slightSnowShowers');
        break;
      case 86:
        weather.icon = `snowy-3-${dayOrNight}`;
        weather.condition = tc('moderateSnowShowers');
        break;
      case 87:
        weather.condition = tc('heavySnowShowers');
        weather.icon = `snowy-3-${dayOrNight}`;
        break;

      case 95:
        weather.condition = tc('thunderstorm');
        weather.icon = `scattered-thunderstorms-${dayOrNight}`;
        break;

      case 96:
        weather.icon = 'severe-thunderstorm';
        weather.condition = tc('thunderstormWithSlightHail');
        break;
      case 99:
        weather.condition = tc('thunderstormWithHeavyHail');
        weather.icon = 'severe-thunderstorm';
        break;

      default:
        weather.icon = `clear-${dayOrNight}`;
        weather.condition = tc('clear');
        break;
    }

    return Response.json(weather);
  } catch (err) {
    console.error('An error occurred while getting home widgets', err);
    return Response.json(
      {
        message: 'An error has occurred.',
      },
      {
        status: 500,
      },
    );
  }
};
