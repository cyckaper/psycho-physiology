# CLAUDE.md — 讀人 · 即時心理生理研究平台

> 這是給 Claude Code 的工作說明。動手前請整份讀完，特別是「血淚教訓」一節——
> 那些都是已經踩過的坑，重蹈一次會毀掉正在收的資料。

---

## 一、這是什麼

**讀人 Reading People · 即時心理生理研究平台**
在戶外走測時，把受測者的**問卷答案**與**當下的生理、時間、空間**自動綁定。
研究者在網頁畫定「反應區」，受測者走進去的那一刻，手機擷取座標、心率、環境快照
並立即跳出現場問卷；離區未填則自動作廢，以維持生態瞬時評估（EMA）的效度。

負責人：張俊彥（Jake），台大園藝暨景觀學系 · Lab204 健康景觀研究室

### 三層架構

| 層 | 內容 | 位置 |
|---|---|---|
| 網頁後台 | 專案設定、反應區、問卷、資料主控台、即時監看 | **本 repo** |
| iPhone App | HealthProbe，受測者執行與記錄 | Xcode 專案，**不在本 repo** |
| Apple Watch | 心率來源，全程零設定，由手機操控 | 同上 |

---

## 二、部署

- Netlify 專案名 **psycho-physiology**，site ID `522fd44d-b625-4943-9a33-5737ae7dce13`
- 對應 repo：`cyckaper/psycho-physiology`（**有連字號**，與 Netlify 專案名一致）。
  另有同內容的 `cyckaper/psychophysiology`（無連字號）鏡像，目前 HEAD 與本 repo 同一個 SHA，
  但 2026-09-20 上線的正式部署，其來源 commit 記在**有連字號**的這個 repo，工作一律在此進行。
- ⚠ 該次部署的 `deploy_source` 記為 `api`、`manual_deploy: false`。
  若下次 push 到 main 沒有自動觸發建置，先到 Netlify 後台確認 GitHub 自動建置的連結仍在，
  不要改用 API 補部署（見下方警告）。
- 網址：`psycho-physiology.healsdesign.org`
- **push 到 main 即自動部署**。這是唯一正途。

> ⚠ 不要用 Netlify API 直接部署。站台以 GitHub 為單一真相來源，
> API 部署會讓兩邊不同步，下一次 push 就把改動蓋掉。

部署前務必：所有 HTML 的內嵌 script 過一次語法檢查（見「五、開發慣例」）。

---

## 三、repo 內容

### 網頁（根目錄）

| 檔 | 用途 |
|---|---|
| `index.html` | 專案列表首頁，每 30 秒刷新、顯示即時測試人數 |
| `project.html` | 專案樞紐：1 設定 → 2 範圍 → 3 問卷 → 4 資料 |
| `zones.html` | 反應區設定（Leaflet 畫多邊形，存 GeoJSON） |
| `survey.html` | 問卷設計，可上傳 PDF/Word 由 AI 解析題目 |
| `console.html` | **資料主控台**。場次對接、Excel 匯出、Drive 存檔、脈絡分析、點層級分析、模型診斷 |
| `live.html` | 即時監看地圖 |
| `guide.html` | 操作手冊（**內容過時，仍停在舊架構，待重寫**） |
| `panel.html` | 舊控制面板（過渡期保留） |
| `i18n.js` | 全站中英字典與切換模組 |

### 後端（`netlify/functions/`）

| 函式 | 路徑 | 用途 |
|---|---|---|
| `projects.mjs` | `/api/projects` | 專案登記表 CRUD |
| `zones.mjs` | `/api/zones` | 反應區 GeoJSON |
| `survey.mjs` | `/api/survey` | 問卷定義（intake + ema） |
| `data.mjs` | `/api/data` | **場次上傳**。生理／軌跡／環境／EMA／活動／高度 六條流 |
| `live.mjs` | `/api/live` | 走測即時回報與監看查詢 |
| `ai-survey.mjs` | `/api/ai-survey` | PDF/Word → AI 解析題目 |
| `command.mjs` | `/api/command` | 遠端開始／停止（過渡期保留） |
| `drive-sync.mjs` | `/api/drive-sync` | 場次自動封存至 Google Drive |
| `drive-sync-cron.mjs` | 排程 `*/5 * * * *` | 每 5 分鐘觸發 drive-sync |

