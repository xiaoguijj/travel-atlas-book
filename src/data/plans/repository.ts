import { DataError, type IsoDateTime, type TravelBook, type TravelPlan } from '../contracts';
import { db as defaultDatabase, toDataError, type TravelAtlasDatabase } from '../db';
import { createStableId } from '../ids';
import { normalizePlanId } from '../validation';
import { analyzePlanChange, matchesConfirmation, toLinkedBook } from './impact';
import type {
  PlanChangePreview,
  PlanDeletePreview,
  PlanDraft,
  PlanSaveConfirmation,
} from './types';
import { normalizePlanDraft, requirePlanCity, type NormalizedPlanDraft } from './validation';

export interface PlanRepositoryOptions {
  /** 测试可注入固定时钟；生产缺省使用当前 UTC 时间。 */
  now?: () => IsoDateTime;
}

export interface PlanRepository {
  listPlans(cityId?: string): Promise<TravelPlan[]>;
  getPlan(planId: string): Promise<TravelPlan | undefined>;
  previewPlanChange(draft: PlanDraft): Promise<PlanChangePreview>;
  previewPlanDelete(planId: string): Promise<PlanDeletePreview>;
  savePlan(draft: PlanDraft, confirmation?: PlanSaveConfirmation): Promise<TravelPlan>;
  deletePlan(planId: string): Promise<void>;
}

/** 城市列表按出发日期先后排列，同日按最近修改排序，便于回看。 */
function sortPlans(plans: TravelPlan[]): TravelPlan[] {
  return plans.sort((left, right) => {
    const byStart = left.startDate.localeCompare(right.startDate);
    if (byStart !== 0) return byStart;
    const byUpdatedAt = right.updatedAt.localeCompare(left.updatedAt);
    return byUpdatedAt !== 0 ? byUpdatedAt : left.id.localeCompare(right.id);
  });
}

function confirmationRequired(preview: PlanChangePreview): DataError {
  return new DataError('INVALID_PLAN', '调整会影响已有日程或手账关联，请确认后再保存', {
    reason: 'CONFIRMATION_REQUIRED',
    preview,
  });
}

function confirmationChanged(preview: PlanChangePreview): DataError {
  return new DataError('INVALID_PLAN', '计划在此期间发生了变化，请重新确认影响范围', {
    reason: 'CONFIRMATION_CHANGED',
    preview,
  });
}

/**
 * 草稿带 baseUpdatedAt 时，要求事务里读到的计划仍是同一次加载的版本。
 * 其他窗口只要保存过计划（哪怕只是加了当天一个条目），这里都会拒绝覆盖。
 */
function assertPlanUnchanged(
  existing: TravelPlan | undefined,
  normalized: NormalizedPlanDraft,
): void {
  if (existing && normalized.baseUpdatedAt && existing.updatedAt !== normalized.baseUpdatedAt) {
    throw new DataError('INVALID_PLAN', '计划已在其他窗口修改，请刷新页面后重新打开再保存', {
      reason: 'PLAN_CHANGED',
      baseUpdatedAt: normalized.baseUpdatedAt,
      currentUpdatedAt: existing.updatedAt,
    });
  }
}

/**
 * 旅行计划仓储。保存与删除在 `plans + books` 事务内完成：
 * 计划记录、日程清理和手账解绑要么一起成功，要么整体回滚。
 */
