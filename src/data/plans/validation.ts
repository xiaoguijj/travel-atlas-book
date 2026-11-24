import {
  CITY_IDS,
  DataError,
  MAX_BOOK_TITLE_LENGTH,
  type BusinessCityId,
  type IsoDateTime,
  type LocalDate,
  type LocalTime,
  type PlanDay,
  type PlanItem,
} from '../contracts';
import { getCityById } from '../cities';
import { createStableId } from '../ids';
import { compareLocalDates, countLocalDays, enumerateDates, isLocalDate, isLocalTime } from './dates';
import type { PlanDraft } from './types';

export const MAX_PLAN_DAYS = 366;
export const MAX_PLAN_ITEM_TITLE_LENGTH = 120;
export const MAX_PLAN_ITEM_NOTE_LENGTH = 500;

const sixCities = new Set<string>(CITY_IDS);

/** 愿望与计划只覆盖六城目录；伦敦仍是地球上的额外城市，但不进入愿望地图。 */
export function requirePlanCity(cityId: string): BusinessCityId {
  const id = typeof cityId === 'string' ? cityId.trim() : '';
  if (!sixCities.has(id) || !getCityById(id)) {
    throw new DataError('INVALID_CITY', `旅行计划只支持六城目录内的城市：${id || '(空)'}`, { cityId });
  }
  return id as BusinessCityId;
}

export function normalizePlanTitle(title: string): string {
  const normalized = typeof title === 'string' ? title.trim() : '';
  if (!normalized) {
    throw new DataError('INVALID_TITLE', '计划标题不能为空', { field: 'title' });
  }
  if (normalized.length > MAX_BOOK_TITLE_LENGTH) {
    throw new DataError('INVALID_TITLE', `计划标题不能超过 ${MAX_BOOK_TITLE_LENGTH} 个字符`, {
      field: 'title',
      length: normalized.length,
    });
  }
  return normalized;
}

export interface NormalizedPlanDraft {
  id?: string;
  baseUpdatedAt?: IsoDateTime;
  title: string;
  cityIds: string[];
  startDate: LocalDate;
  endDate: LocalDate;
  /** 已按日期升序补齐区间内每一天；没有内容的日期是空日。 */
  days: PlanDay[];
}

function invalidPlan(message: string, details?: Record<string, unknown>): DataError {
  return new DataError('INVALID_PLAN', message, details);
}

function normalizeDraftId(id: unknown): string | undefined {
  if (id === undefined || id === null || id === '') return undefined;
  if (typeof id !== 'string' || !id.trim()) {
    throw invalidPlan('计划 ID 无效', { field: 'id' });
  }
  return id.trim();
}

function normalizeCityIds(cityIds: unknown): string[] {
  if (!Array.isArray(cityIds)) {
    throw invalidPlan('计划至少需要选择一座城市', { field: 'cityIds' });
  }
  const unique: string[] = [];
  for (const raw of cityIds) {
    const cityId = requirePlanCity(typeof raw === 'string' ? raw : '');
    if (!unique.includes(cityId)) unique.push(cityId);
  }
  if (unique.length === 0) {
    throw invalidPlan('计划至少需要选择一座城市', { field: 'cityIds' });
  }
  return unique;
}

function normalizeRange(startDate: unknown, endDate: unknown): { startDate: LocalDate; endDate: LocalDate } {
  if (!isLocalDate(startDate)) {
    throw invalidPlan('请选择有效的开始日期', { field: 'startDate' });
  }
  if (!isLocalDate(endDate)) {
    throw invalidPlan('请选择有效的结束日期', { field: 'endDate' });
  }
  if (compareLocalDates(startDate, endDate) > 0) {
    throw invalidPlan('结束日期不能早于开始日期', { field: 'endDate' });
  }
  if (countLocalDays(startDate, endDate) > MAX_PLAN_DAYS) {
    throw invalidPlan(`单趟行程最长 ${MAX_PLAN_DAYS} 天`, { field: 'endDate', maxDays: MAX_PLAN_DAYS });
  }
  return { startDate, endDate };
}

