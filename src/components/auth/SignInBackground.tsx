/**
 * Behind the sign-in card: a slow-motion mosaic of PHILRADS relief work (public/brand/sign-in-background.mp4,
 * made from "PHILRADS Background.mp4": slowed to 40%, 1280×720, silent, looping forwards then back).
 * Shows a still frame instead for people who ask for less motion or for data saving, and while the video loads.
 */
export function SignInBackground() {
  const still =
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ||
      Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData));

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-page">
      {still ? (
        <img src="/brand/sign-in-background.jpg" alt="" className="h-full w-full scale-105 object-cover" />
      ) : (
        <video
          className="h-full w-full scale-105 object-cover"
          src="/brand/sign-in-background.mp4"
          poster="/brand/sign-in-background.jpg"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
        />
      )}
      {/* Darken and warm it, so the photos stay in the background and the card stays easy to read. */}
      <div className="absolute inset-0 bg-page/40" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(28,29,33,0.15)_0%,rgba(28,29,33,0.75)_85%)]" />
      <div className="absolute inset-0 bg-burgundy/25 mix-blend-multiply" />
    </div>
  );
}
