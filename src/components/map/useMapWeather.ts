import { useCallback, useEffect, useRef, useState } from 'react';
import {
  checkRadar,
  covers,
  currentHourIndex,
  fetchGrid,
  fetchRadar,
  gridAreaFor,
  WeatherBusyError,
  type GridArea,
  type RadarCheck,
  type RadarFrame,
  type WeatherGrid,
  type WeatherMode,
} from '../../services/weather/weather';

const MODE_KEY = 'philrads.map.weather';
const readMode = (): WeatherMode | null => {
  try {
    const m = localStorage.getItem(MODE_KEY);
    return m === 'wind' || m === 'rain' || m === 'temp' || m === 'radar' ? m : null;
  } catch {
    return null;
  }
};

export type WeatherStatus = { state: 'idle' | 'loading' | 'ready' } | { state: 'error'; message: string };

/** The Live Map's weather: which view is on (remembered on this device), its data for the area in view, and the timeline. */
export function useMapWeather(online: boolean) {
  const [mode, setModeState] = useState<WeatherMode | null>(readMode);
  const [view, setView] = useState<(GridArea & { zoom: number }) | null>(null);
  const [grid, setGrid] = useState<WeatherGrid | null>(null);
  const gridArea = useRef<(GridArea & { step: number }) | null>(null);
  const [status, setStatus] = useState<WeatherStatus>({ state: 'idle' });
  const [retry, setRetry] = useState(0);
  /** The forecast hour being shown (unix seconds), kept when new data for another area arrives. */
  const [hourTime, setHourTime] = useState<number | null>(null);
  const [radar, setRadar] = useState<RadarFrame[]>([]);
  const [radarIndex, setRadarIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  /** Radar in the area in view right now: rain, nothing, or out of the radars' reach (null: checking). */
  const [radarCheck, setRadarCheck] = useState<RadarCheck | null>(null);

  const setMode = useCallback((m: WeatherMode | null) => {
    setModeState(m);
    setPlaying(false);
    try {
      if (m) localStorage.setItem(MODE_KEY, m);
      else localStorage.removeItem(MODE_KEY);
    } catch {
      /* per-device preference only */
    }
  }, []);

  // Forecast grid for the area in view: fetched again only when the view leaves it or zooms a lot.
  useEffect(() => {
    if (!mode || mode === 'radar' || !view || !online) return;
    const want = gridAreaFor(view);
    const have = gridArea.current;
    if (have && have.step === want.step && covers(have, view)) return;
    const ctl = new AbortController();
    const t = setTimeout(() => {
      setStatus({ state: 'loading' });
      fetchGrid(want, ctl.signal)
        .then((g) => {
          gridArea.current = want;
          setGrid(g);
          setStatus({ state: 'ready' });
        })
        .catch((e: unknown) => {
          if (ctl.signal.aborted) return;
          setStatus({ state: 'error', message: e instanceof WeatherBusyError ? e.message : 'The weather could not be loaded. Check the connection and try again.' });
        });
    }, 350);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [mode, view, online, retry]);

  // Radar frames: the latest list, refreshed every 10 minutes while radar is on.
  useEffect(() => {
    if (mode !== 'radar' || !online) return;
    const ctl = new AbortController();
    const load = () => {
      setStatus((s) => (s.state === 'ready' ? s : { state: 'loading' }));
      fetchRadar(ctl.signal)
        .then((frames) => {
          setRadar(frames);
          setRadarIndex(frames.length - 1);
          setStatus({ state: 'ready' });
        })
        .catch(() => !ctl.signal.aborted && setStatus({ state: 'error', message: 'The radar could not be loaded. Check the connection and try again.' }));
    };
    load();
    const t = setInterval(load, 10 * 60_000);
    return () => {
      clearInterval(t);
      ctl.abort();
    };
  }, [mode, online, retry]);

  // Radar: check the latest picture for the area in view, so an empty map can say why.
  const latest = radar[radar.length - 1];
  useEffect(() => {
    if (mode !== 'radar' || !latest || !view) return;
    let live = true;
    setRadarCheck(null);
    const t = setTimeout(() => {
      checkRadar(latest, view, view.zoom)
        .then((r) => live && setRadarCheck(r))
        .catch(() => live && setRadarCheck(null));
    }, 400);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [mode, latest, view]);

  const times = grid?.times ?? [];
  let hour = currentHourIndex(times);
  if (hourTime != null && times.length) {
    const i = times.findIndex((t) => t >= hourTime);
    hour = i === -1 ? times.length - 1 : i;
  }
  const setHour = useCallback((i: number) => setHourTime(times[i] ?? null), [times]);

  // Play: forecast hour by hour (stops at the end); radar loops, resting on the latest frame.
  useEffect(() => {
    if (!playing) return;
    if (mode === 'radar') {
      let rest = 0;
      const t = setInterval(() => {
        setRadarIndex((i) => {
          if (i < radar.length - 1) return i + 1;
          if (++rest < 3) return i;
          rest = 0;
          return 0;
        });
      }, 500);
      return () => clearInterval(t);
    }
    const t = setTimeout(() => {
      if (hour >= times.length - 1) setPlaying(false);
      else setHourTime(times[hour + 1]);
    }, 650);
    return () => clearTimeout(t);
  }, [playing, mode, radar.length, hour, times]);

  return {
    mode,
    setMode,
    setView,
    grid,
    times,
    hour,
    setHour,
    nowIndex: currentHourIndex(times),
    radar,
    radarIndex,
    setRadarIndex,
    radarCheck,
    playing,
    setPlaying,
    status: online || !mode ? status : ({ state: 'error', message: 'The weather needs an internet connection.' } as WeatherStatus),
    retry: () => setRetry((n) => n + 1),
  };
}

export type MapWeather = ReturnType<typeof useMapWeather>;
