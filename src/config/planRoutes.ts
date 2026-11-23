/**
 * 旅行计划模块的路径助手。路由本身已由 V1-05 在 App.tsx 注册，
 * 这里只集中构造链接，避免各页面手拼字符串。
 */
export const PLAN_MAP_PATH = '/section/plans';

export function planCityPath(cityId: string): string {
  return `/plan/city/${encodeURIComponent(cityId)}`;
}

export function planNewPath(cityId?: string): string {
  const trimmed = cityId?.trim();
  return trimmed ? `/plan/new?cityId=${encodeURIComponent(trimmed)}` : '/plan/new';
}

export function planPath(planId: string): string {
  return `/plan/${encodeURIComponent(planId)}`;
}