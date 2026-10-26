import { useEffect, useRef } from 'react';
import { Pane, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { colorAt, RAIN_SCALE, sample, TEMP_SCALE, WIND_SCALE, type RadarFrame, type WeatherGrid, type WeatherMode } from '../../services/weather/weather';

export interface WeatherView {
  mode: WeatherMode;
  grid: WeatherGrid | null;
  hour: number;
  radar: RadarFrame[];
  radarIndex: number;
}

const ATTRIBUTION = 'Weather <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a>';
const RADAR_ATTRIBUTION = 'Radar <a href="https://www.rainviewer.com/" target="_blank" rel="noopener">RainViewer</a>';

/** Weather drawn under the pins: a colour field, moving wind lines, or radar. */
export function WeatherLayer({ view }: { view: WeatherView }) {
  return (
    <Pane name="weather" style={{ zIndex: 350, pointerEvents: 'none' }}>
      {view.mode === 'radar' ? <Radar frames={view.radar} index={view.radarIndex} /> : <Field grid={view.grid} hour={view.hour} mode={view.mode} />}
    </Pane>
  );
}

/** Every radar frame stays loaded (hidden) so playing them back doesn't flicker. Detail stops at zoom 7. */
function Radar({ frames, index }: { frames: RadarFrame[]; index: number }) {
  return (
    <>
      {frames.map((f, i) => (
        <TileLayer
          key={f.url}
          url={f.url}
          pane="weather"
          opacity={i === index ? 0.8 : 0}
          maxNativeZoom={7}
          maxZoom={19}
          attribution={RADAR_ATTRIBUTION}
        />
      ))}
    </>
  );
}

const SCALE = { wind: WIND_SCALE, rain: RAIN_SCALE, temp: TEMP_SCALE } as const;
const FIELD_OPACITY = { wind: 0.5, rain: 0.85, temp: 0.5 } as const;
/** Field drawn every N screen pixels, then smoothed up. */
const CELL = 4;

const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const unMercY = (y: number) => (360 / Math.PI) * Math.atan(Math.exp(y)) - 90;

/** Screen point → lat/lng without asking Leaflet per pixel (Web Mercator is linear in x and in mercator y). */
function projector(map: L.Map) {
  const size = map.getSize();
  const nw = map.containerPointToLatLng([0, 0]);
  const se = map.containerPointToLatLng([size.x, size.y]);
  const yN = mercY(nw.lat);
  const yS = mercY(se.lat);
  const lngW = nw.lng;
  const lngSpan = se.lng - nw.lng;
  return {
    w: size.x,
    h: size.y,
    lat: (py: number) => unMercY(yN + ((yS - yN) * py) / size.y),
    lng: (px: number) => lngW + (lngSpan * px) / size.x,
  };
}

function Field({ grid, hour, mode }: { grid: WeatherGrid | null; hour: number; mode: Exclude<WeatherMode, 'radar'> }) {
  const map = useMap();
  const state = useRef({ grid, hour, mode });
  state.current = { grid, hour, mode };
  const redraw = useRef<(full: boolean) => void>(() => undefined);
  const shownMode = useRef(mode);

  useEffect(() => {
    const pane = map.getPane('weather')!;
    const field = L.DomUtil.create('canvas', 'weather-field', pane);
    const lines = L.DomUtil.create('canvas', 'weather-lines', pane);
    for (const c of [field, lines]) Object.assign(c.style, { position: 'absolute', left: '0', top: '0', pointerEvents: 'none' });
    field.style.imageRendering = 'auto';
    map.attributionControl?.addAttribution(ATTRIBUTION);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const lctx = lines.getContext('2d')!;
    let frame = 0;
    let particles: { x: number; y: number; age: number; life: number }[] = [];
    let proj = projector(map);

    const place = () => {
      proj = projector(map);
      // The pane moves with the map while dragging; put the canvases back at the screen's top-left.
      const topLeft = map.containerPointToLayerPoint([0, 0]);
      L.DomUtil.setPosition(field, topLeft);
      L.DomUtil.setPosition(lines, topLeft);
      field.style.width = lines.style.width = `${proj.w}px`;
      field.style.height = lines.style.height = `${proj.h}px`;
      lines.width = Math.round(proj.w * dpr);
      lines.height = Math.round(proj.h * dpr);
    };

    const drawField = () => {
      const { grid: g, hour: t, mode: m } = state.current;
      const fw = Math.ceil(proj.w / CELL);
      const fh = Math.ceil(proj.h / CELL);
      field.width = fw;
      field.height = fh;
      field.style.opacity = String(FIELD_OPACITY[m]);
      const ctx = field.getContext('2d')!;
      if (!g || !g.times.length) return ctx.clearRect(0, 0, fw, fh);
      const layer = (m === 'wind' ? g.speed : m === 'rain' ? g.rain : g.temp)[Math.min(t, g.times.length - 1)];
      const img = ctx.createImageData(fw, fh);
      const lngs = Array.from({ length: fw }, (_, x) => proj.lng((x + 0.5) * CELL));
      for (let y = 0; y < fh; y++) {
        const lat = proj.lat((y + 0.5) * CELL);
        for (let x = 0; x < fw; x++) {
          const [r, gg, b, a] = colorAt(SCALE[m], sample(g, layer, lat, lngs[x]));
          const i = (y * fw + x) * 4;
          img.data[i] = r;
          img.data[i + 1] = gg;
          img.data[i + 2] = b;
          img.data[i + 3] = a * 255;
        }
      }
      ctx.putImageData(img, 0, 0);
    };

    const spawn = () => ({ x: Math.random() * proj.w, y: Math.random() * proj.h, age: 0, life: 40 + Math.random() * 60 });
    const resetParticles = () => {
      lctx.setTransform(1, 0, 0, 1, 0, 0);
      lctx.clearRect(0, 0, lines.width, lines.height);
      const count = state.current.mode === 'wind' && !reduced ? Math.min(2500, Math.round((proj.w * proj.h) / 650)) : 0;
      particles = Array.from({ length: count }, () => ({ ...spawn(), age: Math.random() * 80 }));
    };

    const velocity = (x: number, y: number): [number, number] | null => {
      const g = state.current.grid;
      if (!g) return null;
      const t = Math.min(state.current.hour, g.times.length - 1);
      const lat = proj.lat(y);
      const lng = proj.lng(x);
      const u = sample(g, g.u[t], lat, lng);
      if (Number.isNaN(u)) return null;
      return [u, sample(g, g.v[t], lat, lng)];
    };

    const tick = () => {
      frame = requestAnimationFrame(tick);
      // Fade the old trails, then draw each line one step further.
      lctx.setTransform(1, 0, 0, 1, 0, 0);
      lctx.globalCompositeOperation = 'destination-in';
      lctx.fillStyle = 'rgba(0,0,0,0.92)';
      lctx.fillRect(0, 0, lines.width, lines.height);
      lctx.globalCompositeOperation = 'source-over';
      lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      lctx.strokeStyle = 'rgba(255,255,255,0.85)';
      lctx.lineWidth = 1.1;
      lctx.beginPath();
      for (const p of particles) {
        const vel = p.age < p.life ? velocity(p.x, p.y) : null;
        if (!vel) {
          Object.assign(p, spawn());
          continue;
        }
        // About 0.2 px per frame for each m/s: a 10 m/s wind crosses the screen in a few seconds.
        const nx = p.x + vel[0] * 0.2;
        const ny = p.y - vel[1] * 0.2;
        lctx.moveTo(p.x, p.y);
        lctx.lineTo(nx, ny);
        p.x = nx;
        p.y = ny;
        p.age++;
        if (nx < 0 || ny < 0 || nx > proj.w || ny > proj.h) p.age = p.life;
      }
      lctx.stroke();
    };

    /** Reduced motion: still arrows instead of moving lines. */
    const drawArrows = () => {
      lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      lctx.clearRect(0, 0, proj.w, proj.h);
      if (state.current.mode !== 'wind') return;
      lctx.strokeStyle = 'rgba(255,255,255,0.8)';
      lctx.lineWidth = 1.3;
      for (let y = 30; y < proj.h; y += 56)
        for (let x = 30; x < proj.w; x += 56) {
          const vel = velocity(x, y);
          if (!vel) continue;
          const len = Math.hypot(vel[0], vel[1]);
          if (len < 0.3) continue;
          const dx = (vel[0] / len) * 12;
          const dy = (-vel[1] / len) * 12;
          lctx.beginPath();
          lctx.moveTo(x - dx, y - dy);
          lctx.lineTo(x + dx, y + dy);
          lctx.lineTo(x + dx - dx * 0.4 - dy * 0.3, y + dy - dy * 0.4 + dx * 0.3);
          lctx.moveTo(x + dx, y + dy);
          lctx.lineTo(x + dx - dx * 0.4 + dy * 0.3, y + dy - dy * 0.4 - dx * 0.3);
          lctx.stroke();
        }
    };

    const start = () => {
      cancelAnimationFrame(frame);
      place();
      drawField();
      field.style.visibility = lines.style.visibility = 'visible';
      if (reduced) return drawArrows();
      resetParticles();
      if (particles.length) frame = requestAnimationFrame(tick);
    };
    const hide = () => {
      cancelAnimationFrame(frame);
      field.style.visibility = lines.style.visibility = 'hidden';
    };
    // A new hour or new data only repaints the colours (the moving lines carry on); a new view type starts over.
    redraw.current = (full) => {
      if (full) return start();
      drawField();
      if (reduced) drawArrows();
    };
    map.on('zoomstart', hide);
    map.on('moveend', start);
    map.on('resize', start);
    start();
    return () => {
      cancelAnimationFrame(frame);
      map.off('zoomstart', hide);
      map.off('moveend', start);
      map.off('resize', start);
      map.attributionControl?.removeAttribution(ATTRIBUTION);
      field.remove();
      lines.remove();
    };
  }, [map]);

  // New data, hour or view type: redraw in place.
  useEffect(() => {
    redraw.current(shownMode.current !== mode);
    shownMode.current = mode;
  }, [grid, hour, mode]);
  return null;
}
