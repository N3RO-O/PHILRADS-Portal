import { useEffect, useState } from 'react';
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  Loader2,
  Pause,
  Play,
  Radar,
  RotateCw,
  Sun,
  Thermometer,
  TriangleAlert,
  Umbrella,
  Wind,
  X,
  type LucideIcon,
} from 'lucide-react';
import { formatLatLng } from '../../lib/geo';
import {
  compass,
  cssColor,
  fetchSpot,
  RAIN_SCALE,
  spotAlerts,
  TEMP_SCALE,
  weatherLabel,
  WeatherBusyError,
  WIND_SCALE,
  type ColorStop,
  type SpotForecast,
  type WeatherMode,
} from '../../services/weather/weather';
import { Sheet } from '../ui/Sheet';
import type { MapWeather } from './useMapWeather';

const TZ = 'Asia/Manila';
const hourLabel = (unix: number) => new Intl.DateTimeFormat('en-PH', { hour: 'numeric', timeZone: TZ }).format(unix * 1000);
const dayHour = (unix: number) => new Intl.DateTimeFormat('en-PH', { weekday: 'short', hour: 'numeric', timeZone: TZ }).format(unix * 1000);
const clock = (unix: number) => new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit', timeZone: TZ }).format(unix * 1000);
const weekday = (unix: number) => new Intl.DateTimeFormat('en-PH', { weekday: 'short', month: 'short', day: 'numeric', timeZone: TZ }).format(unix * 1000);

export const WEATHER_MODES: { key: WeatherMode; label: string; icon: LucideIcon }[] = [
  { key: 'wind', label: 'Wind', icon: Wind },
  { key: 'rain', label: 'Rain', icon: CloudRain },
  { key: 'temp', label: 'Temp', icon: Thermometer },
  { key: 'radar', label: 'Radar', icon: Radar },
];

const LEGENDS: Record<Exclude<WeatherMode, 'radar'>, { scale: ColorStop[]; ticks: number[]; unit: string; note: string }> = {
  wind: { scale: WIND_SCALE, ticks: [0, 20, 39, 62, 89, 118], unit: 'km/h', note: '39 / 62 / 89 / 118 km/h: PAGASA wind signals 1 to 4' },
  rain: { scale: RAIN_SCALE.slice(1), ticks: [0.1, 1, 2.5, 7.5, 15, 30], unit: 'mm/h', note: '7.5 / 15 / 30 mm/h: PAGASA yellow, orange, red rain' },
  temp: { scale: TEMP_SCALE, ticks: [18, 23, 27, 30, 33, 37], unit: '°C', note: 'Air temperature 2 m above the ground' },
};

/** Weather on the map: the view (wind, rain, temperature, radar), the timeline with play, and the colour key. */
export function WeatherBar({ weather, onClose }: { weather: MapWeather; onClose: () => void }) {
  const { mode, setMode, times, hour, setHour, nowIndex, radar, radarIndex, setRadarIndex, playing, setPlaying, status } = weather;
  if (!mode) return null;
  const isRadar = mode === 'radar';
  const count = isRadar ? radar.length : times.length;
  const index = isRadar ? radarIndex : hour;
  const at = isRadar ? radar[radarIndex]?.time : times[hour];
  const timeText = at == null ? '' : isRadar ? clock(at) : hour === nowIndex ? 'Now' : dayHour(at);
  const sub = at == null ? '' : isRadar ? (radarIndex === radar.length - 1 ? 'latest' : `${Math.round((radar[radar.length - 1].time - at) / 60)} min ago`) : hour === nowIndex ? hourLabel(at) : `in ${hour - nowIndex} h`;

  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-line bg-surface-raised/95 p-2.5 shadow-2xl shadow-black/50 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <div role="radiogroup" aria-label="Weather to show" className="grid flex-1 grid-cols-4 gap-1 rounded-xl bg-page/70 p-1">
          {WEATHER_MODES.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={mode === key}
              onClick={() => setMode(key)}
              className={`flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-1 text-xs font-semibold transition ${mode === key ? 'bg-uplift text-page' : 'text-ink-soft hover:bg-white/[0.06]'}`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {label}
            </button>
          ))}
        </div>
        <button type="button" onClick={onClose} aria-label="Hide weather" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-muted hover:bg-white/[0.06] hover:text-ink">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {status.state === 'error' ? (
        <p className="flex items-center gap-2 px-1 text-xs text-ink-soft" role="alert">
          <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-status-low" aria-hidden />
          <span className="flex-1">{status.message}</span>
          <button type="button" className="btn-ghost min-h-8 shrink-0 px-2.5 text-xs" onClick={weather.retry}>
            <RotateCw className="h-3.5 w-3.5" aria-hidden /> Retry
          </button>
        </p>
      ) : count === 0 ? (
        <p className="flex items-center gap-2 px-1 text-xs text-muted">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Loading the {isRadar ? 'radar' : 'forecast'}…
        </p>
      ) : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (!playing && !isRadar && hour >= times.length - 1) setHour(nowIndex);
              setPlaying(!playing);
            }}
            aria-label={playing ? 'Pause' : 'Play'}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-uplift text-page shadow-lg transition active:scale-95"
          >
            {playing ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="ml-0.5 h-4 w-4" aria-hidden />}
          </button>
          <input
            type="range"
            min={0}
            max={count - 1}
            value={index}
            onChange={(e) => {
              setPlaying(false);
              const i = Number(e.target.value);
              if (isRadar) setRadarIndex(i);
              else setHour(i);
            }}
            aria-label={isRadar ? 'Radar time' : 'Forecast time'}
            aria-valuetext={`${timeText} ${sub}`}
            className="min-w-0 flex-1 accent-uplift"
          />
          <span className="w-[5.25rem] shrink-0 text-right leading-tight">
            <span className="block text-xs font-bold tabular-nums">{timeText}</span>
            <span className="block text-[0.6875rem] text-muted">
              {status.state === 'loading' ? <Loader2 className="ml-auto inline h-3 w-3 animate-spin" aria-label="Updating" /> : sub}
            </span>
          </span>
        </div>
      )}

      {isRadar ? (
        <p className="px-1 text-[0.6875rem] leading-snug text-muted">Rain seen by radar in the last 2 hours. Brighter is heavier. Detail is coarse when zoomed in close.</p>
      ) : (
        <Legend mode={mode} />
      )}
    </div>
  );
}

