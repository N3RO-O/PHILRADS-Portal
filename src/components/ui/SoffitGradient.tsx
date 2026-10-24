import { useEffect, useRef } from 'react';
import fragmentSource from './soffit.frag.glsl?raw';

/**
 * "Soffit": an animated WebGL2 gradient. One fullscreen triangle and one fragment shader do all the work;
 * per frame the CPU only eases the pointer, uploads iTime / iMouse and issues one drawArrays.
 * Recolour or retune it through CONFIG only — never by editing the shader.
 */
const CONFIG = {
  bgColor: '#7a1710',
  colorA: '#e8342b',
  colorB: '#ff6b5a',
  colorC: '#ffb3a4',
  colorD: '#ffffff',
  ambient: 0.16,
  amount: 0.47,
  bounce: 0.64,
  bounceCurve: 2.2,
  breathe: 0.12,
  contrast: 2.98,
  cursor: 1,
  curve: 3.14,
  direct: 0.6,
  dither: 1.11,
  flow: 0.2,
  glow: 0.29,
  grain: 0,
  grainAnim: 0,
  horizon: 0.15,
  lacunarity: 2.23,
  lift: 0.09,
  maxDpr: 1,
  midpoint: 0.78,
  moteScale: 18,
  motes: 0.074,
  parallax: 0.01,
  rock: 0.3,
  roughness: 0.53,
  scale: 0.2,
  sink: 0.1,
  speed: 0.33,
  spillCentre: 0.12,
  spillFloor: 0.66,
  spillWidth: 1.91,
  spread: -2.03,
  steer: -0.24,
  sweep: 0.32,
  tilt: 2.96,
  vignette: 0.07,
  warp: 2.83,
  warpScale: 1.2,
} as const;

/** Pointer easing: the lead chases the pointer, the body chases the lead. */
const LEAD = 0.105;
const BODY = 0.043;
/** Frame interval clamp in ms (240 fps … 20 fps); the shader clock advances by the clamped interval. */
const MIN_FRAME = 4.167;
const MAX_FRAME = 50;