function normalizeItem(raw: unknown, date: LocalDate, seenIds: Set<string>): PlanItem {
  if (!raw || typeof raw !== 'object') {
    throw invalidPlan('日程条目无效', { field: 'items', date });
  }
  const record = raw as Record<string, unknown>;
  const title = typeof record.title === 'string' ? record.title.trim() : '';
  if (!title) {
    throw invalidPlan('景点名称不能为空', { field: 'itemTitle', date });
  }
  if (title.length > MAX_PLAN_ITEM_TITLE_LENGTH) {
    throw invalidPlan(`景点名称不能超过 ${MAX_PLAN_ITEM_TITLE_LENGTH} 个字符`, {
      field: 'itemTitle',
      date,
      length: title.length,
    });
  }

  let id = typeof record.id === 'string' ? record.id.trim() : '';
  if (!id) id = createStableId();
  if (seenIds.has(id)) {
    throw invalidPlan('日程条目 ID 重复', { field: 'itemId', date, itemId: id });
  }
  seenIds.add(id);

  const item: PlanItem = { id, title };
  const rawTime = typeof record.time === 'string' ? record.time.trim() : '';
  if (rawTime) {
    if (!isLocalTime(rawTime)) {
      throw invalidPlan('时间格式应为 HH:mm', { field: 'itemTime', date, itemId: id });
    }
    item.time = rawTime as LocalTime;
  }
  if (record.note !== undefined && record.note !== null) {
    if (typeof record.note !== 'string') {
      throw invalidPlan('备注必须是文本', { field: 'itemNote', date, itemId: id });
    }
    const note = record.note.trim();
    if (note.length > MAX_PLAN_ITEM_NOTE_LENGTH) {
      throw invalidPlan(`条目备注不能超过 ${MAX_PLAN_ITEM_NOTE_LENGTH} 个字符`, {
        field: 'itemNote',
        date,
        itemId: id,
        length: note.length,
      });
    }
    if (note) item.note = note;
  }
  return item;
}

function normalizeDay(raw: unknown, cityIds: string[], seenIds: Set<string>): PlanDay {
  if (!raw || typeof raw !== 'object') {
    throw invalidPlan('日程日期无效', { field: 'days' });
  }
  const record = raw as Record<string, unknown>;
  if (!isLocalDate(record.date)) {
    throw invalidPlan('日程日期必须是 YYYY-MM-DD', { field: 'dayDate' });
  }
  const date = record.date;
  if (!Array.isArray(record.items)) {
    throw invalidPlan('日程条目列表无效', { field: 'items', date });
  }
  const items = record.items.map((item) => normalizeItem(item, date, seenIds));
  const day: PlanDay = { date, items };

  const rawCityId = typeof record.cityId === 'string' ? record.cityId.trim() : '';
  // 城市被移出计划时保留条目、清空当日城市；影响预览会提示用户。
  if (rawCityId && cityIds.includes(rawCityId)) {
    day.cityId = rawCityId;
  }
  return day;
}

export function normalizePlanDraft(draft: PlanDraft): NormalizedPlanDraft {
  if (!draft || typeof draft !== 'object') {
    throw invalidPlan('旅行计划内容无效');
  }
  const id = normalizeDraftId(draft.id);
  const baseUpdatedAt =
    id && typeof draft.baseUpdatedAt === 'string' && draft.baseUpdatedAt.trim()
      ? draft.baseUpdatedAt.trim()
      : undefined;
  const title = normalizePlanTitle(draft.title);
  const cityIds = normalizeCityIds(draft.cityIds);
  const { startDate, endDate } = normalizeRange(draft.startDate, draft.endDate);

  if (!Array.isArray(draft.days)) {
    throw invalidPlan('日程列表无效', { field: 'days' });
  }

  const seenItemIds = new Set<string>();
  const draftDays = new Map<LocalDate, PlanDay>();
  for (const raw of draft.days) {
    if (!raw || typeof raw !== 'object' || !isLocalDate((raw as { date?: unknown }).date)) {
      throw invalidPlan('日程日期必须是 YYYY-MM-DD', { field: 'dayDate' });
    }
    const date = (raw as { date: LocalDate }).date;
    // 缩短日期后残留在草稿里的旧日程直接丢弃，不因被丢弃的内容阻断保存。
    if (compareLocalDates(date, startDate) < 0 || compareLocalDates(date, endDate) > 0) {
      continue;
    }
    const day = normalizeDay(raw, cityIds, seenItemIds);
    if (draftDays.has(day.date)) {
      throw invalidPlan('同一天只能有一条日程', { field: 'dayDate', date: day.date });
    }
    draftDays.set(day.date, day);
  }

  const days = enumerateDates(startDate, endDate).map(
    (date): PlanDay => draftDays.get(date) ?? { date, items: [] },
  );

  return { id, baseUpdatedAt, title, cityIds, startDate, endDate, days };
}