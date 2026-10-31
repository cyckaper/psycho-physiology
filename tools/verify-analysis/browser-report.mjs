// 在真正的 console.html 裡跑一場合成走測，檢查點層級表與讀人報告（JSON／PDF 共用的 buildReport）。
// 頁面由 Playwright 開啟，/api/* 由本腳本回應，CDN 的 Leaflet／XLSX 換成空殼（離線也能跑，地圖本身不在檢查範圍）。
//
//   node tools/verify-analysis/browser-report.mjs                    驗工作目錄的 console.html＋i18n.js（中、英各一次）
//   node tools/verify-analysis/browser-report.mjs --base origin/main 另外並列線上版的結果（只列不判）
//
// 需要 Playwright 與 Chromium（雲端環境已預裝；本機沒有就 npm i -g playwright && npx playwright install chromium）。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { REPO, gitShow, baseRef, upload } from "./lib.mjs";

const { chromium } = createRequire(import.meta.url)("playwright");

/* 速度每 10 分鐘切換；濕度隨速度變（慢走處濕）但對心率沒有獨立效果；氣溫每升 1°C 心率 +2 */
const DATA=[upload(42, {confound:2, effect:2, phase:0})];

// 任何屬性、任何呼叫都回自己的空殼，代替 Leaflet 與 XLSX
const STUB="(()=>{const h={get:(t,k)=>k===Symbol.toPrimitive?(()=>0):k==='then'?undefined:P,"+
           "apply:()=>P,construct:()=>P};const P=new Proxy(function(){},h);window.L=P;window.XLSX=P;})();";

async function run(root, lang){
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({timezoneId:"Asia/Taipei"});
    await ctx.addInitScript(l=>{ try{ localStorage.setItem("heals_lang", l); }catch(_){} }, lang);
    const page=await ctx.newPage();
    const errors=[];
    page.on("pageerror", e=>errors.push(e.message));
    // Playwright 的 route 後登記者先比對：先登記「外連一律擋」，再登記 CDN 空殼
    await page.route(/^https:\/\//, r=>r.abort());
    await page.route(/^https:\/\/(cdnjs\.cloudflare\.com|accounts\.google\.com)\//,
                     r=>r.fulfill({body:STUB, contentType:"application/javascript"}));
    await page.route("http://site.test/**", r=>{
      const u=new URL(r.request().url());
      if(u.pathname==="/api/data") return r.fulfill({json:DATA});
      if(u.pathname==="/api/projects") return r.fulfill({json:{project:{name:"合成測試"}}});
      if(u.pathname.startsWith("/api/")) return r.fulfill({json:{}});
      const f=path.join(root, u.pathname);
      if(!fs.existsSync(f)) return r.fulfill({status:404, body:""});
      return r.fulfill({body:fs.readFileSync(f), contentType:f.endsWith(".js")?"application/javascript":"text/html"});
    });
    await page.goto("http://site.test/console.html?project=TEST", {waitUntil:"load"});
    await page.waitForFunction(()=>participants.length>0, null, {timeout:20000});
    const out=await page.evaluate(()=>{
      const table=renderPointLevel();
      const b=buildReport();
      const pl=b.rep.sessions[0].pointLevel;
      // 報告必須與畫面用同一份計算：直接重算一次逐項比對
      const st=pointLevelStats(classifyModes(pointDataset(participants[0], b.tol, b.acc)));
      const r3=x=>x==null?null:Math.round(x*1000)/1000;
      const mismatch=pl.variables.filter(v=>{
        const s=st.vars.find(w=>w.def.label===v.variable);
        return !s || r3(s.pa)!==v.rControlled || (s.bc?r3(s.bc.mean):null)!==(v.blockR?v.blockR.mean:null);
      }).map(v=>v.variable);
      return {lang:I18N.lang, tableOk:/k=\d/.test(table), mismatch, vars:pl.variables,
              findings:b.rep.findings, cav5:b.rep.caveats[4]};
    });
    return {errors, ...out};
  }finally{ await browser.close(); }
}

const f2=x=>x==null?"—":(x>=0?"+":"")+x.toFixed(2);
const show=v=>v?`r ${f2(v.r)}、控制後 r ${f2(v.rControlled)}、區塊 `+
  (v.blockR?`${f2(v.blockR.mean)} [${f2(v.blockR.ci95[0])}, ${f2(v.blockR.ci95[1])}] k=${v.blockR.k}`:"—")+`、判定 ${v.verdict}`:"—";
const byKey=(r,prefix)=>r.vars.find(v=>v.variable.startsWith(prefix));
function print(title, r){
  console.log(`\n=== ${title}（${r.lang}）===`);
  console.log("  頁面錯誤：", r.errors.length ? r.errors.join("；") : "無");
  console.log("  濕度（隨速度變，無獨立效果）：", show(byKey(r,"濕度")));
  console.log("  氣溫（真效果）：", show(byKey(r,"氣溫")));
  console.log("  速度：", show(byKey(r,"速度")));
  console.log("  報告句：", r.findings.slice(1).join("\n          "));
  console.log("  限制五：", r.cav5);
}

let fail=0;
const check=(ok,msg)=>{ console.log((ok?"  ✓ ":"  ✗ ")+msg); if(!ok) fail++; };
const excl0=b=>!!b&&(b.ci95[0]>0||b.ci95[1]<0);

for(const lang of ["zh","en"]){
  const r=await run(REPO, lang);
  print("工作目錄", r);
  const hum=byKey(r,"濕度"), tmp=byKey(r,"氣溫"), txt=r.findings.join(" ");
  check(!r.errors.length, "頁面沒有錯誤");
  check(r.lang===lang, "介面語言為 "+lang);
  check(r.tableOk, "畫面的點層級表有區塊欄");
  check(!r.mismatch.length, "報告的控制後 r 與區塊 r 與畫面同一份計算"+(r.mismatch.length?"（不符："+r.mismatch.join("、")+"）":""));
  check(!!hum && !excl0(hum.blockR), "濕度的區塊 CI 涵蓋 0（控制速度後沒有效果）");
  check(!!tmp && !!tmp.blockR && tmp.blockR.ci95[0]>0, "氣溫的區塊 CI 下限 > 0（真效果抓得到）");
  check(!/未控制的區塊|uncontrolled block/.test(txt), "報告句不再標「未控制的區塊 r」");
}

const ref=baseRef(process.argv);
if(ref){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(), "verify-base-"));
  for(const f of ["console.html","i18n.js"]) fs.writeFileSync(path.join(dir,f), gitShow(ref,f));
  print(ref+"（只列不判）", await run(dir, "zh"));
  fs.rmSync(dir, {recursive:true, force:true});
}

console.log(fail ? `\n${fail} 項未通過` : "\n全部通過");
process.exit(fail ? 1 : 0);