function Legend({ mode }: { mode: Exclude<WeatherMode, 'radar'> }) {
  const { scale, ticks, unit, note } = LEGENDS[mode];
  return (
    <div className="flex flex-col gap-1 px-1">
      <div className="h-2 rounded-full" style={{ background: `linear-gradient(to right, ${ticks.map((t) => cssColor(scale, t).replace(/,[\d.]+\)$/, ',1)')).join(', ')})` }} aria-hidden />
      <div className="flex justify-between text-[0.625rem] font-semibold tabular-nums text-ink-soft" aria-hidden>
        {ticks.map((t, i) => (
          <span key={t}>
            {t}
            {i === ticks.length - 1 ? `+ ${unit}` : ''}
          </span>
        ))}
      </div>
      <p className="text-[0.6875rem] leading-snug text-muted">{note}. Tap the map for the forecast there.</p>
    </div>
  );
}

const CODE_ICON = (code: number): LucideIcon =>
  code === 0 ? Sun : code <= 2 ? CloudSun : code === 3 ? Cloud : code <= 48 ? CloudFog : code <= 57 ? CloudDrizzle : code >= 95 ? CloudLightning : CloudRain;

const ALERT_TONE = { red: 'border-status-out/60 bg-status-out/10', orange: 'border-uplift/60 bg-uplift/10', yellow: 'border-status-low/50 bg-status-low/10' } as const;

