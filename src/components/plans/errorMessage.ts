import { isDataError } from '../../data/contracts';

/** 数据层错误本身就是可读中文；其他异常用调用方给的兜底文案。 */
export function errorMessage(error: unknown, fallback: string): string {
  return isDataError(error) && error.message ? error.message : fallback;
}