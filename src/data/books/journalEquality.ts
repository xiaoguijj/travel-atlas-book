import type { JournalContent } from '../contracts';

/** Compare the stored JSON, including unknown fields, without depending on key order. */
export function sameJournalContent(left: JournalContent | undefined, right: JournalContent | undefined): boolean {
  return equalValue(left, right);
}

function equalValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  } else {
    // Only JSON records have comparable fields. Date/Map/etc. must not compare
    // equal merely because Object.keys would return an empty list for both.
    const plain = (value: object) => Object.getPrototypeOf(value) === Object.prototype
      || Object.getPrototypeOf(value) === null;
    if (!plain(left) || !plain(right)) return false;
  }
  const leftRecord = left as Record<PropertyKey, unknown>;
  const rightRecord = right as Record<PropertyKey, unknown>;
  // Include array holes and extra own fields: damaged stored data is still data
  // and must not be treated as an unchanged baseline that is safe to overwrite.
  const keys = Reflect.ownKeys(leftRecord);
  return keys.length === Reflect.ownKeys(rightRecord).length
    && keys.every((key) => Object.prototype.hasOwnProperty.call(rightRecord, key)
      && equalValue(leftRecord[key], rightRecord[key]));
}
