/** A walk's time as minutes, seconds and tenths, e.g. "1:23.4"; tenths are rounded down. */
export function formatDuration(ms: number): string {
  const tenths = Math.floor(ms / 100);
  const minutes = Math.floor(tenths / 600);
  const seconds = Math.floor((tenths % 600) / 10);
  return `${minutes}:${String(seconds).padStart(2, "0")}.${tenths % 10}`;
}
