import './signInBackground.css';

/**
 * Behind the sign-in card: the PHILRADS relief-work collage (public/brand/sign-in-collage.webp),
 * brought to life with CSS only (signInBackground.css), so it stays light on phones:
 * - the photo drifts and breathes slowly (a Ken Burns pan);
 * - a burgundy-to-amber wash warms it, top to bottom;
 * - a soft spotlight wanders from photo to photo, and a band of light sweeps across now and then;
 * - halftone dots, a little film grain and a vignette give it depth and keep the card easy to read.
 * People who ask for less motion get the same picture, standing still.
 */
export function SignInBackground() {
  return (
    <div aria-hidden className="sib pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <img src="/brand/sign-in-collage.webp" alt="" className="sib-photo" decoding="async" />
      <div className="sib-wash" />
      <div className="sib-glow" />
      <div className="sib-spot" />
      <div className="sib-sweep" />
      <div className="sib-dots" />
      <div className="sib-grain" />
      <div className="sib-vignette" />
    </div>
  );
}
