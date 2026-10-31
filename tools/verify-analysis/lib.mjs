// 驗證腳本共用：從 console.html 抽出分析函式、讀舊版檔案、產生合成走測
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/* 讀某個 git 版本的檔案，例如 gitShow("main","console.html") */
export function gitShow(ref, file){
  return execFileSync("git", ["show", ref+":"+file], {cwd:REPO, encoding:"utf8", maxBuffer:64<<20});
}

/* 命令列的 --base <git ref>：有給就和舊版並列對照 */
export function baseRef(argv){
  const i=argv.indexOf("--base");
  return i>=0 ? argv[i+1] : null;
}

/* 點層級分析用到的函式。新增或改名時同步這份清單，抽不到會直接報錯 */
const NAMES = ["pearson","betacf","gammaln","betai","pFromR","idxNear","decorrelationTimeSec",
               "effectiveNTime","blockCorrelation","residualize","pointLevelStats"];

/* 以大括號配對切出每個 function 宣告，連同 PT_DEFS 放進獨立的 vm 環境執行 */
export function extractAnalysis(html){
  const out=[];
  for(const name of NAMES){
    const i=html.indexOf("function "+name+"(");
    if(i<0) throw new Error("console.html 裡找不到 function "+name+"(");
    let depth=0, j=html.indexOf("{", i);
    for(; j<html.length; j++){
      if(html[j]==="{") depth++;
      else if(html[j]==="}"){ depth--; if(depth===0) break; }
    }
    out.push(html.slice(i, j+1));
  }
  const p=html.indexOf("const PT_DEFS=[");
  if(p<0) throw new Error("console.html 裡找不到 const PT_DEFS=[");
  out.push(html.slice(p, html.indexOf("];", p)+2).replace("const PT_DEFS","var PT_DEFS"));
  const ctx={Math, isFinite, Number, Array, Set, Object};
  vm.createContext(ctx);
  vm.runInContext(out.join("\n"), ctx);
  return ctx;
}

export const readRepo = f => fs.readFileSync(path.join(REPO, f), "utf8");

/* 可重現的亂數 */
export function rng(seed){ let s=seed>>>0||1; return ()=>{ s^=s<<13; s>>>=0; s^=s>>17; s^=s<<5; s>>>=0; return s/4294967296; }; }
export function gauss(u){ return ()=>{ let a=0; while(a===0) a=u(); return Math.sqrt(-2*Math.log(a))*Math.cos(2*Math.PI*u()); }; }

/* 一場合成走測，逐點產出（時間、速度、心率與兩個環境變項）。
   心率每 4–6 秒一筆；速度每 10 分鐘在 0.3 與 4.8 km/h 間切換；
   心率 = 68 + 4×速度 + AR(1) 雜訊（τ≈30 s，SD 3）＋ effect×氣溫距平。
   環境快照每 60 秒一筆、沿用到下一筆：
     濕度：緩變 AR（τ≈8 分），與心率無關；confound>0 時再減 confound×速度（慢走處濕），仍無獨立效果
     氣溫：緩變 AR（τ≈5 分），與速度無關；effect>0 時真的影響心率
   gap:[a,b] 讓第 a–b 分鐘沒有環境快照。 */
export function* walk(seed, opt={}){
  const u=rng(seed), g=gauss(u);
  const minutes=opt.minutes||120, phase=opt.phase ?? (u()<0.5?0:1);
  let t=0, e=0, hum=0, tmp=0, nextEnv=0, humS=0, tmpS=0;
  while(t<minutes*60){
    const dt=4+2*u(); t+=dt;
    const speedSet=(Math.floor(t/600)+phase)%2===1 ? 4.8 : 0.3;
    const speed=speedSet+(opt.speedNoise??0.15)*g();
    e=e*Math.exp(-dt/30)+Math.sqrt(1-Math.exp(-2*dt/30))*3*g();
    hum=hum*Math.exp(-dt/480)+Math.sqrt(1-Math.exp(-2*dt/480))*4*g();
    tmp=tmp*Math.exp(-dt/300)+Math.sqrt(1-Math.exp(-2*dt/300))*0.8*g();
    const envTick=t>=nextEnv;
    if(envTick){ humS=hum; tmpS=tmp; nextEnv+=60; }
    const noEnv=opt.gap && t/60>=opt.gap[0] && t/60<opt.gap[1];
    yield {t, speed, speedSet, envTick, noEnv,
           hr:68+4*speed+e+(opt.effect||0)*tmpS,
           eRH:70+humS-(opt.confound||0)*speed, eTemp:28+tmpS};
  }
}

/* 給 pointLevelStats() 直接吃的逐點資料 */
export function session(seed, opt={}){
  const t0=Date.UTC(2026,9,1,2,0,0), startHour=opt.startHour??10, ds=[];
  for(const w of walk(seed,opt)){
    const rec={t:t0+Math.round(w.t*1000), hr:w.hr, speed:w.speed, hour:startHour+w.t/3600,
               elapsedMin:w.t/60, eRH:w.eRH, eTemp:w.eTemp};
    if(w.noEnv){ delete rec.eRH; delete rec.eTemp; }
    ds.push(rec);
  }
  return ds;
}

/* App 上傳格式（/api/data 回傳的一筆場次），給瀏覽器檢查用。
   軌跡依設定速度往東走，主控台再由座標推回速度；環境快照帶出當下的濕度與氣溫。 */
export function upload(seed, opt={}){
  const t0=Date.UTC(2026,9,1,1,0,0);                   // 台北 09:00
  const physiology=[], location=[], environment=[];
  let lng=121.54, prevT=0; const lat=25.017;
  for(const w of walk(seed,{speedNoise:0, ...opt})){
    lng+=w.speedSet*(w.t-prevT)/3600/100.9;            // 緯度 25° 處 1° 經度約 100.9 km
    prevT=w.t;
    const time=new Date(t0+Math.round(w.t*1000)).toISOString();
    location.push({time, lat, lng, accuracyM:5});
    if(w.envTick && !w.noEnv) environment.push({time, snapshot:{humidityPct:w.eRH, airTempC:w.eTemp}});
    physiology.push({time, metricType:"heart_rate", value:w.hr});
  }
  return {code:"T1", session:"S1", uploadedAt:Date.now(), physiology, location, environment};
}