### 環境變數（Netlify 後台設定，不在 repo）

```
GDRIVE_FOLDER_ID
GDRIVE_OAUTH_CLIENT_ID / GDRIVE_OAUTH_CLIENT_SECRET / GDRIVE_OAUTH_REFRESH_TOKEN
ANTHROPIC_API_KEY          # 問卷 AI 解析用
GDRIVE_SA_KEY              # 舊服務帳戶，已停用但保留
```

---

## 四、血淚教訓（違反會毀資料）

1. **Blobs 的 key 不能含 `#`**
   URL 片段會被截斷，導致整個 key 塌縮互蓋，不同受測者的資料互相覆寫。
   受測編號常是 `#1`，所有寫入前一律以 `seg()` 剔除。

2. **不要連續寫多個 key 後用 `list()` 讀**
   Netlify Blobs 的 `list()` 有延遲，只會認到最後一筆。
   所有記錄一律**單一 key 寫入**；清單簿 `heals-data-index/manifest`
   以 `consistency:"strong"` 單筆讀取確保即時。

3. **Google Drive 用 OAuth，不要用服務帳戶**
   2025 後服務帳戶無儲存配額，寫入必定失敗。已改用使用者 refresh token。

4. **iOS 模型新增欄位一律 `Optional`**
   非 Optional 的新欄位會讓舊 JSON 解碼失敗、整筆資料消失。

5. **網頁的 `i18n.js` 必須同步載入，不能 `defer`**
   內嵌 script 同步執行，`defer` 會讓 `I18N` 尚未定義就被呼叫，
   拋錯後該頁所有後續程式（含讀取專案代號、抓資料）全部停擺。
   `console.html` 內另有 `TT()` 容錯包裝，新增翻譯呼叫請一律走 `TT()`。

6. **整段替換程式碼前，先列出該段定義了什麼、有誰還在用**
   曾因整段改寫刪掉仍被引用的 `fmtP()`，語法檢查抓不到，
   執行到那行才爆，整頁空白。

---

## 五、開發慣例

### 部署前檢查（必做）

```bash
# HTML 內嵌 script 語法檢查
node -e "
const fs=require('fs');
for (const f of ['index.html','project.html','zones.html','survey.html','console.html','live.html']) {
  const html=fs.readFileSync(f,'utf8');
  [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach((m,i)=>
    fs.writeFileSync('/tmp/_chk'+i+'.js', m[1]));
}"
for js in /tmp/_chk*.js; do node --check "$js" || exit 1; done
node --check i18n.js
for f in netlify/functions/*.mjs; do node --check "$f" || exit 1; done
```

### 統計／分析程式碼

`console.html` 的分析區塊（相關、去相關時間、區塊重抽、殘差化）
**改動後必須以合成資料實跑驗證**，不能只過語法檢查。
做法：把函式抽出來在 Node 裡 eval，餵已知答案的資料，確認輸出符合預期。
過去每一次只驗語法就交差，都在使用者端才爆。

### 語言

- 介面中英雙語，字典集中在 `i18n.js`
- **Excel 匯出的欄位名固定中英並陳**（如 `氣溫 AirTemp (°C)`），
  不隨介面語言改變——跨檔合併時欄位鍵才唯一

---

## 六、分析方法（已定案的決定）

資料站的分析不是普通圖表，背後有一串刻意的方法決定，改動前請先理解：

1. **分析在單一場次之內進行**。跨場次把點混在一起會把場次差異偷渡回來，
   可能產生辛普森悖論。場次是分層，不是分析單位。

2. **必須控制速度與晝夜**。活動強度是心率最主要決定因子；
   時刻是**環形變數**，用線性項控制不掉晝夜節律，
   須拆成 `sin/cos` 兩分量，以多元迴歸殘差化處理（`residualize()`）。
   實測：某跨日資料氣溫×心率 r=0.88，只控速度剩 0.87，
   線性小時剩 0.86，改環形後掉到 0.02。

3. **自相關分三級處理**。取樣間隔不均勻（運動中約 5 秒、靜止時稀疏），
   不以相鄰兩筆定義自相關，而是用實際時間戳估去相關時間 τ。
   - 一級：只報 r（效果量），永遠成立
   - 二級：`n_eff = 總時長 ÷ 2τ`，據此算 p
   - 三級：切成長於 2τ 的區塊各自求 r，以區塊間變異給 95% CI
     **三者以區塊結果最值得採信**

