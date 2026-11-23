import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { errorMessage } from './errorMessage';
import { CITY_IDS, isDataError, type LocalDate, type PlanDay, type PlanItem, type TravelPlan } from '../../data/contracts';
import { getCityById } from '../../data/cities';
import { createStableId } from '../../data/ids';
import {
  MAX_PLAN_DAYS,
  confirmationFromPreview,
  countLocalDays,
  deletePlan,
  enumerateDates,
  isLocalDate,
  previewPlanChange,
  previewPlanDelete,
  savePlan,
} from '../../data/plans';
import type { PlanChangePreview, PlanDeletePreview, PlanDraft } from '../../data/plans';
import type { City } from '../../data/types';
import styles from './PlanForm.module.css';

export interface PlanFormProps {
  mode: 'create' | 'edit';
  initialDraft: PlanDraft;
  cancelTo: string;
  cancelLabel: string;
  onSaved: (plan: TravelPlan, isNew: boolean) => void;
  onDeleted?: () => void;
}

interface DayState {
  cityId: string;
  items: PlanItem[];
}

const dayFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: 'long',
  day: 'numeric',
  weekday: 'short',
  timeZone: 'UTC',
});

function formatDayLabel(date: LocalDate): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? date : dayFormatter.format(parsed);
}

function cityName(cityId: string): string {
  return getCityById(cityId)?.name ?? cityId;
}

function initialDayStates(draft: PlanDraft): Record<string, DayState> {
  const states: Record<string, DayState> = {};
  for (const day of draft.days) {
    states[day.date] = {
      cityId: day.cityId ?? '',
      items: day.items.map((item) => ({ ...item })),
    };
  }
  return states;
}

export function toPlanDraft(plan: TravelPlan): PlanDraft {
  return {
    id: plan.id,
    baseUpdatedAt: plan.updatedAt,
    title: plan.title,
    cityIds: plan.cityIds,
    startDate: plan.startDate,
    endDate: plan.endDate,
    days: plan.days,
  };
}

/**
 * 新建与编辑共用同一张行程表单。保存前会先向仓储要一份影响预览：
 * 缩短日期、移除城市或手账失配时，必须确认后才会写入。
 */