const VERTEX_SOURCE = `#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

/** `u` + capitalised key; the shader names the background colour `uBg`. */
const uniformName = (key: string) => (key === 'bgColor' ? 'uBg' : `u${key[0].toUpperCase()}${key.slice(1)}`);

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    if (import.meta.env.DEV) console.warn('Soffit shader:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

interface Renderer {
  resize(width: number, height: number): void;
  draw(time: number, mouseX: number, mouseY: number): void;
  dispose(): void;
}

function createRenderer(gl: WebGL2RenderingContext): Renderer | null {
  const vs = compile(gl, gl.VERTEX_SHADER, VERTEX_SOURCE);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  const vao = gl.createVertexArray();
  const release = () => {
    gl.deleteVertexArray(vao);
    gl.deleteProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
  };
  if (!vs || !fs || !program || !vao) {
    release();
    return null;
  }
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    if (import.meta.env.DEV) console.warn('Soffit program:', gl.getProgramInfoLog(program));
    release();
    return null;
  }
  gl.useProgram(program);
  gl.bindVertexArray(vao);

  for (const [key, value] of Object.entries(CONFIG)) {
    const loc = gl.getUniformLocation(program, uniformName(key));
    if (!loc) continue;
    if (typeof value === 'string') gl.uniform3f(loc, ...hexToRgb(value));
    else gl.uniform1f(loc, value);
  }

  const uResolution = gl.getUniformLocation(program, 'iResolution');
  const uTime = gl.getUniformLocation(program, 'iTime');
  const uMouse = gl.getUniformLocation(program, 'iMouse');

  return {
    resize(width, height) {
      gl.viewport(0, 0, width, height);
      gl.uniform2f(uResolution, width, height);
    },
    draw(time, mouseX, mouseY) {
      gl.uniform1f(uTime, time);
      gl.uniform2f(uMouse, mouseX, mouseY);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose: release,
  };
}

/**
 * Fills its positioned parent with the Soffit gradient. Decorative: hidden from assistive tech and
 * click-through. Falls back to the plain background colour when WebGL2 is unavailable, draws a single
 * still frame for reduced-motion users, and pauses whenever it is off-screen or the tab is hidden.
 */
export function SoffitGradient({ className = '' }: { className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: 'low-power',
    });
    if (!gl) return;

    let renderer = createRenderer(gl);
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let visible = false;
    let raf = 0;
    let last = -1;
    let clock = 0;
    let width = 0;
    let height = 0;
    let pendingSize: { width: number; height: number } | null = null;
    // Pointer in the shader's uv units (aspect-corrected, origin at the centre); (0, 0) is the rest position.
    const target = { x: 0, y: 0 };
    const lead = { x: 0, y: 0 };
    const body = { x: 0, y: 0 };

    const applyResize = () => {
      if (!pendingSize || !renderer) return;
      const dpr = Math.min(window.devicePixelRatio || 1, CONFIG.maxDpr);
      const w = Math.max(1, Math.round(pendingSize.width * dpr));
      const h = Math.max(1, Math.round(pendingSize.height * dpr));
      pendingSize = null;
      if (w === width && h === height) return;
      canvas.width = width = w;
      canvas.height = height = h;
      renderer.resize(w, h);
    };

    const frame = (now: number) => {
      raf = 0;
      if (!renderer) return;
      applyResize();
      const animate = !motion.matches;
      if (animate) {
        const ms = last < 0 ? 1000 / 60 : Math.min(MAX_FRAME, Math.max(MIN_FRAME, now - last));
        last = now;
        const s = ms > 36.7 ? 2.2 : ms * 0.06;
        clock += ms * 0.001;
        lead.x += (target.x - lead.x) * LEAD * s;
        lead.y += (target.y - lead.y) * LEAD * s;
        body.x += (lead.x - body.x) * BODY * s;
        body.y += (lead.y - body.y) * BODY * s;
      }
      renderer.draw(clock, body.x, body.y);
      if (animate && visible && !document.hidden) raf = requestAnimationFrame(frame);
    };

    /** Schedules a frame if one is due: the loop when animating, a single redraw otherwise. */
    const kick = () => {
      if (raf || !visible || document.hidden) return;
      last = -1;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    // Draw once straight away so the card never shows a blank canvas before the first frame.
    const sizeNow = () => {
      const box = wrap.getBoundingClientRect();
      pendingSize = { width: box.width, height: box.height };
      applyResize();
      renderer?.draw(clock, body.x, body.y);
    };
    sizeNow();

    const resizeObserver = new ResizeObserver(([entry]) => {
      const box = entry.contentRect;
      pendingSize = { width: box.width, height: box.height };
      kick();
    });
    resizeObserver.observe(wrap);

    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) kick();
      else stop();
    });
    intersectionObserver.observe(wrap);

    const onVisibility = () => (document.hidden ? stop() : kick());
    const onMotion = () => kick();
    const onPointer = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      target.x = ((e.clientX - rect.left) / rect.width - 0.5) * (rect.width / rect.height) * CONFIG.cursor;
      target.y = (0.5 - (e.clientY - rect.top) / rect.height) * CONFIG.cursor;
    };
    const onLost = (e: Event) => {
      e.preventDefault();
      stop();
      renderer = null;
    };
    const onRestored = () => {
      renderer = createRenderer(gl);
      width = height = 0;
      sizeNow();
      kick();
    };

    document.addEventListener('visibilitychange', onVisibility);
    motion.addEventListener('change', onMotion);
    window.addEventListener('pointermove', onPointer, { passive: true });
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);

    return () => {
      stop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      motion.removeEventListener('change', onMotion);
      window.removeEventListener('pointermove', onPointer);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      renderer?.dispose();
      renderer = null;
      // Free the context once the canvas has really left the page (a StrictMode remount reuses it).
      setTimeout(() => {
        if (!canvas.isConnected) gl.getExtension('WEBGL_lose_context')?.loseContext();
      });
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      style={{ backgroundColor: CONFIG.bgColor }}
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