4. **移動模式分層**。步行／騎行／車輛／靜止／室內的心率—速度關係截然不同。
   目前為**推定**（速度＋心率抬升＋GPS 精度）；
   App 已加入 CoreMotion 實測，待有資料後改用實測值。

5. **模式分布以時間加權呈現**，不是點數。
   實測：騎行 30 分鐘＋靜止 10 小時的資料，點數上騎行佔 85%，
   時間上只佔 9%。點數佔比會嚴重高估密集取樣的時段。

6. **超過 12 小時的場次不可分析**，會顯示橘色警告。
   那是走測未按結束、App 持續記錄，混雜睡眠與通勤。

---

## 七、iOS 端現況（不在本 repo，但後端契約相關）

Xcode 專案在 Jake 的 Mac：`~/Desktop/HealthProbe/`
Bundle ID `org.healsdesign.HealthProbe`，Team ID `494F396377`

**最近一批已完成並裝機**（2026-09-20）：

- `ActivityProbe.swift`（新增）— CoreMotion 實測活動類型＋氣壓計相對高度
- `LocationTrack.swift` — TrackPoint 補 `speedMps` / `courseDeg` / 各精度 / `altitudeM`
  （一律取 CoreLocation 原生值，不由座標相減推算；無效時裝置回負值→存 nil）
- `Environment.swift` — 補風向、短波輻射；新增 `ThermalIndex` 個人化對流冷卻指標
- `EnvironmentStream.swift` — 走測期間取樣 5 分鐘 → 60 秒
- `Location.swift` — 走測開始時自動清除開發用 `demo_site` 圓形圍欄
- `RemoteSwitch.swift` — 上傳包新增 `activity` / `altitude`；
  加入忘記結束的防護（3 小時提醒、6 小時自動結束並上傳）

**Info.plist 需有**：`NSMotionUsageDescription`（少了會閃退）

### 後端契約

`data.mjs` 已接受 `activity` 與 `altitude` 兩個新欄位，且**向下相容**
（舊版 App 未送 → 空陣列，計數為 0）。`drive-sync.mjs` 會多封存
`活動類型.json` 與 `高度.json`。

---

## 八、待辦

| 優先 | 項目 | 說明 |
|---|---|---|
| 高 | TestFlight 上架與十組佈署 | 直裝要逐台接線、開發者模式、信任電腦，十組成本過高；簽署一年到期。TestFlight 另有機會解決側載造成的「手錶未安裝本 App」誤判 |
| 中 | 行事曆分級取用 | 規格已定案（三級：忙碌度／時間結構／含標題），需 EventKit 與 Info.plist 權限字串。預設第一級給受測者 |
| 中 | `guide.html` 重寫 | 內容停在三個月前的舊架構（遠端遙控那套），與現行自助走測流程不符 |
| 低 | 資料站改用實測活動類型 | 等有一筆帶 `activity` 欄位的資料回來再做 |
| 低 | 相關分析的時間加權 | 目前只有顯示做了時間加權，計算仍是點權重。待看實際取樣密度分布再決定，貿然加權可能引入新假設 |
| 低 | Drive 資料夾更名 | 「HEALS 場域研究」→「讀人 場域研究」 |
| 低 | 整站通行碼 | 正式收案前加一道 passcode（參考 eco4design 模式） |

### 已知但不急的技術債

- `PhysiologyHarvest.swift` / `ScheduledSurvey.swift` 有 Swift 並行隔離警告
  （主執行緒隔離、Sendable closure），目前不影響運作
- 主控台偶見 `unsafeForcedSync` 執行期提示，來源為系統框架回呼

---

## 九、給 Code 的工作原則

1. **先讀後寫**。改任何檔案前先讀線上實際版本（repo 是公開的，可直接讀）。
   過去多次發生「以為覆蓋了其實沒有」的來回。

2. **不要只驗語法就交差**。分析程式碼一定要實跑；
   後端函式改動後以模擬 Blobs 跑過上傳流程。

3. **誠實回報**。做不到的事直說，不要用看似可行的方案繞過。
   Jake 要的是能用的東西，不是看起來完成的東西。

4. **主動提出流程改善**。若發現「改一個地方就能大幅升級工作流程」的事，
   直接提出，不必等問。

5. **回覆用台灣中文，流暢散文，不要條列**。
