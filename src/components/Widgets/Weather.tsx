'use client';

import { getMeasurementUnit } from '@/lib/config/clientRegistry';
import { Wind, Droplets, Gauge } from 'lucide-react';
import { useMemo, useEffect, useState } from 'react';

type WeatherWidgetProps = {
  location: string;
  current: {
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
    apparent_temperature: number;
    is_day: number;
    precipitation: number;
    weather_code: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    wind_gusts_10m?: number;
  };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: number[];
  };
  timezone: string;
};

const getWeatherInfo = (code: number, isDay: boolean, isDarkMode: boolean) => {
  const dayNight = isDay ? 'day' : 'night';

  const weatherMap: Record<
    number,
    { icon: string; description: string; gradient: string }
  > = {
    0: {
      icon: `clear-${dayNight}.svg`,
      description: 'Clear',
      gradient: isDarkMode
        ? isDay
          ? 'radial-gradient(ellipse 150% 100% at 50% 100%, #E8F1FA, #7A9DBF 35%, #4A7BA8 60%, #2F5A88)'
          : 'radial-gradient(ellipse 150% 100% at 50% 100%, #5A6A7E, #3E4E63 40%, #2A3544 65%, #1A2230)'
        : isDay
          ? 'radial-gradient(ellipse 150% 100% at 50% 100%, #FFFFFF, #DBEAFE 30%, #93C5FD 60%, #60A5FA)'
          : 'radial-gradient(ellipse 150% 100% at 50% 100%, #7B8694, #475569 45%, #334155 70%, #1E293B)',
    },
    1: {
      icon: `clear-${dayNight}.svg`,
      description: 'Mostly Clear',
      gradient: isDarkMode
        ? isDay
          ? 'radial-gradient(ellipse 150% 100% at 50% 100%, #E8F1FA, #7A9DBF 35%, #4A7BA8 60%, #2F5A88)'
          : 'radial-gradient(ellipse 150% 100% at 50% 100%, #5A6A7E, #3E4E63 40%, #2A3544 65%, #1A2230)'
        : isDay
          ? 'radial-gradient(ellipse 150% 100% at 50% 100%, #FFFFFF, #DBEAFE 30%, #93C5FD 60%, #60A5FA)'
          : 'radial-gradient(ellipse 150% 100% at 50% 100%, #7B8694, #475569 45%, #334155 70%, #1E293B)',
    },
    2: {
      icon: `cloudy-1-${dayNight}.svg`,
      description: 'Partly Cloudy',
      gradient: isDarkMode
        ? isDay
          ? 'radial-gradient(ellipse 150% 100% at 50% 100%, #D4E1ED, #8BA3B8 35%, #617A93 60%, #426070)'
          : 'radial-gradient(ellipse 150% 100% at 50% 100%, #6B7583, #4A5563 40%, #3A4450 65%, #2A3340)'
        : isDay
          ? 'radial-gradient(ellipse 150% 100% at 50% 100%, #FFFFFF, #E0F2FE 28%, #BFDBFE 58%, #93C5FD)'
          : 'radial-gradient(ellipse 150% 100% at 50% 100%, #8B99AB, #64748B 45%, #475569 70%, #334155)',
    },
    3: {
      icon: `cloudy-1-${dayNight}.svg`,
      description: 'Cloudy',
      gradient: isDarkMode
        ? 'radial-gradient(ellipse 150% 100% at 50% 100%, #B8C3CF, #758190 38%, #546270 65%, #3D4A58)'
        : 'radial-gradient(ellipse 150% 100% at 50% 100%, #F5F8FA, #CBD5E1 32%, #94A3B8 65%, #64748B)',
    },
    45: {
      icon: `fog-${dayNight}.svg`,
      description: 'Foggy',
      gradient: isDarkMode
        ? 'radial-gradient(ellipse 150% 100% at 50% 100%, #C5CDD8, #8892A0 38%, #697380 65%, #4F5A68)'
        : 'radial-gradient(ellipse 150% 100% at 50% 100%, #FFFFFF, #E2E8F0 30%, #CBD5E1 62%, #94A3B8)',
    },
    48: {
      icon: `fog-${dayNight}.svg`,
      description: 'Rime Fog',
      gradient: isDarkMode
        ? 'radial-gradient(ellipse 150% 100% at 50% 100%, #C5CDD8, #8892A0 38%, #697380 65%, #4F5A68)'
        : 'radial-gradient(ellipse 150% 100% at 50% 100%, #FFFFFF, #E2E8F0 30%, #CBD5E1 62%, #94A3B8)',
    },
    51: {
      icon: `rainy-1-${dayNight}.svg`,
      description: 'Light Drizzle',
      gradient: isDarkMode
        ? 'radial-gradient(ellipse 150% 100% at 50% 100%, #B8D4E5, #6FA4C5 35%, #4A85AC 60%, #356A8E)'
        : 'radial-gradient(ellipse 150% 100% at 50% 100%, #E5FBFF, #A5F3FC 28%, #67E8F9 60%, #22D3EE)',
    },
    53: {
      icon: `rainy-1-${dayNight}.svg`,
      description: 'Drizzle',
      gradient: isDarkMode
        ? 'radial-gradient(ellipse 150% 100% at 50% 100%, #B8D4E5, #6FA4C5 35%, #4A85AC 60%, #356A8E)'
        : 'radial-gradient(ellipse 150% 100% at 50% 100%, #E5FBFF, #A5F3FC 28%, #67E8F9 60%, #22D3EE)',
    },
    55: {
      icon: `rainy-2-${dayNight}.svg`,
      description: 'Heavy Drizzle',
      gradient: isDarkMode
        ? 'radial-gradient(ellipse 150% 100% at 50% 100%, #A5C5D8, #5E92B0 35%, #3F789D 60%, #2A5F82)'
        : 'radial-gradient(ellipse 150% 100% at 50% 100%, #D4F3FF, #7DD3FC 30%, #38BDF8 62%, #0EA5E9)',
    },
    61: {
      icon: `rainy-2-${dayNight}.svg`,
      description: 'Light Rain',
      gradient: isDarkMode
        ? 'radial-gradient(ellipse 150% 100% at 50% 100%, #A5C5D8, #5E92B0 35%, #3F789D 60%, #2A5F82)'
        : 'radial-gradient(ellipse 150% 100% at 50% 100%, #D4F3FF, #7DD3FC 30%, #38BDF8 62%, #0EA5E9)',
    },
    63: {
      icon: `rainy-2-${dayNight}.svg`,
      description: 'Rain',
      gradient: isDarkMode
        ? 'radial-gradient(ellipse 150% 100% at 50% 100%, #8DB3C8, #4D819F 38%, #326A87 65%, #215570)'
        : 'radial-gradient(ellipse 150% 100% at 50% 100%, #B8E8FF, #38BDF8 32%, #0EA5E9 65%, #0284C7)',
    },
    65: {
      icon: `rainy-3-${dayNight}.svg`,
      description: 'Heavy Rain',
      gradient: isDarkMode
        ? 'radial-gradient(ellipse 150% 100% at 50% 100%, #7BA3B8, #3D6F8A 38%, #295973 65%, #1A455D)'
        : 'radial-gradient(ellipse 150% 100% at 50% 100%, #9CD9F5, #0EA5E9 32%, #0284C7 65%, #0369A1)',
    },
    71: {
      icon: `snowy-1-${dayNight}.svg`,
      description: 'Light Snow',
      gradient: isDarkMode
        ? 'radial-gradient(ellipse 150% 100% at 50% 100%, #E5F0FA, #9BB5CE 32%, #7496B8 58%, #527A9E)'
        : 'radial-gradient(ellipse 150% 100% at 50% 100%, #FFFFFF, #F0F9FF 25%, #E0F2FE 55%, #BAE6FD)',
    },
    73: {
      icon: `snowy-2-${dayNight}.svg`,
      description: 'Snow',
      gradient: isDarkMode
        ? 'radial-gradient(ellipse 150% 100% at 50% 100%, #D4E5F3, #85A1BD 35%, #6584A8 60%, #496A8E)'
        : 'radial-gradient(ellipse 150% 100% at 50% 100%, #FAFEFF, #E0F2FE 28%, #BAE6FD 60%, #7DD3FC)',
    },
    75: {
      icon: `snowy-3-${dayNight}.svg`,
      description: 'Heavy Snow',
      gradient: isDarkMode
        ? 'radial-gradient(ellipse 150% 100% at 50% 100%, #BDD8EB, #6F92AE 35%, #4F7593 60%, #365A78)'
        : 'radial-gradient(ellipse 150% 100% at 50% 100%, #F0FAFF, #BAE6FD 30%, #7DD3FC 62%, #38BDF8)',
    },
    77: {
      icon: `snowy-1-${dayNight}.svg`,
      description: 'Snow Grains',
      gradient: isDarkMode
        ? 'radial-gradient(ellipse 150% 100% at 50% 100%, #E5F0FA, #9BB5CE 32%, #7496B8 58%, #527A9E)'
        : 'radial-gradient(ellipse 150% 100% at 50% 100%, #FFFFFF, #F0F9FF 25%, #E0F2FE 55%, #BAE6FD)',
    },
    80: {
      icon: `rainy-2-${dayNight}.svg`,
      description: 'Light Showers',
      gradient: isDarkMode
        ? 'radial-gradient(ellipse 150% 100% at 50% 100%, #A5C5D8, #5E92B0 35%, #3F789D 60%, #2A5F82)'
        : 'radial-gradient(ellipse 150% 100% at 50% 100%, #D4F3FF, #7DD3FC 30%, #38BDF8 62%, #0EA5E9)',
    },
    81: {
      icon: `rainy-2-${dayNight}.svg`,
      description: 'Showers',
      gradient: isDarkMode
        ? 'radial-gradient(ellipse 150% 100% at 50% 100%, #8DB3C8, #4D819F 38%, #326A87 65%, #215570)'
        : 'radial-gradient(ellipse 150% 100% at 50% 100%, #B8E8FF, #38BDF8 32%, #0EA5E9 65%, #0284C7)',
    },
    82: {
      icon: `rainy-3-${dayNight}.svg`,
      description: 'Heavy Showers',
      gradient: isDarkMode
        ? 'radial-gradient(ellipse 150% 100% at 50% 100%, #7BA3B8, #3D6F8A 38%, #295973 65%, #1A455D)'
        : 'radial-gradient(ellipse 150% 100% at 50% 100%, #9CD9F5, #0EA5E9 32%, #0284C7 65%, #0369A1)',
    },
    85: {
      icon: `snowy-2-${dayNight}.svg`,
      description: 'Light Snow Showers',
      gradient: isDarkMode
        ? 'radial-gradient(ellipse 150% 100% at 50% 100%, #D4E5F3, #85A1BD 35%, #6584A8 60%, #496A8E)'
        : 'radial-gradient(ellipse 150% 100% at 50% 100%, #FAFEFF, #E0F2FE 28%, #BAE6FD 60%, #7DD3FC)',
    },
    86: {
      icon: `snowy-3-${dayNight}.svg`,
      description: 'Snow Showers',
      gradient: isDarkMode
        ? 'radial-gradient(ellipse 150% 100% at 50% 100%, #BDD8EB, #6F92AE 35%, #4F7593 60%, #365A78)'
        : 'radial-gradient(ellipse 150% 100% at 50% 100%, #F0FAFF, #BAE6FD 30%, #7DD3FC 62%, #38BDF8)',
    },
    95: {
      icon: `scattered-thunderstorms-${dayNight}.svg`,
      description: 'Thunderstorm',
      gradient: isDarkMode
        ? 'radial-gradient(ellipse 150% 100% at 50% 100%, #8A95A3, #5F6A7A 38%, #475260 65%, #2F3A48)'
        : 'radial-gradient(ellipse 150% 100% at 50% 100%, #C8D1DD, #94A3B8 32%, #64748B 65%, #475569)',
    },
    96: {
      icon: 'severe-thunderstorm.svg',
      description: 'Thunderstorm + Hail',
      gradient: isDarkMode
        ? 'radial-gradient(ellipse 150% 100% at 50% 100%, #7A8593, #515C6D 38%, #3A4552 65%, #242D3A)'
        : 'radial-gradient(ellipse 150% 100% at 50% 100%, #B0BBC8, #64748B 32%, #475569 65%, #334155)',
    },
    99: {
      icon: 'severe-thunderstorm.svg',
      description: 'Severe Thunderstorm',
      gradient: isDarkMode
        ? 'radial-gradient(ellipse 150% 100% at 50% 100%, #6A7583, #434E5D 40%, #2F3A47 68%, #1C2530)'
        : 'radial-gradient(ellipse 150% 100% at 50% 100%, #9BA8B8, #475569 35%, #334155 68%, #1E293B)',
    },
  };

  return weatherMap[code] || weatherMap[0];
};

