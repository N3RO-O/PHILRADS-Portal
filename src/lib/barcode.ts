/**
 * Camera barcode / QR detection. Uses the browser's built-in BarcodeDetector where it exists
 * (Chrome on Android) and otherwise loads a WebAssembly decoder on demand (iPhone, desktop).
 * The decoder is served from this app (precached by the service worker), so scanning
 * keeps working offline in the field.
 */
export const SCAN_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'qr_code', 'data_matrix'] as const;

export interface Detector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}

interface NativeDetectorCtor {
  new (opts: { formats: string[] }): Detector;
  getSupportedFormats(): Promise<string[]>;
}

let cached: Promise<Detector> | null = null;

export function getDetector(): Promise<Detector> {
  cached ??= (async () => {
    const Native = (globalThis as { BarcodeDetector?: NativeDetectorCtor }).BarcodeDetector;
    if (Native) {
      try {
        const supported = await Native.getSupportedFormats();
        const formats = SCAN_FORMATS.filter((f) => supported.includes(f));
        if (formats.includes('ean_13') && formats.includes('qr_code')) return new Native({ formats });
      } catch {
        /* fall through to the WebAssembly decoder */
      }
    }
    const [{ BarcodeDetector, prepareZXingModule }, wasm] = await Promise.all([
      import('barcode-detector/ponyfill'),
      import('zxing-wasm/reader/zxing_reader.wasm?url'),
    ]);
    prepareZXingModule({
      overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasm.default : prefix + path) },
    });
    return new BarcodeDetector({ formats: [...SCAN_FORMATS] }) as unknown as Detector;
  })();
  cached.catch(() => {
    cached = null;
  });
  return cached;
}

export type CameraProblem = 'insecure' | 'unsupported' | 'denied' | 'no-camera' | 'busy' | 'failed';

export function cameraProblem(e: unknown): CameraProblem {
  const name = (e as { name?: string })?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'no-camera';
  if (name === 'NotReadableError' || name === 'AbortError') return 'busy';
  return 'failed';
}

export const CAMERA_MESSAGES: Record<CameraProblem, string> = {
  insecure: 'The camera needs a secure (https) connection.',
  unsupported: 'This browser cannot use the camera. Type the code below or use a handheld scanner.',
  denied: 'Camera access was blocked. Allow the camera for this site in your browser settings, or type the code below.',
  'no-camera': 'No camera was found on this device. Type the code below or use a handheld scanner.',
  busy: 'The camera is being used by another app. Close it and try again.',
  failed: 'The camera could not start. Type the code below instead.',
};
