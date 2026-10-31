// 點層級分析（控制後 r、去相關時間、區塊相關）的合成資料驗證。
// 從 console.html 抽出函式在 Node 裡跑，餵已知答案的資料，逐項判定通過與否。
//
//   node tools/verify-analysis/point-level.mjs              驗工作目錄的 console.html
//   node tools/verify-analysis/point-level.mjs --base origin/main  另外並列線上版的數字對照（只列不判）
//
// 約需 1 分鐘，加 --base 約 2 分鐘。有任何一項未通過時結束碼為 1。
import { extractAnalysis, readRepo, gitShow, baseRef, session } from "./lib.mjs";

const ref=baseRef(process.argv);
const NEW=extractAnalysis(readRepo("console.html"));
const OLD=ref ? extractAnalysis(gitShow(ref,"console.html")) : null;

const pick=(st,key)=>st.vars.find(v=>v.def.key===key);
const excl0=bc=>!!bc&&(bc.lo>0||bc.hi<0);
const f2=x=>x==null?"—":(x>=0?"+":"")+x.toFixed(2);
const pct=(a,b)=>b?(a/b*100).toFixed(1)+"%":"—";
const fmtBc=bc=>bc?`${f2(bc.mean)} [${f2(bc.lo)}, ${f2(bc.hi)}] k=${bc.k}`:"—";
const sin=h=>Math.sin(h/24*2*Math.PI), cos=h=>Math.cos(h/24*2*Math.PI);
let fail=0;
const check=(ok,msg)=>{ console.log((ok?"  ✓ ":"  ✗ ")+msg); if(!ok) fail++; };
const base=msg=>{ if(OLD) console.log("  （"+ref+"）"+msg); };

/* 對一批場次跑某變項，彙整區塊 CI 不涵蓋 0 的比例與平均 */
function tally(A, seeds, key, optOf){
  const s={n:0, hit:0, sum:0, abs:0, pa:0, byK:{}};
  for(const seed of seeds){
    const v=pick(A.pointLevelStats(session(seed, optOf(seed))), key);
    if(v.pa!=null) s.pa+=v.pa;
    if(!v.bc) continue;
    s.n++; s.sum+=v.bc.mean; s.abs+=Math.abs(v.bc.mean);
    const b=s.byK[v.bc.k]||(s.byK[v.bc.k]=[0,0]); b[1]++;
    if(excl0(v.bc)){ s.hit++; b[0]++; }
  }
  return s;
}
const range=(a,b)=>Array.from({length:b-a+1},(_,i)=>a+i);

console.log("\n[1] 虛無：濕度與心率無關（400 場，一半 75 分、一半 120 分，區塊數 k 才會分散）");
{
  const opt=s=>({minutes: s%2 ? 120 : 75});
  const n=tally(NEW, range(1,400), "eRH", opt);
  console.log(`  區塊 CI 不涵蓋 0：${n.hit}/${n.n} = ${pct(n.hit,n.n)}，平均 |區塊 r| ${(n.abs/n.n).toFixed(3)}`);
  console.log("  依 k：", Object.entries(n.byK).map(([k,[h,t]])=>`k=${k} ${h}/${t}`).join("，"));
  if(OLD){ const o=tally(OLD, range(1,400), "eRH", opt); base(`不涵蓋 0：${pct(o.hit,o.n)}，平均 |區塊 r| ${(o.abs/o.n).toFixed(3)}`); }
  check(n.hit/n.n<=0.08, "假陽性率不超過 8%");
}

console.log("\n[2] 干擾：濕度 = 70 − 2×速度 + 雜訊，對心率沒有獨立效果（200 場）");
{
  const opt=()=>({confound:2});
  const n=tally(NEW, range(1001,1200), "eRH", opt);
  console.log(`  平均區塊 r ${f2(n.sum/n.n)}，不涵蓋 0 ${pct(n.hit,n.n)}；控制後 r 平均 ${f2(n.pa/200)}`);
  if(OLD){ const o=tally(OLD, range(1001,1200), "eRH", opt); base(`平均區塊 r ${f2(o.sum/o.n)}，不涵蓋 0 ${pct(o.hit,o.n)}`); }
  check(Math.abs(n.pa/200)<0.03, "控制後 r 平均接近 0");
  check(Math.abs(n.sum/n.n)<0.03, "區塊 r 平均接近 0");
  check(n.hit/n.n<=0.08, "假陽性率不超過 8%");
}

