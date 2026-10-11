/** Ways to subscribe to the feed, from its https address. */
export function subscribeLinks(feedUrl: string): { apple: string; google: string; copy: string } {
  const webcal = feedUrl.replace(/^https?:\/\//, "webcal://");
  return {
    apple: webcal,
    google: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`,
    copy: feedUrl,
  };
}

/** A random token for the link, 32 bytes, URL-safe. */
export function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Buffer.from(bytes).toString("base64url");
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Buffer.from(digest).toString("hex");
}
