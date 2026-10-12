/**
 * Web push settings. The public key is given to each phone when it subscribes;
 * the private key signs every send and never leaves the server.
 */
export type PushConfig = { publicKey: string; privateKey: string; subject: string };

/** The address push services contact about this sender. */
export const PUSH_CONTACT = "mailto:hello@tailhelm.com";

export function vapidPublicKey(): string | null {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || null;
}

export function pushConfig(): PushConfig | null {
  const publicKey = vapidPublicKey();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  return publicKey && privateKey ? { publicKey, privateKey, subject: PUSH_CONTACT } : null;
}

/** The push service no longer knows this phone: it unsubscribed, or the browser dropped it. */
export function isGone(statusCode: number | undefined): boolean {
  return statusCode === 404 || statusCode === 410;
}
