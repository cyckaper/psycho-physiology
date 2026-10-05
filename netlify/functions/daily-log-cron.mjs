// daily-log-cron.mjs — 每天台北時間 00:10 彙整每日紀錄
// 實際工作在 /api/daily-log（可手動 POST ?date=YYYY-MM-DD 補做）；本函式只負責定時敲門。
// 昨天：剛結束的一整天。前天：再做一次，接住結束後隔天才補傳心率的場次。
export default async () => {
  const base = process.env.URL || "";
  if (!base) return new Response("no site url", { status: 500 });
  const tpe = (ms) => new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(ms));
  const day = 24 * 3600 * 1000;
  for (const d of [tpe(Date.now() - day), tpe(Date.now() - 2 * day)]) {
    try { await fetch(base + "/api/daily-log?date=" + d, { method: "POST" }); }
    catch (_) { /* 隔天會再做一次前天，冪等 */ }
  }
  return new Response("ok");
};

// Netlify 排程用 UTC：16:10 UTC ＝ 台北 00:10
export const config = { schedule: "10 16 * * *" };
