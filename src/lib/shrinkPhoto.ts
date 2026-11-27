/**
 * Photos for Documentation are made smaller on the phone before they upload (PHILRADS, 2026-11-27):
 * the longest side becomes 2,560 px (sharp for reports and A4 prints), saved as JPEG. A phone photo
 * of 3 to 6 MB becomes about 1 MB, so it uploads about four times faster on mobile data.
 *
 * Only camera-style photos are touched (JPEG, HEIC, WebP): screenshots and graphics (PNG, GIF) keep
 * their sharp edges and animation. Anything the browser can't read, or that wouldn't get smaller,
 * is sent as it is. The camera's details (GPS, camera model) aren't kept in the smaller copy.
 */
export const PHOTO_LONG_SIDE = 2560;
const QUALITY = 0.85;
const SHRINKABLE = /^image\/(jpeg|jpg|pjpeg|heic|heif|webp)$/i;

/** Would this file be made smaller before upload? */
export const canShrink = (file: File) => SHRINKABLE.test(file.type);

export async function shrinkPhoto(file: File): Promise<File> {
  if (!canShrink(file) || typeof createImageBitmap !== 'function') return file;
  let img: ImageBitmap | null = null;
  try {
    // Turned the way the camera meant (EXIF orientation).
    img = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const long = Math.max(img.width, img.height);
    // Already small: nothing to gain.
    if (long <= PHOTO_LONG_SIDE && file.size < 1.5 * 1024 * 1024) return file;
    const scale = Math.min(1, PHOTO_LONG_SIDE / long);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', QUALITY));
    canvas.width = canvas.height = 0; // let the phone have the memory back
    if (!blob || blob.size >= file.size * 0.9) return file;
    const name = /\.[^.]+$/.test(file.name) ? file.name.replace(/\.[^.]+$/, '.jpg') : `${file.name}.jpg`;
    return new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified });
  } catch {
    return file; // e.g. HEIC in a browser that can't read it: Google Drive gets the original
  } finally {
    img?.close();
  }
}