const Weather = ({
  location,
  current,
  daily,
  timezone,
}: WeatherWidgetProps) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const unit = getMeasurementUnit();
  const isImperial = unit === 'imperial';
  const tempUnitLabel = isImperial ? '°F' : '°C';
  const windUnitLabel = isImperial ? 'mph' : 'km/h';

  const formatTemp = (celsius: number) => {
    if (!Number.isFinite(celsius)) return 0;
    return Math.round(isImperial ? (celsius * 9) / 5 + 32 : celsius);
  };

  const formatWind = (speedKmh: number) => {
    if (!Number.isFinite(speedKmh)) return 0;
    return Math.round(isImperial ? speedKmh * 0.621371 : speedKmh);
  };

  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };

    checkDarkMode();

    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  const weatherInfo = useMemo(
    () =>
      getWeatherInfo(
        current?.weather_code || 0,
        current?.is_day === 1,
        isDarkMode,
      ),
    [current?.weather_code, current?.is_day, isDarkMode],
  );

  const forecast = useMemo(() => {
    if (!daily?.time || daily.time.length === 0) return [];

    return daily.time.slice(1, 7).map((time, idx) => {
      const date = new Date(time);
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      const isDay = true;
      const weatherCode = daily.weather_code[idx + 1];
      const info = getWeatherInfo(weatherCode, isDay, isDarkMode);

      return {
        day: dayName,
        icon: info.icon,
        high: formatTemp(daily.temperature_2m_max[idx + 1]),
        low: formatTemp(daily.temperature_2m_min[idx + 1]),
        precipitation: daily.precipitation_probability_max[idx + 1] || 0,
      };
    });
  }, [daily, isDarkMode, isImperial]);

  if (!current || !daily || !daily.time || daily.time.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-lg shadow-md bg-gray-200 dark:bg-gray-800">
        <div className="p-4 text-black dark:text-white">
          <p className="text-sm">Weather data unavailable for {location}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-lg shadow-md">
      <div
        className="absolute inset-0"
        style={{
          background: weatherInfo.gradient,
        }}
      />
      <div className="absolute inset-0 bg-black/15" />

      <div
        className="relative p-4 text-white"
        style={{ textShadow: '0 1px 2px rgba(0, 0, 0, 0.35)' }}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <img
              src={`/weather-ico/${weatherInfo.icon}`}
              alt={weatherInfo.description}
              className="w-16 h-16 object-contain drop-shadow-lg"
            />
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold drop-shadow-md">
                  {formatTemp(current.temperature_2m)}°
                </span>
                <span className="text-lg">{tempUnitLabel}</span>
              </div>
              <p className="text-sm font-medium drop-shadow mt-0.5">
                {weatherInfo.description}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium opacity-90">
              {formatTemp(daily.temperature_2m_max[0])}°{' '}
              {formatTemp(daily.temperature_2m_min[0])}°
            </p>
          </div>
        </div>

        <div className="mb-3 pb-3 border-b border-gray-800/20 dark:border-white/20">
          <h3 className="text-base font-semibold drop-shadow-md">{location}</h3>
          <p className="mt-0.5 text-xs text-white/90 drop-shadow">
            {new Date(current.time).toLocaleString('en-US', {
              weekday: 'short',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </p>
        </div>

        <div className="grid grid-cols-6 gap-2 mb-3 pb-3 border-b border-gray-800/20 dark:border-white/20">
          {forecast.map((day, idx) => (
            <div
              key={idx}
              className="flex flex-col items-center rounded-md bg-black/15 p-2 backdrop-blur-sm"
            >
              <p className="text-xs font-medium mb-1">{day.day}</p>
              <img
                src={`/weather-ico/${day.icon}`}
                alt=""
                className="mb-1 h-8 w-8 object-contain"
              />
              <div className="flex items-center gap-1 text-xs">
                <span className="font-semibold">{day.high}°</span>
                <span className="text-white/70">{day.low}°</span>
              </div>
              {day.precipitation > 0 && (
                <div className="flex items-center gap-0.5 mt-1">
                  <Droplets className="h-3 w-3 text-white/75" />
                  <span className="text-[10px] text-white/75">
                    {day.precipitation}%
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="flex items-center gap-2 rounded-md bg-black/15 p-2 backdrop-blur-sm">
            <Wind className="h-4 w-4 flex-shrink-0 text-white/80" />
            <div>
              <p className="text-[10px] text-white/70">Wind</p>
              <p className="font-semibold">
                {formatWind(current.wind_speed_10m)} {windUnitLabel}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-md bg-black/15 p-2 backdrop-blur-sm">
            <Droplets className="h-4 w-4 flex-shrink-0 text-white/80" />
            <div>
              <p className="text-[10px] text-white/70">Humidity</p>
              <p className="font-semibold">
                {Math.round(current.relative_humidity_2m)}%
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-md bg-black/15 p-2 backdrop-blur-sm">
            <Gauge className="h-4 w-4 flex-shrink-0 text-white/80" />
            <div>
              <p className="text-[10px] text-white/70">Feels Like</p>
              <p className="font-semibold">
                {formatTemp(current.apparent_temperature)}
                {tempUnitLabel}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Weather;