export function createPlanRepository(
  database: TravelAtlasDatabase = defaultDatabase,
  options: PlanRepositoryOptions = {},
): PlanRepository {
  const now = options.now ?? (() => new Date().toISOString());

  async function loadLinkedBooks(planId: string): Promise<TravelBook[]> {
    return database.books.where('planId').equals(planId).toArray();
  }

  return {
    async listPlans(cityId) {
      try {
        const normalizedCityId = typeof cityId === 'string' && cityId.trim() ? cityId.trim() : undefined;
        if (normalizedCityId) requirePlanCity(normalizedCityId);
        const plans = normalizedCityId
          ? await database.plans.where('cityIds').equals(normalizedCityId).toArray()
          : await database.plans.toArray();
        return sortPlans(plans);
      } catch (error) {
        throw toDataError(error, 'DATABASE_UNAVAILABLE', '读取旅行计划失败');
      }
    },

    async getPlan(planId) {
      const id = typeof planId === 'string' ? planId.trim() : '';
      if (!id) return undefined;
      try {
        return await database.plans.get(id);
      } catch (error) {
        throw toDataError(error, 'DATABASE_UNAVAILABLE', '读取旅行计划失败');
      }
    },

    async previewPlanChange(draft) {
      try {
        const normalized = normalizePlanDraft(draft);
        const existing = normalized.id ? await database.plans.get(normalized.id) : undefined;
        if (normalized.id && !existing) {
          throw new DataError('INVALID_PLAN', '旅行计划不存在或已被删除', { planId: normalized.id });
        }
        assertPlanUnchanged(existing, normalized);
        const linkedBooks = existing ? await loadLinkedBooks(existing.id) : [];
        return analyzePlanChange(existing, normalized, linkedBooks);
      } catch (error) {
        throw toDataError(error, 'DATABASE_UNAVAILABLE', '无法预览计划调整影响');
      }
    },

    async previewPlanDelete(planId) {
      try {
        const id = normalizePlanId(planId);
        const plan = await database.plans.get(id);
        if (!plan) {
          throw new DataError('INVALID_PLAN', '旅行计划不存在或已被删除', { planId: id });
        }
        const linkedBooks = await loadLinkedBooks(id);
        return { plan, unlinkedBooks: linkedBooks.map(toLinkedBook) };
      } catch (error) {
        throw toDataError(error, 'DATABASE_UNAVAILABLE', '无法读取计划关联');
      }
    },

    async savePlan(draft, confirmation) {
      const normalized = normalizePlanDraft(draft);
      try {
        return await database.transaction('rw', database.plans, database.books, async () => {
          const existing = normalized.id ? await database.plans.get(normalized.id) : undefined;
          if (normalized.id && !existing) {
            throw new DataError('INVALID_PLAN', '旅行计划不存在或已被删除', { planId: normalized.id });
          }
          assertPlanUnchanged(existing, normalized);
          const timestamp = now();
          const linkedBooks = existing ? await loadLinkedBooks(existing.id) : [];
          const preview = analyzePlanChange(existing, normalized, linkedBooks);

          if (preview.requiresConfirmation) {
            if (!confirmation) throw confirmationRequired(preview);
            if (!matchesConfirmation(preview, confirmation)) throw confirmationChanged(preview);
          }

          const plan: TravelPlan = {
            id: existing?.id ?? createStableId(),
            title: normalized.title,
            cityIds: normalized.cityIds,
            startDate: normalized.startDate,
            endDate: normalized.endDate,
            days: normalized.days,
            createdAt: existing?.createdAt ?? timestamp,
            updatedAt: timestamp,
          };
          await database.plans.put(plan);

          for (const book of preview.unlinkedBooks) {
            await database.books.update(book.id, { planId: undefined, updatedAt: timestamp });
          }
          return plan;
        });
      } catch (error) {
        throw toDataError(error, 'TRANSACTION_FAILED', '保存旅行计划失败');
      }
    },

    async deletePlan(planId) {
      const id = normalizePlanId(planId);
      try {
        await database.transaction('rw', database.plans, database.books, async () => {
          const existing = await database.plans.get(id);
          if (!existing) {
            throw new DataError('INVALID_PLAN', '旅行计划不存在或已被删除', { planId: id });
          }
          const timestamp = now();
          const linkedBooks = await loadLinkedBooks(id);
          for (const book of linkedBooks) {
            await database.books.update(book.id, { planId: undefined, updatedAt: timestamp });
          }
          await database.plans.delete(id);
        });
      } catch (error) {
        throw toDataError(error, 'TRANSACTION_FAILED', '删除旅行计划失败');
      }
    },
  };
}

const defaultRepository = createPlanRepository(defaultDatabase);

export const listPlans = defaultRepository.listPlans;
export const getPlan = defaultRepository.getPlan;
export const previewPlanChange = defaultRepository.previewPlanChange;
export const previewPlanDelete = defaultRepository.previewPlanDelete;
export const savePlan = defaultRepository.savePlan;
export const deletePlan = defaultRepository.deletePlan;