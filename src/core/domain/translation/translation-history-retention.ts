const HISTORY_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

/** Keep the boundary day; only entries older than 90 days expire. */
export function isWithinHistoryRetention(
  createdAt: Date,
  now: number,
): boolean {
  const createdAtMs = createdAt.getTime();

  return (
    Number.isFinite(createdAtMs) && createdAtMs >= now - HISTORY_RETENTION_MS
  );
}