/** Forecast for one spot: now, warnings, the next 24 hours; with `days`, the week ahead too. */
export function SpotForecastView({ lat, lng, days = false }: { lat: number; lng: number; days?: boolean }) {
  const [state, setState] = useState<{ status: 'loading' } | { status: 'ready'; data: SpotForecast } | { status: 'error'; message: string }>({ status: 'loading' });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const ctl = new AbortController();
    setState({ status: 'loading' });
    fetchSpot(lat, lng, ctl.signal)
      .then((data) => setState({ status: 'ready', data }))
      .catch((e: unknown) => !ctl.signal.aborted && setState({ status: 'error', message: e instanceof WeatherBusyError ? e.message : 'The forecast could not be loaded. Check the connection.' }));
    return () => ctl.abort();
  }, [lat, lng, retry]);

  if (state.status === 'loading')
    return (
      <p className="flex items-center gap-2 text-xs text-muted">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Loading the forecast…
      </p>
    );
  if (state.status === 'error')
    return (
      <p className="flex items-center gap-2 text-xs text-ink-soft">
        <span className="flex-1">{state.message}</span>
        <button type="button" className="btn-ghost min-h-8 px-2.5 text-xs" onClick={() => setRetry((n) => n + 1)}>
          <RotateCw className="h-3.5 w-3.5" aria-hidden /> Retry
        </button>
      </p>
    );

  const f = state.data;
  const NowIcon = CODE_ICON(f.current.code);
  const alerts = spotAlerts(f);
  const every3 = f.hourly.filter((_, i) => i % 3 === 0).slice(0, 8);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <NowIcon className="h-10 w-10 shrink-0 text-uplift" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="flex items-baseline gap-2">
            <strong className="text-2xl font-bold tabular-nums">{Math.round(f.current.temp)}°</strong>
            <span className="text-sm font-semibold">{weatherLabel(f.current.code)}</span>
          </p>
          <p className="text-xs text-muted">
            Feels like {Math.round(f.current.feelsLike)}° · Humidity {Math.round(f.current.humidity)}%
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <p className="flex items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2">
          <Wind className="h-4 w-4 shrink-0 text-sky-300" aria-hidden />
          <span>
            <strong className="tabular-nums">{Math.round(f.current.wind)} km/h</strong> from {compass(f.current.windFrom)}
            <span className="block text-muted">gusts {Math.round(f.current.gusts)} km/h</span>
          </span>
        </p>
        <p className="flex items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2">
          <Umbrella className="h-4 w-4 shrink-0 text-sky-300" aria-hidden />
          <span>
            <strong className="tabular-nums">{f.hourly[0]?.rainChance ?? 0}%</strong> chance of rain
            <span className="block text-muted">{f.current.rain > 0 ? `${f.current.rain.toFixed(1)} mm now` : 'none right now'}</span>
          </span>
        </p>
      </div>

      {alerts.map((a) => (
        <p key={a.text} className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs ${ALERT_TONE[a.level]}`} role="note">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {a.text}
        </p>
      ))}

      <div>
        <h4 className="mb-1.5 text-xs font-semibold text-ink-soft">Next 24 hours</h4>
        <ol className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
          {every3.map((h) => {
            const Icon = CODE_ICON(h.code);
            return (
              <li key={h.time} className="flex flex-col items-center gap-0.5 rounded-xl bg-white/[0.03] px-1 py-2 text-center">
                <span className="text-[0.6875rem] text-muted">{hourLabel(h.time)}</span>
                <Icon className="h-4 w-4 text-ink-soft" aria-label={weatherLabel(h.code)} />
                <span className="text-sm font-bold tabular-nums">{Math.round(h.temp)}°</span>
                <span className="text-[0.6875rem] tabular-nums text-sky-300">{h.rainChance}%</span>
                <span className="text-[0.6875rem] tabular-nums text-muted">{Math.round(h.wind)} km/h</span>
              </li>
            );
          })}
        </ol>
      </div>

      {days && (
        <div>
          <h4 className="mb-1.5 text-xs font-semibold text-ink-soft">Next 7 days</h4>
          <ul className="flex flex-col divide-y divide-line/60">
            {f.daily.map((d) => {
              const Icon = CODE_ICON(d.code);
              return (
                <li key={d.time} className="flex items-center gap-3 py-2 text-sm">
                  <span className="w-[5.5rem] shrink-0 text-xs text-ink-soft">{weekday(d.time)}</span>
                  <Icon className="h-4 w-4 shrink-0 text-ink-soft" aria-label={weatherLabel(d.code)} />
                  <span className="min-w-0 flex-1 text-xs text-muted">
                    <span className="text-sky-300">{d.rainChance}%</span> · {d.rain.toFixed(d.rain < 10 ? 1 : 0)} mm<span className="hidden sm:inline"> · gusts {Math.round(d.gusts)} km/h</span>
                  </span>
                  <span className="shrink-0 tabular-nums">
                    <strong>{Math.round(d.max)}°</strong> <span className="text-muted">{Math.round(d.min)}°</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <p className="text-[0.6875rem] leading-snug text-muted">
        Forecast by{' '}
        <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer" className="underline">
          Open-Meteo
        </a>
        , updated hourly. For official warnings, follow{' '}
        <a href="https://www.pagasa.dost.gov.ph/" target="_blank" rel="noopener noreferrer" className="underline">
          PAGASA
        </a>
        .
      </p>
    </div>
  );
}

/** Tapped a spot on the map with the weather on: the full forecast there. */
export function SpotSheet({ lat, lng, near, onClose }: { lat: number; lng: number; near?: string; onClose: () => void }) {
  return (
    <Sheet open onClose={onClose} title="Weather here" subtitle={near ? `Near ${near} · ${formatLatLng({ lat, lng })}` : formatLatLng({ lat, lng })}>
      <SpotForecastView lat={lat} lng={lng} days />
    </Sheet>
  );
}
