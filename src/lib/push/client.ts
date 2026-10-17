/**
 * The phone side of notifications. Browser-only.
 */

export type PhoneState =
  /** This browser has no web push, such as Safari on an iPhone outside the Home Screen. */
  | "unsupported"
  /** iPhone and iPad allow notifications only from the Home Screen app. */
  | "needs-home-screen"
  | "blocked"
  | "off"
  | "on";

const isAppleMobile = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const standalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** An iPhone or iPad with Tailhelm open in the browser rather than from the Home Screen: no notifications reach it. */
export const needsHomeScreen = () => isAppleMobile() && !standalone();

/** Notifications blocked for Tailhelm on a phone, or in the Home Screen app. A computer's browser is left alone. */
export const blockedHere = () => "Notification" in window && Notification.permission === "denied" && (standalone() || isPhone());

/** Whether this is a phone or tablet rather than a computer, for the words. */
export const isPhone = () => isAppleMobile() || /Android|Mobile/.test(navigator.userAgent);

export async function phoneState(): Promise<{ state: PhoneState; subscription: PushSubscription | null }> {
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!supported) return { state: isAppleMobile() && !standalone() ? "needs-home-screen" : "unsupported", subscription: null };
  if (Notification.permission === "denied") return { state: "blocked", subscription: null };
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = (await registration?.pushManager.getSubscription()) ?? null;
  return { state: subscription && Notification.permission === "granted" ? "on" : "off", subscription };
}

/** Asks the phone for permission and subscribes it. Must run from a tap. */
export async function subscribePhone(publicKey: string): Promise<PushSubscription | null> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;
  await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;
  return registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(publicKey) });
}

/** Stops notifications on this phone, for example when signing out. Returns the address it had, if any. */
export async function unsubscribePhone(): Promise<string | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const registration = await navigator.serviceWorker.getRegistration("/");
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return null;
    await subscription.unsubscribe();
    return subscription.endpoint;
  } catch (error) {
    console.error("[push] could not unsubscribe", error);
    return null;
  }
}

/** What the server needs to reach this phone. */
export function subscriptionParts(subscription: PushSubscription) {
  const json = subscription.toJSON();
  return { endpoint: subscription.endpoint, p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" };
}

export function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = (value + "=".repeat((4 - (value.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}