console.log("\n[3] 真效果：心率 += 2×氣溫距平，氣溫與速度無關（200 場）");
{
  // 已知答案：心率扣掉真實的速度項後與氣溫的相關。整段一個；區塊內各一個（用結果的同一套區塊格線）。
  // 氣溫緩變，區塊內變異比整段小，所以區塊 r 本來就比整段 r 低，兩者各對各的答案。
  let nb=0, hit=0, mb=0, mpa=0, oracle=0, oracleW=0, oHit=0, mo=0, on=0;
  for(const seed of range(2001,2200)){
    const ds=session(seed,{effect:2});
    const v=pick(NEW.pointLevelStats(ds),"eTemp");
    const ts=ds.map(d=>d.t), xs=ds.map(d=>d.eTemp), y=ds.map(d=>d.hr-4*d.speed);
    mpa+=v.pa; oracle+=NEW.pearson(xs,y).r;
    if(OLD){ const o=pick(OLD.pointLevelStats(ds),"eTemp"); if(o.bc){ on++; mo+=o.bc.mean; if(o.bc.lo>0) oHit++; } }
    if(!v.bc) continue;
    nb++; mb+=v.bc.mean; if(v.bc.lo>0) hit++;
    const B=v.bc.blockSec*1000, K=Math.floor((ts[ts.length-1]-ts[0])/B), rs=[];
    for(let k=0;k<K;k++){
      const lo=ts[0]+k*B, hi=lo+B, bx=[], by=[];
      for(let i=0;i<ts.length;i++) if(ts[i]>=lo&&ts[i]<hi){ bx.push(xs[i]); by.push(y[i]); }
      if(bx.length>=15) rs.push(NEW.pearson(bx,by).r);
    }
    oracleW+=rs.reduce((a,b)=>a+b,0)/rs.length;
  }
  console.log(`  已知答案：整段 r ${f2(oracle/200)}，區塊內 r ${f2(oracleW/nb)}`);
  console.log(`  控制後 r 平均 ${f2(mpa/200)}；區塊 r 平均 ${f2(mb/nb)}，CI 下限 > 0 ${pct(hit,nb)}`);
  base(`區塊 r 平均 ${f2(mo/on)}，CI 下限 > 0 ${pct(oHit,on)}`);
  check(Math.abs(mpa/200-oracle/200)<0.05, "控制後 r 與整段答案相差 < 0.05");
  check(Math.abs(mb/nb-oracleW/nb)<0.05, "區塊 r 與區塊內答案相差 < 0.05");
  check(hit/nb>0.8, "檢出率 > 80%");
}

console.log("\n[4] 缺值對齊：第 50–70 分鐘沒有環境快照，結果應等於先剔除缺值點再算");
{
  const ds=session(77,{gap:[50,70]}), v=pick(NEW.pointLevelStats(ds),"eRH");
  const cc=ds.filter(d=>isFinite(d.eRH));
  const ctrl=[cc.map(d=>d.speed), cc.map(d=>sin(d.hour)), cc.map(d=>cos(d.hour))];
  const rx=NEW.residualize(cc.map(d=>d.eRH),ctrl), ry=NEW.residualize(cc.map(d=>d.hr),ctrl);
  const pa=NEW.pearson(rx,ry).r, bc=NEW.blockCorrelation(cc.map(d=>d.t),rx,ry,v.tau);
  console.log(`  缺值 ${ds.length-cc.length}／${ds.length} 點；pointLevelStats 控制後 r ${v.pa.toFixed(6)}、區塊 ${fmtBc(v.bc)}`);
  console.log(`  ${" ".repeat(String(ds.length-cc.length).length+String(ds.length).length+8)}先剔除再算 控制後 r ${pa.toFixed(6)}、區塊 ${fmtBc(bc)}`);
  check(Math.abs(v.pa-pa)<1e-9, "控制後 r 一致");
  check(!!bc && !!v.bc && Math.abs(v.bc.mean-bc.mean)<1e-9 && v.bc.k===bc.k, "區塊 r 與 k 一致");
}

console.log("\n[5] 各變項的控制組（50 場，逐場與手算比對）");
{
  let dPa=0, dBc=0, dSpd=0, dHour=0, miss=0;
  const diff=(a,b)=>{ if(!a&&!b) return 0; if(!a||!b){ miss++; return 0; } return Math.abs(a.mean-b.mean)+Math.abs(a.lo-b.lo)+Math.abs(a.k-b.k); };
  for(const seed of range(3001,3050)){
    const ds=session(seed,{effect:1}), st=NEW.pointLevelStats(ds);
    const ts=ds.map(d=>d.t), hr=ds.map(d=>d.hr), sp=ds.map(d=>d.speed);
    const hs=ds.map(d=>sin(d.hour)), hc=ds.map(d=>cos(d.hour));
    // 環境變項與已經過時間：控制速度＋時刻 sin/cos
    for(const key of ["eRH","eTemp","elapsedMin"]){
      const v=pick(st,key), x=ds.map(d=>d[key]);
      const rx=NEW.residualize(x,[sp,hs,hc]), ry=NEW.residualize(hr,[sp,hs,hc]);
      dPa=Math.max(dPa, Math.abs(v.pa-NEW.pearson(rx,ry).r));
      dBc=Math.max(dBc, diff(v.bc, NEW.blockCorrelation(ts,rx,ry,v.tau)));
    }
    // 時刻：只控速度
    const h=pick(st,"hour"), hx=ds.map(d=>d.hour);
    dHour=Math.max(dHour, diff(h.bc, NEW.blockCorrelation(ts,NEW.residualize(hx,[sp]),NEW.residualize(hr,[sp]),h.tau)));
    // 速度：不控制，用原始值
    const s=pick(st,"speed");
    dSpd=Math.max(dSpd, diff(s.bc, NEW.blockCorrelation(ts,sp,hr,s.tau)));
  }
  check(dPa<1e-12, `環境變項與已經過時間的控制後 r＝控制速度＋時刻 sin/cos 的殘差相關（最大差 ${dPa.toExponential(1)}）`);
  check(dBc<1e-12, `其區塊 r＝同一組殘差的區塊相關（最大差 ${dBc.toExponential(1)}）`);
  check(dHour<1e-12, `時刻的區塊 r＝只控速度的殘差區塊相關（最大差 ${dHour.toExponential(1)}）`);
  check(dSpd<1e-12, `速度的區塊 r＝原始值的區塊相關（最大差 ${dSpd.toExponential(1)}）`);
  check(miss===0, `有無區塊結果與手算一致（不一致 ${miss} 處）`);
}

console.log(fail ? `\n${fail} 項未通過` : "\n全部通過");
process.exit(fail ? 1 : 0);
