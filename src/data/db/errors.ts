import { DataError, isDataError, type DataErrorCode } from '../contracts';

/** 把 Dexie / IndexedDB / 浏览器异常收敛成可展示、可重试的数据错误。 */
export function toDataError(
  error: unknown,
  fallbackCode: DataErrorCode,
  fallbackMessage: string,
): DataError {
  if (isDataError(error)) return error;

  // Dexie 的事务包装器把原始异常放在 inner 上；优先还原领域错误。
  const wrapped = (error as { inner?: unknown } | null | undefined)?.inner;
  if (wrapped && wrapped !== error) {
    return toDataError(wrapped, fallbackCode, fallbackMessage);
  }

  const named = error as { name?: string; message?: string } | null | undefined;
  const cause = named?.message;
  switch (named?.name) {
    case 'QuotaExceededError':
    case 'QuotaExceeded':
      return new DataError('STORAGE_QUOTA_EXCEEDED', '浏览器存储空间不足，请清理站点数据后重试', { cause });
    case 'DatabaseClosedError':
    case 'OpenFailedError':
    case 'VersionError':
    case 'InvalidStateError':
      return new DataError('DATABASE_UNAVAILABLE', '本地数据库不可用，请刷新页面重试', { cause });
    case 'AbortError':
    case 'ConstraintError':
      return new DataError('TRANSACTION_FAILED', '写入被中止，请重试', { cause });
    default:
      return new DataError(fallbackCode, fallbackMessage, { cause });
  }
}