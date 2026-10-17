/** What kind of device a saved phone is, from its browser's description, in the words an owner uses. */
export function deviceName(userAgent: string | null): string {
  const ua = userAgent ?? "";
  if (/iPhone|iPod/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android phone";
  if (/Macintosh|Windows|CrOS|Linux|X11/.test(ua)) return "computer";
  return "phone";
}
