import type { TravelBook, TravelPlan } from '../contracts';
import { compareLocalDates } from './dates';
import type { PlanChangePreview, PlanLinkedBook, PlanSaveConfirmation } from './types';
import type { NormalizedPlanDraft } from './validation';

export function toLinkedBook(book: TravelBook): PlanLinkedBook {
  return { id: book.id, title: book.title, cityId: book.cityId };
}

/**
 * 对比已存计划与新草稿，得出保存会造成的副作用。
 * 只有“被日期缩短删掉的有内容日程、被移除城市的日程、失配手账”需要用户确认；
 * 用户在表单里主动删掉的条目属于正常编辑，不进入预览。
 */
export function analyzePlanChange(
  existing: TravelPlan | undefined,
  normalized: NormalizedPlanDraft,
  linkedBooks: TravelBook[],
): PlanChangePreview {
  const cityIds = new Set(normalized.cityIds);
  const removedDays =
    existing?.days.filter(
      (day) =>
        (compareLocalDates(day.date, normalized.startDate) < 0 ||
          compareLocalDates(day.date, normalized.endDate) > 0) &&
        (day.items.length > 0 || Boolean(day.cityId)),
    ) ?? [];
  const clearedDayDates =
    existing?.days
      .filter(
        (day) =>
          compareLocalDates(day.date, normalized.startDate) >= 0 &&
          compareLocalDates(day.date, normalized.endDate) <= 0 &&
          Boolean(day.cityId) &&
          !cityIds.has(day.cityId as string),
      )
      .map((day) => day.date) ?? [];
  const unlinkedBooks = linkedBooks.filter((book) => !cityIds.has(book.cityId)).map(toLinkedBook);

  return {
    planId: existing?.id ?? normalized.id,
    planTitle: normalized.title,
    isNew: !existing,
    removedDays,
    clearedDayDates,
    unlinkedBooks,
    requiresConfirmation:
      removedDays.length > 0 || clearedDayDates.length > 0 || unlinkedBooks.length > 0,
  };
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((value) => rightSet.has(value));
}

/** 确认期间若有其他人改了计划或手账，集合会变化，此时必须重新确认。 */
export function matchesConfirmation(
  preview: PlanChangePreview,
  confirmation: PlanSaveConfirmation,
): boolean {
  return (
    sameSet(
      preview.removedDays.map((day) => day.date),
      confirmation.removedDates,
    ) &&
    sameSet(preview.clearedDayDates, confirmation.clearedDates) &&
    sameSet(
      preview.unlinkedBooks.map((book) => book.id),
      confirmation.unlinkedBookIds,
    )
  );
}

export function confirmationFromPreview(preview: PlanChangePreview): PlanSaveConfirmation {
  return {
    removedDates: preview.removedDays.map((day) => day.date),
    clearedDates: [...preview.clearedDayDates],
    unlinkedBookIds: preview.unlinkedBooks.map((book) => book.id),
  };
}