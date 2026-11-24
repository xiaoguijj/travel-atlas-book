import type { IsoDateTime, LocalDate, PlanDay, TravelPlan } from '../contracts';

/**
 * 表单提交的计划草稿。带 `id` 表示更新已有计划，否则新建。
 * `days` 可以包含被缩短掉的日期，保存时只保留起止区间内的日程。
 */
export interface PlanDraft {
  id?: string;
  /** 加载计划时的 updatedAt；保存/预览会据此拦截其他窗口的并发修改。 */
  baseUpdatedAt?: IsoDateTime;
  title: string;
  cityIds: string[];
  startDate: LocalDate;
  endDate: LocalDate;
  days: PlanDay[];
}

export interface PlanLinkedBook {
  id: string;
  title: string;
  cityId: string;
}

/** 保存前的影响预览；日期缩短、城市移除与手账解绑都会出现在这里。 */
export interface PlanChangePreview {
  planId?: string;
  planTitle: string;
  isNew: boolean;
  /** 起止日期缩短后将被整体移除的日程（仅列出原记录里有内容的日期）。 */
  removedDays: PlanDay[];
  /** 这些日期所在城市已移出计划，保存后保留条目但清空当日城市。 */
  clearedDayDates: LocalDate[];
  /** 这些手账会解除与本计划的关联，手账本身和内容保留。 */
  unlinkedBooks: PlanLinkedBook[];
  requiresConfirmation: boolean;
}

/** 用户在确认界面看到的集合；保存时按它重新核对，变化了就必须再确认。 */
export interface PlanSaveConfirmation {
  removedDates: LocalDate[];
  clearedDates: LocalDate[];
  unlinkedBookIds: string[];
}

export interface PlanDeletePreview {
  plan: TravelPlan;
  unlinkedBooks: PlanLinkedBook[];
}