export function PlanForm({ mode, initialDraft, cancelTo, cancelLabel, onSaved, onDeleted }: PlanFormProps) {
  const [title, setTitle] = useState(initialDraft.title);
  const [baseUpdatedAt, setBaseUpdatedAt] = useState(initialDraft.baseUpdatedAt);
  const [cityIds, setCityIds] = useState(initialDraft.cityIds);
  const [startDate, setStartDate] = useState<LocalDate>(initialDraft.startDate);
  const [endDate, setEndDate] = useState<LocalDate>(initialDraft.endDate);
  const [days, setDays] = useState<Record<string, DayState>>(() => initialDayStates(initialDraft));
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingImpact, setPendingImpact] = useState<{ draft: PlanDraft; preview: PlanChangePreview } | null>(null);
  const [impactNotice, setImpactNotice] = useState<string | null>(null);
  const [deletePreview, setDeletePreview] = useState<PlanDeletePreview | null>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (pendingImpact) confirmRef.current?.focus();
  }, [pendingImpact]);

  const selectedCities = useMemo(
    () =>
      CITY_IDS.filter((cityId) => cityIds.includes(cityId))
        .map((cityId) => getCityById(cityId))
        .filter((city): city is City => Boolean(city)),
    [cityIds],
  );

  const dayCount = countLocalDays(startDate, endDate);
  const rangeValid = isLocalDate(startDate) && isLocalDate(endDate) && dayCount > 0;
  const rangeTooLong = rangeValid && dayCount > MAX_PLAN_DAYS;
  const rangeDates = rangeValid && !rangeTooLong ? enumerateDates(startDate, endDate) : [];
  const rangeMessage = !isLocalDate(startDate) || !isLocalDate(endDate)
    ? '请先选择完整的起止日期。'
    : dayCount === 0
      ? '结束日期不能早于开始日期。'
      : rangeTooLong
        ? `单趟行程最长 ${MAX_PLAN_DAYS} 天，请缩短日期范围。`
        : null;

  function touch() {
    setSavedAt(null);
    setError(null);
  }

  function dayOf(date: LocalDate): DayState {
    return days[date] ?? { cityId: '', items: [] };
  }

  function toggleCity(cityId: string) {
    touch();
    setCityIds((previous) =>
      previous.includes(cityId)
        ? previous.filter((id) => id !== cityId)
        : CITY_IDS.filter((id) => id === cityId || previous.includes(id)),
    );
  }

  function setDayCity(date: LocalDate, cityId: string) {
    touch();
    setDays((previous) => ({
      ...previous,
      [date]: { ...(previous[date] ?? { cityId: '', items: [] }), cityId },
    }));
  }

  function addItem(date: LocalDate) {
    touch();
    setDays((previous) => {
      const day = previous[date] ?? { cityId: '', items: [] };
      return {
        ...previous,
        [date]: { ...day, items: [...day.items, { id: createStableId(), title: '' }] },
      };
    });
  }

  function patchItem(date: LocalDate, itemId: string, patch: Partial<PlanItem>) {
    touch();
    setDays((previous) => {
      const day = previous[date];
      if (!day) return previous;
      return {
        ...previous,
        [date]: {
          ...day,
          items: day.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
        },
      };
    });
  }

  function removeItem(date: LocalDate, itemId: string) {
    touch();
    setDays((previous) => {
      const day = previous[date];
      if (!day) return previous;
      return { ...previous, [date]: { ...day, items: day.items.filter((item) => item.id !== itemId) } };
    });
  }

  function moveItem(date: LocalDate, itemId: string, direction: -1 | 1) {
    touch();
    setDays((previous) => {
      const day = previous[date];
      if (!day) return previous;
      const index = day.items.findIndex((item) => item.id === itemId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= day.items.length) return previous;
      const items = [...day.items];
      [items[index], items[target]] = [items[target], items[index]];
      return { ...previous, [date]: { ...day, items } };
    });
  }

  function buildDraft(): PlanDraft {
    const draftDays: PlanDay[] = Object.keys(days)
      .filter((date): date is LocalDate => isLocalDate(date))
      .map((date) => {
        const day = days[date];
        return {
          date,
          ...(day.cityId ? { cityId: day.cityId } : {}),
          items: day.items.map((item) => ({
            id: item.id,
            title: item.title,
            ...(item.time ? { time: item.time } : {}),
            ...(item.note ? { note: item.note } : {}),
          })),
        };
      });
    return { id: initialDraft.id, baseUpdatedAt, title, cityIds, startDate, endDate, days: draftDays };
  }

  function finishSave(plan: TravelPlan, isNew: boolean) {
    // 保存后以仓储返回的计划为准，丢掉被缩短掉的旧日程，避免再次拉长时“复活”它们。
    setTitle(plan.title);
    setBaseUpdatedAt(plan.updatedAt);
    setCityIds(plan.cityIds);
    setStartDate(plan.startDate);
    setEndDate(plan.endDate);
    setDays(initialDayStates(toPlanDraft(plan)));
    setSavedAt(
      new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    );
    onSaved(plan, isNew);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setError(null);
    setImpactNotice(null);
    const draft = buildDraft();
    setSaving(true);
    try {
      const preview = await previewPlanChange(draft);
      if (preview.requiresConfirmation) {
        setPendingImpact({ draft, preview });
        return;
      }
      const plan = await savePlan(draft);
      finishSave(plan, !draft.id);
    } catch (saveError) {
      setError(errorMessage(saveError, '保存行程失败，请重试。'));
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmImpact() {
    if (!pendingImpact || saving) return;
    setSaving(true);
    setError(null);
    setImpactNotice(null);
    try {
      const plan = await savePlan(
        pendingImpact.draft,
        confirmationFromPreview(pendingImpact.preview),
      );
      setPendingImpact(null);
      finishSave(plan, mode === 'create');
    } catch (saveError) {
      if (isDataError(saveError) && saveError.details?.reason === 'CONFIRMATION_CHANGED') {
        try {
          const preview = await previewPlanChange(pendingImpact.draft);
          setPendingImpact({ draft: pendingImpact.draft, preview });
          setImpactNotice('计划刚刚发生了变化，请按新的影响范围重新确认。');
        } catch (previewError) {
          setPendingImpact(null);
          setError(errorMessage(previewError, '无法重新读取计划影响，请重试。'));
        }
      } else {
        setPendingImpact(null);
        setError(errorMessage(saveError, '保存行程失败，请重试。'));
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteStart() {
    if (!initialDraft.id) return;
    setError(null);
    try {
      setDeletePreview(await previewPlanDelete(initialDraft.id));
    } catch (previewError) {
      setError(errorMessage(previewError, '无法读取行程关联，请重试。'));
    }
  }

  async function handleConfirmDelete() {
    if (!deletePreview || saving) return;
    setSaving(true);
    setError(null);
    try {
      await deletePlan(deletePreview.plan.id);
      setDeletePreview(null);
      onDeleted?.();
    } catch (deleteError) {
      setDeletePreview(null);
      setError(errorMessage(deleteError, '删除行程失败，请重试。'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      {savedAt ? (
        <p className={styles.saved} role="status">
          已保存 · {savedAt}
        </p>
      ) : null}
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="plan-title">
          行程标题
        </label>
        <input
          id="plan-title"
          className={styles.input}
          value={title}
          onChange={(event) => {
            touch();
            setTitle(event.target.value);
          }}
          maxLength={80}
          placeholder="例如：南京两日"
        />
      </div>

      <fieldset className={styles.field}>
        <legend className={styles.fieldLabel}>去哪些城市</legend>
        <div className={styles.cityOptions}>
          {CITY_IDS.map((cityId) => {
            const city = getCityById(cityId);
            if (!city) return null;
            return (
              <label key={cityId} className={styles.cityOption}>
                <input
                  type="checkbox"
                  checked={cityIds.includes(cityId)}
                  onChange={() => toggleCity(cityId)}
                />
                <span>{city.name}</span>
                <em>{city.nameEn}</em>
              </label>
            );
          })}
        </div>
        <p className={styles.hint}>至少选择一座。多城行程会同时出现在每座城市的计划页里。</p>
      </fieldset>

      <div className={styles.dateRow}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>开始日期</span>
          <input
            className={styles.input}
            type="date"
            value={startDate}
            onChange={(event) => {
              touch();
              setStartDate(event.target.value as LocalDate);
            }}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>结束日期</span>
          <input
            className={styles.input}
            type="date"
            value={endDate}
            onChange={(event) => {
              touch();
              setEndDate(event.target.value as LocalDate);
            }}
          />
        </label>
        <p className={styles.rangeNote}>
          {rangeMessage ?? `共 ${dayCount} 天 · 第一天的日期从 ${startDate} 开始`}
        </p>
      </div>

      <section className={styles.days} aria-label="每日行程">
        <div className={styles.daysHead}>
          <h2>每日安排</h2>
          <span>顺序就是当天的游览顺序</span>
        </div>

        {rangeMessage ? <p className={styles.rangeWarning}>{rangeMessage}</p> : null}

        {rangeDates.map((date, dayIndex) => {
          const day = dayOf(date);
          const label = formatDayLabel(date);
          const cityStillInPlan = !day.cityId || cityIds.includes(day.cityId);
          return (
            <article key={date} className={styles.dayCard} data-date={date}>
              <header className={styles.dayHead}>
                <h3>
                  <span className={styles.dayIndex}>第 {dayIndex + 1} 天</span>
                  {label}
                  <code>{date}</code>
                </h3>
                <label className={styles.dayCity}>
                  <span>当日城市</span>
                  <select
                    aria-label={`${label} 当日城市`}
                    value={cityStillInPlan ? day.cityId : ''}
                    onChange={(event) => setDayCity(date, event.target.value)}
                  >
                    <option value="">不指定</option>
                    {selectedCities.map((city) => (
                      <option key={city.id} value={city.id}>
                        {city.name}
                      </option>
                    ))}
                  </select>
                </label>
              </header>

              {!cityStillInPlan ? (
                <p className={styles.dayWarning}>
                  「{cityName(day.cityId)}」已不在本次行程城市里，保存后会保留这条日程，但清空当日城市。
                </p>
              ) : null}

              {day.items.length === 0 ? (
                <p className={styles.emptyDay}>这一天还没有安排。</p>
              ) : (
                <ol className={styles.items}>
                  {day.items.map((item, itemIndex) => {
                    const itemLabel = `${label} 第${itemIndex + 1}项`;
                    return (
                      <li key={item.id} className={styles.itemRow}>
                        <span className={styles.itemNo} aria-hidden="true">
                          {itemIndex + 1}
                        </span>
                        <div className={styles.itemFields}>
                          <label className={styles.itemFieldWide}>
                            <span>景点</span>
                            <input
                              aria-label={`${itemLabel}景点`}
                              value={item.title}
                              onChange={(event) =>
                                patchItem(date, item.id, { title: event.target.value })
                              }
                              maxLength={120}
                              placeholder="景点或活动"
                            />
                          </label>
                          <label className={styles.itemFieldTime}>
                            <span>时间</span>
                            <input
                              type="time"
                              aria-label={`${itemLabel}时间`}
                              value={item.time ?? ''}
                              onChange={(event) =>
                                patchItem(date, item.id, {
                                  time: (event.target.value || undefined) as PlanItem['time'],
                                })
                              }
                            />
                          </label>
                          <label className={styles.itemFieldWide}>
                            <span>备注</span>
                            <input
                              aria-label={`${itemLabel}备注`}
                              value={item.note ?? ''}
                              onChange={(event) =>
                                patchItem(date, item.id, { note: event.target.value || undefined })
                              }
                              maxLength={500}
                              placeholder="备注（可选）"
                            />
                          </label>
                        </div>
                        <div className={styles.itemActions}>
                          <button
                            type="button"
                            aria-label={`${itemLabel}上移`}
                            onClick={() => moveItem(date, item.id, -1)}
                            disabled={itemIndex === 0}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            aria-label={`${itemLabel}下移`}
                            onClick={() => moveItem(date, item.id, 1)}
                            disabled={itemIndex === day.items.length - 1}
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            className={styles.itemRemove}
                            aria-label={`${itemLabel}移除`}
                            onClick={() => removeItem(date, item.id)}
                          >
                            移除
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}

              <button type="button" className={styles.addItem} onClick={() => addItem(date)}>
                ＋ 添加景点
              </button>
            </article>
          );
        })}
      </section>

      <div className={styles.footer}>
        <button className={styles.primary} type="submit" disabled={saving}>
          {saving ? '正在保存…' : mode === 'create' ? '保存行程' : '保存修改'}
        </button>
        <Link className={styles.ghost} to={cancelTo}>
          {cancelLabel}
        </Link>
        {mode === 'edit' ? (
          <button
            className={styles.danger}
            type="button"
            onClick={handleDeleteStart}
            disabled={saving}
          >
            删除行程
          </button>
        ) : null}
      </div>

      {pendingImpact ? (
        <div
          className={styles.overlay}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && !saving) setPendingImpact(null);
          }}
        >
          <div
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="plan-impact-title"
          >
            <h2 id="plan-impact-title">保存前确认影响</h2>
            <p>这次修改会顺带清理下面的内容，请确认是否继续。</p>

            {pendingImpact.preview.removedDays.length > 0 ? (
              <section className={styles.impactGroup}>
                <h3>缩短日期后会移除的日程</h3>
                <ul>
                  {pendingImpact.preview.removedDays.map((day) => (
                    <li key={day.date}>
                      {formatDayLabel(day.date)}（{day.date}）· {day.items.length} 个条目
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {pendingImpact.preview.clearedDayDates.length > 0 ? (
              <section className={styles.impactGroup}>
                <h3>会清空当日城市的日程</h3>
                <ul>
                  {pendingImpact.preview.clearedDayDates.map((date) => (
                    <li key={date}>{formatDayLabel(date)}（{date}）</li>
                  ))}
                </ul>
                <p>条目会保留，只清空这一天所属的城市。</p>
              </section>
            ) : null}

            {pendingImpact.preview.unlinkedBooks.length > 0 ? (
              <section className={styles.impactGroup}>
                <h3>会解除计划关联的手账</h3>
                <ul>
                  {pendingImpact.preview.unlinkedBooks.map((book) => (
                    <li key={book.id}>
                      {book.title}（{cityName(book.cityId)}）
                    </li>
                  ))}
                </ul>
                <p>手账本身、Journal 和 Collage 内容都会保留。</p>
              </section>
            ) : null}

            {impactNotice ? (
              <p className={styles.warning} role="alert">
                {impactNotice}
              </p>
            ) : null}

            <div className={styles.dialogActions}>
              <button
                ref={confirmRef}
                className={styles.primary}
                type="button"
                onClick={handleConfirmImpact}
                disabled={saving}
              >
                {saving ? '正在保存…' : '确认并保存'}
              </button>
              <button
                className={styles.ghost}
                type="button"
                onClick={() => setPendingImpact(null)}
                disabled={saving}
              >
                返回修改
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deletePreview ? (
        <div
          className={styles.overlay}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && !saving) setDeletePreview(null);
          }}
        >
          <div
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="plan-delete-title"
          >
            <h2 id="plan-delete-title">删除「{deletePreview.plan.title}」？</h2>
            <p>行程记录会永久删除，无法恢复。</p>
            {deletePreview.unlinkedBooks.length > 0 ? (
              <section className={styles.impactGroup}>
                <h3>以下手账会解除关联</h3>
                <ul>
                  {deletePreview.unlinkedBooks.map((book) => (
                    <li key={book.id}>
                      {book.title}（{cityName(book.cityId)}）
                    </li>
                  ))}
                </ul>
                <p>手账本身、照片和正文都会保留。</p>
              </section>
            ) : (
              <p>当前没有手账关联这趟行程。</p>
            )}
            <div className={styles.dialogActions}>
              <button
                className={styles.danger}
                type="button"
                onClick={handleConfirmDelete}
                disabled={saving}
              >
                {saving ? '正在删除…' : '确认删除'}
              </button>
              <button
                className={styles.ghost}
                type="button"
                onClick={() => setDeletePreview(null)}
                disabled={saving}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}