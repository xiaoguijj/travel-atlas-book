/**
 * 时间戳的本机显示（V1-06 / V1-07）.
 *
 * 存储一律是 UTC 的 ISO-8601（V1-02 冻结的 `IsoDateTime`），但给用户看的必须是他
 * 日历上的那一天、钟面上的那一点：直接 `slice(0, 10)` 取的是 UTC 的日期，
 * 本地 00:00–08:00 这一段（UTC 16:00–24:00）会把「今天」写成「昨天」。
 */

const parts = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function fields(isoDateTime: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const part of parts.formatToParts(new Date(isoDateTime))) {
    if (part.type !== 'literal') map.set(part.type, part.value);
  }
  return map;
}

/** `2026-11-22T14:54:00.000Z` → 本机日历上的 `2026-11-22`。 */
export function localDay(isoDateTime: string): string {
  const f = fields(isoDateTime);
  return `${f.get('year')}-${f.get('month')}-${f.get('day')}`;
}

/** 同一个时间戳 → 本机钟面上的 `22:54`。 */
export function localClock(isoDateTime: string): string {
  const f = fields(isoDateTime);
  return `${f.get('hour')}:${f.get('minute')}`;
}
