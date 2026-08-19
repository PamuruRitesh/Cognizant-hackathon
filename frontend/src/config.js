// API base URL — override via VITE_API_BASE env variable in .env
// e.g. VITE_API_BASE=http://my-server:8000
export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

/**
 * Shorten a long ID for display. Returns the first 4 + last 4 chars with "…" in between.
 * Full ID is preserved for tooltip use — callers should apply `title={fullId}` themselves.
 * @param {string} id
 * @returns {string}
 */
export const shortenId = (id) => {
  if (!id) return '';
  return id.length > 10 ? `${id.substring(0, 4)}…${id.substring(id.length - 4)}` : id;
};

/**
 * Safe format helper: if a value is null/undefined/NaN/non-numeric, returns fallback.
 * Use this before calling `.toFixed()` etc. on API values.
 * @param {*} value
 * @param {string} fallback
 * @returns {number|null}
 */
export const safeNum = (value, fallback = null) => {
  const n = Number(value);
  return (value !== null && value !== undefined && value !== '' && !isNaN(n)) ? n : fallback;
};
