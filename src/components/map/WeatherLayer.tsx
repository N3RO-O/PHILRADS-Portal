import { useEffect, useRef } from 'react';
import { Pane, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { colorAt, edgeFade, RAIN_SCALE, sample, TEMP_SCALE, WIND_SCALE, type RadarFrame, type WeatherGrid, type WeatherMode } from '../../services/weather/weather';

export interface WeatherView {
  mode: WeatherMode;
  grid: WeatherGrid | null;
  hour: number;
  radar: RadarFrame[];
  radarIndex: number;
}

const ATTRIBUTION = 'Weather <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a>';
const RADAR_ATTRIBUTION = 'Radar <a href="https://www.rainviewer.com/" target="_blank" rel="noopener">RainViewer</a>';
const RADAR_COVERAGE = 'https://tilecache.rainviewer.com/v2/coverage/0/256/{z}/{x}/{y}/0/0_0.png';

/** Weather drawn under the pins: colours, moving wind lines, clouds and rain, or radar. */
export function WeatherLayer({ view }: { view: WeatherView }) {
  return (
    <Pane name="weather" style={{ zIndex: 350, pointerEvents: 'none' }}>
      {view.mode === 'radar' ? <Radar frames={view.radar} index={view.radarIndex} /> : <Field grid={view.grid} hour={view.hour} mode={view.mode} />}
    </Pane>
  );
}

/**
 * Radar: every frame stays loaded (hidden) so playing them back doesn't flicker. The free radar
 * stops at zoom 7, so closer in its pixels are blurred smooth instead of showing as blocks. A faint
 * wash shows where radar reaches (Luzon and parts of the Visayas, not most of Mindanao).
 */
function Radar({ frames, index }: { frames: RadarFrame[]; index: number }) {
  const map = useMap();
  useEffect(() => {
    const pane = map.getPane('weather')!;
    const smooth = () => {
      const blowUp = 2 ** Math.max(0, map.getZoom() - 7);
      pane.style.filter = blowUp > 1 ? `blur(${Math.min(14, blowUp * 0.45).toFixed(1)}px)` : '';
    };
    smooth();
    map.on('zoomend', smooth);
    return () => {
      map.off('zoomend', smooth);
      pane.style.filter = '';
    };
  }, [map]);
  return (
    <>
      <TileLayer url={RADAR_COVERAGE} pane="weather" opacity={0.07} maxNativeZoom={7} maxZoom={19} />
      {frames.map((f, i) => (
        <TileLayer key={f.url} url={f.url} pane="weather" opacity={i === index ? 0.9 : 0} maxNativeZoom={7} maxZoom={19} attribution={RADAR_ATTRIBUTION} />
      ))}
    </>
  );
}

const SCALE = { wind: WIND_SCALE, rain: RAIN_SCALE, temp: TEMP_SCALE } as const;
const FIELD_OPACITY = { wind: 0.5, rain: 0.7, temp: 0.72 } as const;
/** Colours and clouds are drawn every N screen pixels, then smoothed up. */
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
    y: (lat: number) => ((mercY(lat) - yN) / (yS - yN)) * size.y,
    x: (lng: number) => ((lng - lngW) / lngSpan) * size.x,
  };
}

/** A tileable cloud texture (value noise, a few octaves), made once. Alpha only. */
let cloudTexture: HTMLCanvasElement | null = null;
function cloudNoise(): HTMLCanvasElement {
  if (cloudTexture) return cloudTexture;
  const N = 256;
  const lattice = (size: number) => Array.from({ length: size * size }, () => Math.random());
  const octaves = [8, 16, 32, 64].map((size) => ({ size, v: lattice(size) }));
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(N, N);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      let n = 0;
      let amp = 0.55;
      for (const o of octaves) {
        const fx = (x / N) * o.size;
        const fy = (y / N) * o.size;
        const x0 = Math.floor(fx);
        const y0 = Math.floor(fy);
        const tx = smooth(fx - x0);
        const ty = smooth(fy - y0);
        const at = (i: number, j: number) => o.v[(j % o.size) * o.size + (i % o.size)];
        const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * tx;
        const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * tx;
        n += (top + (bottom - top) * ty) * amp;
        amp /= 2;
      }
      // Puffy: thin gaps between clouds, soft edges.
      const a = Math.min(1, Math.max(0, (n - 0.3) / 0.45));
      img.data[(y * N + x) * 4 + 3] = 70 + a * 185;
    }
  ctx.putImageData(img, 0, 0);
  cloudTexture = c;
  return c;
}

