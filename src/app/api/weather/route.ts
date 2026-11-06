export const POST = async (req: Request) => {
  try {
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
        weather.condition = 'Clear';
        break;

      case 1:
        weather.icon = `cloudy-1-${dayOrNight}`;
        weather.condition = 'Mainly Clear';
        break;
      case 2:
        weather.icon = `cloudy-1-${dayOrNight}`;
        weather.condition = 'Partly Cloudy';
        break;
      case 3:
        weather.icon = `cloudy-1-${dayOrNight}`;
        weather.condition = 'Cloudy';
        break;

      case 45:
        weather.icon = `fog-${dayOrNight}`;
        weather.condition = 'Fog';
        break;
      case 48:
        weather.icon = `fog-${dayOrNight}`;
        weather.condition = 'Fog';
        break;

      case 51:
        weather.icon = `rainy-1-${dayOrNight}`;
        weather.condition = 'Light Drizzle';
        break;
      case 53:
        weather.icon = `rainy-1-${dayOrNight}`;
        weather.condition = 'Moderate Drizzle';
        break;
      case 55:
        weather.icon = `rainy-1-${dayOrNight}`;
        weather.condition = 'Dense Drizzle';
        break;

      case 56:
        weather.icon = `frost-${dayOrNight}`;
        weather.condition = 'Light Freezing Drizzle';
        break;
      case 57:
        weather.icon = `frost-${dayOrNight}`;
        weather.condition = 'Dense Freezing Drizzle';
        break;

      case 61:
        weather.icon = `rainy-2-${dayOrNight}`;
        weather.condition = 'Slight Rain';
        break;
      case 63:
        weather.icon = `rainy-2-${dayOrNight}`;
        weather.condition = 'Moderate Rain';
        break;
      case 65:
        weather.condition = 'Heavy Rain';
        weather.icon = `rainy-2-${dayOrNight}`;
        break;

      case 66:
        weather.icon = 'rain-and-sleet-mix';
        weather.condition = 'Light Freezing Rain';
        break;
      case 67:
        weather.condition = 'Heavy Freezing Rain';
        weather.icon = 'rain-and-sleet-mix';
        break;

      case 71:
        weather.icon = `snowy-2-${dayOrNight}`;
        weather.condition = 'Slight Snow Fall';
        break;
      case 73:
        weather.icon = `snowy-2-${dayOrNight}`;
        weather.condition = 'Moderate Snow Fall';
        break;
      case 75:
        weather.condition = 'Heavy Snow Fall';
        weather.icon = `snowy-2-${dayOrNight}`;
        break;

      case 77:
        weather.condition = 'Snow';
        weather.icon = `snowy-1-${dayOrNight}`;
        break;

      case 80:
        weather.icon = `rainy-3-${dayOrNight}`;
        weather.condition = 'Slight Rain Showers';
        break;
      case 81:
        weather.icon = `rainy-3-${dayOrNight}`;
        weather.condition = 'Moderate Rain Showers';
        break;
      case 82:
        weather.condition = 'Heavy Rain Showers';
        weather.icon = `rainy-3-${dayOrNight}`;
        break;

      case 85:
        weather.icon = `snowy-3-${dayOrNight}`;
        weather.condition = 'Slight Snow Showers';
        break;
      case 86:
        weather.icon = `snowy-3-${dayOrNight}`;
        weather.condition = 'Moderate Snow Showers';
        break;
      case 87:
        weather.condition = 'Heavy Snow Showers';
        weather.icon = `snowy-3-${dayOrNight}`;
        break;

      case 95:
        weather.condition = 'Thunderstorm';
        weather.icon = `scattered-thunderstorms-${dayOrNight}`;
        break;

      case 96:
        weather.icon = 'severe-thunderstorm';
        weather.condition = 'Thunderstorm with Slight Hail';
        break;
      case 99:
        weather.condition = 'Thunderstorm with Heavy Hail';
        weather.icon = 'severe-thunderstorm';
        break;

      default:
        weather.icon = `clear-${dayOrNight}`;
        weather.condition = 'Clear';
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
