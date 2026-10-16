/**
 * Reads a key or secret from an environment variable. Keys never contain
 * spaces, so any space or line break, such as one picked up when the key was
 * pasted into a dashboard, is removed rather than sent and refused.
 */
export function cleanKey(value: string | undefined): string | undefined {
  const key = value?.replace(/\s+/g, "");
  return key || undefined;
}
