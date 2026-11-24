import type { LocalDate, LocalTime } from '../contracts';

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DAY_MS = 86_400_000;

function toUtcMillis(date: string): number | undefined {
  const match = DATE_PATTERN.exec(date);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const millis = Date.UTC(year, month - 1, day);
  const roundTrip = new Date(millis);
  // 用 UTC 往返比对，挡掉 2026-02-31 这类“格式对、日历不存在”的日期。
  if (
    roundTrip.getUTCFullYear() !== year ||
    roundTrip.getUTCMonth() !== month - 1 ||
    roundTrip.getUTCDate() !== day
  ) {
    return undefined;
  }
  return millis;
}

function formatUtcDate(millis: number): LocalDate {
  const date = new Date(millis);
  const year = String(date.getUTCFullYear()).padStart(4, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}` as LocalDate;
}

export function isLocalDate(value: unknown): value is LocalDate {
  return typeof value === 'string' && toUtcMillis(value) !== undefined;
}

export function isLocalTime(value: unknown): value is LocalTime {
  return typeof value === 'string' && TIME_PATTERN.test(value);
}

export function compareLocalDates(left: LocalDate, right: LocalDate): number {
  return left.localeCompare(right);
}

export function addLocalDays(date: LocalDate, days: number): LocalDate {
  const millis = toUtcMillis(date);
  if (millis === undefined) {
    throw new TypeError(`无效日期：${date}`);
  }
  return formatUtcDate(millis + days * DAY_MS);
}

/** 含首尾的日期区间；调用方需先保证日期合法且 start <= end。 */
export function enumerateDates(start: LocalDate, end: LocalDate): LocalDate[] {
  const startMillis = toUtcMillis(start);
  const endMillis = toUtcMillis(end);
  if (startMillis === undefined || endMillis === undefined || startMillis > endMillis) {
    return [];
  }
  const dates: LocalDate[] = [];
  for (let millis = startMillis; millis <= endMillis; millis += DAY_MS) {
    dates.push(formatUtcDate(millis));
  }
  return dates;
}

/** 含首尾的天数；先算长度再做枚举，避免年份跨度很大时分配巨量日期。 */
export function countLocalDays(start: LocalDate, end: LocalDate): number {
  const startMillis = toUtcMillis(start);
  const endMillis = toUtcMillis(end);
  if (startMillis === undefined || endMillis === undefined || startMillis > endMillis) {
    return 0;
  }
  return Math.round((endMillis - startMillis) / DAY_MS) + 1;
}

/** 浏览器本地日历的“今天”，不经过 UTC，避免晚上跨日。 */
export function todayLocalDate(date: Date = new Date()): LocalDate {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}` as LocalDate;
}