type Drop = { x: number; y: number; len: number; life: number; age: number; a: number };
type Flash = { x: number; y: number; age: number; bolt: [number, number][] };

function Field({ grid, hour, mode }: { grid: WeatherGrid | null; hour: number; mode: Exclude<WeatherMode, 'radar'> }) {
  const map = useMap();
  const state = useRef({ grid, hour, mode });
  state.current = { grid, hour, mode };
  const redraw = useRef<(full: boolean) => void>(() => undefined);
  const shownMode = useRef(mode);

  useEffect(() => {
    const pane = map.getPane('weather')!;
    const make = (name: string) => {
      const c = L.DomUtil.create('canvas', name, pane);
      Object.assign(c.style, { position: 'absolute', left: '0', top: '0', pointerEvents: 'none' });
      return c;
    };
    // Clouds under the rain colours (so how heavy the rain is stays readable), drops and lines on top.
    const clouds = make('weather-clouds');
    const field = make('weather-field');
    const lines = make('weather-lines');
    const canvases = [field, clouds, lines];
    map.attributionControl?.addAttribution(ATTRIBUTION);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const lctx = lines.getContext('2d')!;
    const cctx = clouds.getContext('2d')!;
    // Cloud cover for this hour and view (white, greyer where it rains); the texture drifts across it.
    const cloudMask = document.createElement('canvas');
    let pattern: CanvasPattern | null = null;
    let drift = { x: 0, y: 0, dx: 0, dy: 0 };
    let frame = 0;
    let particles: { x: number; y: number; age: number; life: number }[] = [];
    let drops: Drop[] = [];
    let flashes: Flash[] = [];
    let stormy = false;
    let proj = projector(map);

    const hourOf = (g: WeatherGrid) => Math.min(state.current.hour, g.times.length - 1);

    const place = () => {
      proj = projector(map);
      // The pane moves with the map while dragging; put the canvases back at the screen's top-left.
      const topLeft = map.containerPointToLayerPoint([0, 0]);
      for (const c of canvases) {
        L.DomUtil.setPosition(c, topLeft);
        c.style.width = `${proj.w}px`;
        c.style.height = `${proj.h}px`;
      }
      lines.width = Math.round(proj.w * dpr);
      lines.height = Math.round(proj.h * dpr);
      clouds.width = cloudMask.width = Math.ceil(proj.w / CELL);
      clouds.height = cloudMask.height = Math.ceil(proj.h / CELL);
    };

    /** Colours (and, for rain, the cloud cover under the animation). */
    const drawField = () => {
      const { grid: g, mode: m } = state.current;
      const fw = Math.ceil(proj.w / CELL);
      const fh = Math.ceil(proj.h / CELL);
      field.width = fw;
      field.height = fh;
      field.style.opacity = String(FIELD_OPACITY[m]);
      const ctx = field.getContext('2d')!;
      const mctx = cloudMask.getContext('2d')!;
      mctx.clearRect(0, 0, fw, fh);
      if (!g || !g.times.length) return ctx.clearRect(0, 0, fw, fh);
      const t = hourOf(g);
      const layer = (m === 'wind' ? g.speed : m === 'rain' ? g.rain : g.temp)[t];
      const img = ctx.createImageData(fw, fh);
      const mask = m === 'rain' ? mctx.createImageData(fw, fh) : null;
      const lngs = Array.from({ length: fw }, (_, x) => proj.lng((x + 0.5) * CELL));
      stormy = false;
      for (let y = 0; y < fh; y++) {
        const lat = proj.lat((y + 0.5) * CELL);
        for (let x = 0; x < fw; x++) {
          const lng = lngs[x];
          const fade = edgeFade(g, lat, lng);
          if (fade === 0) continue;
          const value = sample(g, layer, lat, lng);
          const [r, gg, b, a] = colorAt(SCALE[m], value);
          const i = (y * fw + x) * 4;
          img.data[i] = r;
          img.data[i + 1] = gg;
          img.data[i + 2] = b;
          img.data[i + 3] = a * 255 * fade;
          if (mask) {
            const cover = sample(g, g.cloud[t], lat, lng) / 100;
            // Rain clouds are darker: white for fair-weather cloud, slate grey for downpours.
            const dark = Math.min(1, value / 15);
            mask.data[i] = 235 - dark * 120;
            mask.data[i + 1] = 238 - dark * 115;
            mask.data[i + 2] = 245 - dark * 100;
            mask.data[i + 3] = Math.min(1, cover * 0.95) * 255 * fade;
            if (!stormy && sample(g, g.storm[t], lat, lng) > 0.4) stormy = true;
          }
        }
      }
      ctx.putImageData(img, 0, 0);
      if (mask) mctx.putImageData(mask, 0, 0);
      // Clouds drift with the average wind in view.
      let su = 0;
      let sv = 0;
      for (let k = 0; k < g.u[t].length; k++) {
        su += g.u[t][k];
        sv += g.v[t][k];
      }
      drift.dx = (su / g.u[t].length) * 0.012;
      drift.dy = (-sv / g.v[t].length) * 0.012;
    };

    const drawClouds = () => {
      if (state.current.mode !== 'rain') return cctx.clearRect(0, 0, clouds.width, clouds.height);
      pattern ??= cctx.createPattern(cloudNoise(), 'repeat');
      cctx.globalCompositeOperation = 'copy';
      cctx.drawImage(cloudMask, 0, 0);
      cctx.globalCompositeOperation = 'destination-in';
      if (pattern) {
        pattern.setTransform(new DOMMatrix().translate(drift.x, drift.y));
        cctx.fillStyle = pattern;
        cctx.fillRect(0, 0, clouds.width, clouds.height);
      }
      cctx.globalCompositeOperation = 'source-over';
    };

    /** Temperatures written on the map, spaced out. */
    const drawLabels = () => {
      const g = state.current.grid;
      if (state.current.mode !== 'temp' || !g) return;
      const t = hourOf(g);
      lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      lctx.font = '700 12px Montserrat, system-ui, sans-serif';
      lctx.textAlign = 'center';
      lctx.textBaseline = 'middle';
      lctx.lineJoin = 'round';
      const placed: [number, number][] = [];
      for (let r = 0; r < g.rows; r++)
        for (let c = 0; c < g.cols; c++) {
          const x = proj.x(g.west + c * g.step);
          const y = proj.y(g.south + r * g.step);
          if (x < 20 || y < 20 || x > proj.w - 20 || y > proj.h - 20) continue;
          if (placed.some(([px, py]) => Math.abs(px - x) < 54 && Math.abs(py - y) < 36)) continue;
          const v = g.temp[t][r * g.cols + c];
          if (!Number.isFinite(v)) continue;
          placed.push([x, y]);
          const text = `${Math.round(v)}°`;
          lctx.lineWidth = 3.5;
          lctx.strokeStyle = 'rgba(20,21,25,0.85)';
          lctx.strokeText(text, x, y);
          lctx.fillStyle = '#fff';
          lctx.fillText(text, x, y);
        }
    };

    const rainAt = (x: number, y: number) => {
      const g = state.current.grid;
      return g ? sample(g, g.rain[hourOf(g)], proj.lat(y), proj.lng(x)) : NaN;
    };
    const velocity = (x: number, y: number): [number, number] | null => {
      const g = state.current.grid;
      if (!g) return null;
      const t = hourOf(g);
      const lat = proj.lat(y);
      const lng = proj.lng(x);
      const u = sample(g, g.u[t], lat, lng);
      if (Number.isNaN(u)) return null;
      return [u, sample(g, g.v[t], lat, lng)];
    };

    /** A raindrop where it rains: more, longer and brighter the heavier the rain. */
    const newDrop = (d: Drop) => {
      for (let tries = 0; tries < 6; tries++) {
        const x = Math.random() * proj.w;
        const y = Math.random() * proj.h;
        const mm = rainAt(x, y);
        if (!(mm > 0.1) || Math.random() > Math.min(1, mm / 6)) continue;
        const heavy = Math.min(1, mm / 15);
        Object.assign(d, { x, y, len: 5 + heavy * 9, life: 10 + Math.random() * 10, age: 0, a: 0.35 + heavy * 0.5 });
        return;
      }
      d.age = d.life = 0;
    };

    const newFlash = () => {
      const g = state.current.grid;
      if (!g) return;
      const t = hourOf(g);
      for (let tries = 0; tries < 30; tries++) {
        const x = Math.random() * proj.w;
        const y = Math.random() * proj.h;
        if (!(sample(g, g.storm[t], proj.lat(y), proj.lng(x)) > 0.5)) continue;
        const bolt: [number, number][] = [[x, y - 26]];
        for (let k = 1; k <= 5; k++) bolt.push([x + (Math.random() - 0.5) * 14, y - 26 + k * 10]);
        flashes.push({ x, y, age: 0, bolt });
        return;
      }
    };

    const reset = () => {
      lctx.setTransform(1, 0, 0, 1, 0, 0);
      lctx.clearRect(0, 0, lines.width, lines.height);
      const area = proj.w * proj.h;
      const { mode: m } = state.current;
      particles = m === 'wind' && !reduced ? Array.from({ length: Math.min(2500, Math.round(area / 650)) }, () => ({ ...spawn(), age: Math.random() * 80 })) : [];
      drops = m === 'rain' && !reduced ? Array.from({ length: Math.min(1800, Math.round(area / 300)) }, () => ({ x: 0, y: 0, len: 0, life: 0, age: 0, a: 0 })) : [];
      flashes = [];
    };
    const spawn = () => ({ x: Math.random() * proj.w, y: Math.random() * proj.h, age: 0, life: 40 + Math.random() * 60 });

    const windTick = () => {
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

    const rainTick = () => {
      drift.x += drift.dx;
      drift.y += drift.dy;
      drawClouds();
      lctx.setTransform(1, 0, 0, 1, 0, 0);
      lctx.clearRect(0, 0, lines.width, lines.height);
      lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      lctx.lineCap = 'round';
      lctx.lineWidth = 1.2;
      // Drops in a few brightness bands, one path each (fast).
      for (const band of [0.45, 0.65, 0.85]) {
        lctx.strokeStyle = `rgba(185,215,255,${band})`;
        lctx.beginPath();
        for (const d of drops) {
          if (d.a > band || d.a <= band - 0.2 || d.age >= d.life) continue;
          // Falling, slanted with the wind.
          const vel = velocity(d.x, d.y);
          const sx = vel ? vel[0] * 0.08 : 0;
          lctx.moveTo(d.x, d.y);
          lctx.lineTo(d.x - sx * d.len * 0.3, d.y + d.len);
          d.y += 2.2;
          d.x += sx;
        }
        lctx.stroke();
      }
      for (const d of drops) if (++d.age >= d.life) newDrop(d);
      // Thunderstorms: now and then a flash and a bolt.
      if (stormy && flashes.length < 2 && Math.random() < 0.025) newFlash();
      flashes = flashes.filter((f) => f.age < 14);
      for (const f of flashes) {
        const k = 1 - f.age / 14;
        const glow = lctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 60);
        glow.addColorStop(0, `rgba(255,255,230,${0.55 * k})`);
        glow.addColorStop(1, 'rgba(255,255,230,0)');
        lctx.fillStyle = glow;
        lctx.fillRect(f.x - 60, f.y - 60, 120, 120);
        if (f.age < 6) {
          lctx.strokeStyle = `rgba(255,250,200,${k})`;
          lctx.lineWidth = 2;
          lctx.beginPath();
          f.bolt.forEach(([x, y], i) => (i ? lctx.lineTo(x, y) : lctx.moveTo(x, y)));
          lctx.stroke();
        }
        f.age++;
      }
    };

    const tick = () => {
      frame = requestAnimationFrame(tick);
      if (state.current.mode === 'rain') rainTick();
      else windTick();
    };

    /** Reduced motion: still arrows for wind, still clouds for rain. */
    const drawStill = () => {
      lctx.setTransform(1, 0, 0, 1, 0, 0);
      lctx.clearRect(0, 0, lines.width, lines.height);
      drawClouds();
      if (state.current.mode !== 'wind') return;
      lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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

    /** Whatever doesn't move: still drawings, or temperature numbers. */
    const drawStatic = () => {
      if (reduced) drawStill();
      else if (state.current.mode === 'temp') {
        lctx.setTransform(1, 0, 0, 1, 0, 0);
        lctx.clearRect(0, 0, lines.width, lines.height);
        drawClouds();
      }
      drawLabels();
    };

    const start = () => {
      cancelAnimationFrame(frame);
      place();
      drawField();
      for (const c of canvases) c.style.visibility = 'visible';
      clouds.style.opacity = '0.8';
      reset();
      drawStatic();
      if (!reduced && (particles.length || drops.length)) frame = requestAnimationFrame(tick);
    };
    const hide = () => {
      cancelAnimationFrame(frame);
      for (const c of canvases) c.style.visibility = 'hidden';
    };
    // A new hour or new data repaints in place (moving lines carry on); a new view type starts over.
    redraw.current = (full) => {
      if (full) return start();
      drawField();
      drawStatic();
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
      for (const c of canvases) c.remove();
    };
  }, [map]);

  // New data, hour or view type: redraw in place.
  useEffect(() => {
    redraw.current(shownMode.current !== mode);
    shownMode.current = mode;
  }, [grid, hour, mode]);
  return null;
}
