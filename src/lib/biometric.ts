/**
 * Fingerprint / face on this device (WebAuthn platform authenticator: Android fingerprint,
 * Windows Hello, Touch ID, Face ID). Used to unlock the portal quickly and to confirm a signature.
 * The check happens on the device: the portal keeps only the credential's id, per person, on
 * this device (no fingerprint or face data ever leaves the phone).
 */
const KEY = (who: string) => `philrads.biometric.${who}`;

const b64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0));
const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));

/** This device can check a fingerprint or face. */
export async function biometricAvailable(): Promise<boolean> {
  try {
    return Boolean(window.PublicKeyCredential && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()));
  } catch {
    return false;
  }
}

export function biometricSetUp(who: string): boolean {
  try {
    return Boolean(localStorage.getItem(KEY(who)));
  } catch {
    return false;
  }
}

/** Register this person's fingerprint or face on this device. Returns an error message, or null. */
export async function setUpBiometric(who: string, name: string): Promise<string | null> {
  try {
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge: random(32),
        rp: { name: 'PHILRADS Staff Portal', id: location.hostname },
        user: { id: new TextEncoder().encode(who).slice(0, 64), name, displayName: name },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
        timeout: 60_000,
        attestation: 'none',
      },
    })) as PublicKeyCredential | null;
    if (!cred) return 'Fingerprint set-up was cancelled.';
    localStorage.setItem(KEY(who), b64(cred.rawId));
    return null;
  } catch (e) {
    return (e as Error).name === 'NotAllowedError' ? 'Fingerprint set-up was cancelled.' : 'This device couldn’t set up fingerprint or face unlock.';
  }
}

/** Ask for the fingerprint or face. True when it matched. */
export async function verifyBiometric(who: string): Promise<boolean> {
  const id = (() => {
    try {
      return localStorage.getItem(KEY(who));
    } catch {
      return null;
    }
  })();
  if (!id) return false;
  try {
    const got = await navigator.credentials.get({
      publicKey: { challenge: random(32), allowCredentials: [{ type: 'public-key', id: unb64(id), transports: ['internal'] }], userVerification: 'required', timeout: 60_000, rpId: location.hostname },
    });
    return Boolean(got);
  } catch {
    return false;
  }
}

export function forgetBiometric(who: string) {
  try {
    localStorage.removeItem(KEY(who));
  } catch {
    /* nothing kept */
  }
}
