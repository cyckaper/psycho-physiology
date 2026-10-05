// session-summary.mjs — 場次摘要（data.mjs 上傳時登記、daily-log.mjs 每日彙整共用）
// 摘要只含時間、筆數與受測編號，不含任何作答內容或 email。

// 與 console.html 的 parseTime 相同規則：ISO 字串、毫秒、秒、Apple 參考時間（2001 起算秒數）
export function parseTime(v) {
  if (typeof v === "string") { const t = Date.parse(v); return isNaN(t) ? null : t; }
  if (typeof v === "number") {
    if (v > 1e12) return v;
    if (v > 1.2e9) return v * 1000;
    return (v + 978307200) * 1000;
  }
  return null;
}

const STREAMS = ["physiology", "location", "environment", "ema", "activity", "altitude"];

function span(arr) {
  let lo = null, hi = null;
  for (const x of Array.isArray(arr) ? arr : []) {
    const t = parseTime(x && x.time);
    if (t == null) continue;
    if (lo == null || t < lo) lo = t;
    if (hi == null || t > hi) hi = t;
  }
  return lo == null ? null : { lo, hi };
}

// 本機場次代號 L20261005-135300 是台北時間的開始時刻，最可靠
function startFromSessionId(s) {
  const m = /^L(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/.exec(String(s || ""));
  if (!m) return null;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) - 8 * 3600 * 1000;
}

/** 由一筆場次記錄算出摘要。開始時間依序取：場次代號 → 軌跡第一點 → 生理第一筆 → 上傳時間。 */
export function summarize(rec) {
  const track = span(rec.location);
  const phys = span(rec.physiology);
  const fromId = startFromSessionId(rec.session);
  const start = fromId ?? track?.lo ?? phys?.lo ?? (Number(rec.uploadedAt) || null);
  const ends = [track?.hi, phys?.hi].filter((x) => x != null);
  const end = ends.length ? Math.max(...ends) : start;
  const counts = {};
  for (const k of STREAMS) counts[k] = Array.isArray(rec[k]) ? rec[k].length : 0;
  return { code: String(rec.code ?? ""), session: String(rec.session ?? ""), start, end, counts };
}

/** 台北時間的日期字串 YYYY-MM-DD */
export function tpeDate(ms) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date(ms));
}

/** 台北某日 00:00 的 UTC 毫秒 */
export function tpeDayStart(date) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  return Date.UTC(+m[1], +m[2] - 1, +m[3]) - 8 * 3600 * 1000;
}

export { STREAMS };
