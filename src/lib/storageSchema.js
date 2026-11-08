const PARTS = ['胸', '背中', '肩', '脚', '腕'];
const RAW_ENUMS = {
  'muscle-memo-sound-mode': ['sound', 'silent'],
  'muscle-memo-category-priority': ['free_weight', 'machine'],
  'muscle-memo-wakelock': ['on', 'off'],
  'muscle-memo-haptics': ['on', 'off']
};
const TEXT_KEYS = ['muscle-memo-user', 'muscle-memo-gemini-key', 'muscle-memo-gemini-model'];
const text = value => typeof value === 'string';
const names = value => Array.isArray(value) && value.every(name => text(name) && name.trim()) && new Set(value).size === value.length;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function customExercises(value) {
  return object(value) && Object.entries(value).every(([part, list]) => PARTS.includes(part) && Array.isArray(list) && list.every(item =>
    (text(item) && item.trim()) || (object(item) && text(item.name) && item.name.trim() &&
      (item.category === undefined || ['free_weight', 'machine'].includes(item.category)))
  ));
}

// Validate each historical on-disk encoding; never parse an untyped preference as JSON.
export function decodeStoredValue(key, raw) {
  if (typeof raw !== 'string') throw new Error('保存値は文字列である必要があります');
  const rawOptions = RAW_ENUMS[key];
  if (rawOptions) {
    if (!rawOptions.includes(raw)) throw new Error('設定値が不正です');
    return raw;
  }
  let validate;
  if (TEXT_KEYS.includes(key)) validate = text;
  else if (key === 'muscle-memo-workouts') validate = Array.isArray;
  else if (key === 'muscle-memo-onboarded') validate = value => typeof value === 'boolean';
  else if (key === 'muscle-memo-coach') validate = value => ['all-might', 'demon', 'gentle', 'professional'].includes(value);
  else if (key === 'muscle-memo-custom-exercises') validate = customExercises;
  else if (PARTS.some(part => key === `muscle-memo-custom-order-${part}`)) validate = names;
  else if (key === 'muscle-memo-timer-endtime') validate = value => Number.isFinite(value) && value >= 0;
  else if (key === 'muscle-memo-deletion-state') validate = value => object(value) && names(value.deletedIds) && Number.isFinite(value.deletedAt) && value.deletedAt >= 0;
  else throw new Error('未対応の設定キーがあります。元データは変更していません');
  let parsed;
  try { parsed = JSON.parse(raw); } catch { throw new Error('保存データのJSON形式が不正です'); }
  if (!validate(parsed)) throw new Error('保存データの型または値が不正です');
  return parsed;
}
