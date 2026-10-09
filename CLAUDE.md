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
- GitHub 自動建置**確認可用**：PR #1 一推上來就觸發了 Netlify deploy preview
  （2026-09-20），代表 GitHub App 連結正常、git 事件會建置。
  站台某次正式部署的 `deploy_source` 曾記為 `api`，但那不代表連結斷了。
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
| `daily.html` | 每日紀錄：逐日列出有走測的專案、各場次與六條流筆數；今天為即時彙整 |
| `guide.html` | 操作手冊。中英雙語，內文兩語寫在頁內、靠 `body.en` 擇一顯示（長篇不進 `i18n.js` 共用字典，那份字典每頁都同步載入） |
| `panel.html` | 舊控制面板。**已退役**（自助走測上線），檔案暫留未刪 |
| `i18n.js` | 全站中英字典與切換模組 |

### 後端（`netlify/functions/`）

| 函式 | 路徑 | 用途 |
|---|---|---|
| `projects.mjs` | `/api/projects` | 專案登記表 CRUD |
| `zones.mjs` | `/api/zones` | 反應區 GeoJSON |
| `survey.mjs` | `/api/survey` | 問卷定義（intake + ema） |
| `data.mjs` | `/api/data` | **場次上傳**。生理／軌跡／環境／EMA／活動／高度 六條流 |
| `live.mjs` | `/api/live` | 走測即時回報與監看查詢（含 `wo`：手錶上本 App 的體能訓練是否在跑） |
| `ai-survey.mjs` | `/api/ai-survey` | PDF/Word → AI 解析題目 |
| `command.mjs` | `/api/command` | 遠端開始／停止。**已退役**，端點暫留以防舊版 App 仍在輪詢 |
| `drive-sync.mjs` | `/api/drive-sync` | 場次自動封存至 Google Drive。專案資料夾名為「專案名稱（代號）」，身分認資料夾 ID（對應存 `heals-drive-folders/projects`），網頁上改專案名稱，Drive 資料夾會就地跟著改；**不要在 Drive 手動改名**，下次封存會被改回登記表的名稱 |
| `drive-sync-cron.mjs` | 排程 `*/5 * * * *` | 每 5 分鐘觸發 drive-sync |
| `daily-log.mjs` | `/api/daily-log` | 每日紀錄：彙整某日（台北時間，以場次開始時間歸日）的專案與筆數，存 `heals-daily-log`，並在 Drive「每日紀錄」資料夾寫 CSV |
| `daily-log-cron.mjs` | 排程 `10 16 * * *` | UTC 16:10＝台北 00:10，彙整昨天並重做前天（接住隔天補傳的心率） |

共用模組放在 `netlify/lib/`（不在 functions 目錄，免得被當成端點）：
`session-summary.mjs` 算場次摘要（開始／結束時間、各流筆數）。`data.mjs` 上傳時把摘要
登記進清單簿 `heals-data-index/manifest` 的 `sum`，每日紀錄只讀清單簿即可；
`sum` 只含時間、筆數與受測編號，**不可放作答內容或 email**。

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

7. **Xcode 簽署失敗，先看 target 的 Team 選對了沒**
   `cycmail@ntu.edu.tw` 底下掛**兩個團隊**：`Chun-Yen Chang`（Admin，
   Team ID `494F396377`，正主）與 `Chun Yen Chang|10619785684|1`（**Sales**）。
   Sales 角色不能建憑證、不能註冊裝置、不能產生描述檔，也無權同意該團隊的合約。
   專案誤掛到 Sales 時，Xcode 報的是
   「Unable to process request - PLA Update available: You currently don't have
   access to this membership」——看起來像合約沒簽，其實是選錯團隊，
   跑去同意合約、重登帳號、清描述檔**通通沒用**。2026-10-02 為此卡掉一小時。
   一眼判別：Xcode 設定 → Apple Accounts 點進團隊，Sales 那個的
   「Certificates, Identifiers, & Profiles」是紅色 ⊗，Admin 的是綠色 ✓ 且有
   On Device Testing 與 Download Manual Profiles。
   改的時候**每一個 target 都要改**（主程式、Watch App、各擴充），
   漏一個的錯誤訊息和沒改時一模一樣，很容易誤判成沒生效。

8. **手錶 App 必須包進手機版，不能是 standalone**
   原本 Watch App target 的 Info 設了「App is only available as a standalone watchOS app」=YES，
   iPhone target 也沒有 Embed Watch Content。後果一連串：iPhone「Watch」App 的可安裝清單裡沒有
   HealthProbe；手機的 `WCSession.isWatchAppInstalled` 一直是 false（畫面誤導受測者去開「戶外步行」）；
   手錶只能靠 Xcode 的無線通道安裝，偏偏那條常報「Bluetooth connection to the device was
   invalidated before tunnel could be created」，2026-10-05 為此卡掉半天。
   正確設定：Watch target 的 standalone 設 NO、加 `WKCompanionAppBundleIdentifier`
   ＝`org.healsdesign.HealthProbe`；Watch 的 Bundle ID 必須以手機版為前綴
   （`org.healsdesign.HealthProbe.watchkitapp`）；iPhone target 的 Build Phases 加 Target Dependency
   與 Copy Files 階段「Embed Watch Content」（Products Directory，Subpath
   `$(CONTENTS_FOLDER_PATH)/Watch`），放進去的是 **`.app` 產物，不是 `.swift`**；
   「Code Sign On Copy」反灰勾不了是正常的。之後跑 iPhone scheme 手錶版就跟著裝，TestFlight 也靠這個結構。

9. **WCSession 的 delegate 每台裝置只能有一個主人**
   手機端是 `WatchLink`，手錶端是 `WorkoutProbe`（兩者都在 init 裡設 delegate 並 activate）。
   新功能要收 WatchConnectivity 訊息，**一律在這兩支的 delegate 方法裡轉發**，不可自己再設
   `WCSession.default.delegate`——後設的會把前一個整個頂掉，不報錯，
   手錶端被頂掉時手機按「結束」手錶就收不到，走測停不下來。

10. **Swift 檔一律以檔案取代，不要從預覽複製貼上**
   預覽畫面會吃掉字串插值 `\(` 的反斜線，引號跟著錯位，整支檔案的括號全亂，
   Xcode 報一長串「Expected '}'」與連帶的「找不到成員」。取代時在 Xcode 對檔案右鍵
   「Show in Finder」，確定換的是它實際編譯的那一份。另外，左側問題清單會留著上一次建置的
   舊錯誤（常是灰色圖示），換完檔要清除建置資料夾重建一次才會更新，別對著舊錯誤除錯。

11. **手錶版經手機安裝失敗，先讀錯誤碼再動手**
   手機「Watch」App 的「could not be installed at this time」與手錶上的
   「integrity could not be verified」都是通用訊息，背後原因不只一種。用 Mac 的 Console（主控台）
   選那台手機，搜尋 `process:appconduitd` 再加 `Failed`，**先按開始、再按安裝**，讀 Extended 後的代碼：
   `0xe8008015`＝描述檔裡沒有這支錶（沒登記，或登記成別支錶）；
   `0xe8008017`＝手錶版簽完名後被改過（換了描述檔卻沒重新簽名）。
   手錶不必連上 Xcode 也能裝：從**手機那一頁的 PAIRED WATCHES** 抄手錶的 Identifier（只取括號前那段），
   在開發者網站 Devices 手動登記 → 把 `~/Library/Developer/Xcode/UserData/Provisioning Profiles/` 的檔案搬走
   → **Clean Build Folder** → 對手機 Run → 用 `codesign --verify --deep --strict` 與
   `security cms -D -i …/embedded.mobileprovision | grep -c <UDID>` 核對 → 再從「Watch」App 安裝，
   在手錶上開一次 App、打開開發者模式。2026-10-09 實際連踩兩次：先是從 Xcode 左側清單抄錯成
   同名的另一支錶（好幾支都叫「…的 Apple Watch」），接著又因沒做 Clean Build Folder 而遇到 0xe8008017。
   手錶連 Xcode 在校園網路常卡在「Timed out while attempting to establish tunnel」，不必等它。

---

## 五、開發慣例

### 部署前檢查（必做）

```bash
# HTML 內嵌 script 語法檢查
node -e "
const fs=require('fs');
for (const f of ['index.html','project.html','zones.html','survey.html','console.html','live.html','guide.html','daily.html']) {
  const html=fs.readFileSync(f,'utf8');
  [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach((m,i)=>
    fs.writeFileSync('/tmp/_chk'+i+'.js', m[1]));
}"
for js in /tmp/_chk*.js; do node --check "$js" || exit 1; done
node --check i18n.js
for f in netlify/functions/*.mjs netlify/lib/*.mjs; do node --check "$f" || exit 1; done
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
Bundle ID `org.healsdesign.HealthProbe`（手錶 `org.healsdesign.HealthProbe.watchkitapp`，包在手機版內，見血淚教訓八），Team ID `494F396377`
（＝Apple Accounts 裡的 `Chun-Yen Chang`／Admin 那個；另一個 Sales 團隊簽不了，見血淚教訓七）

**最近一批已完成並裝機**（2026-09-20）：

- `ActivityProbe.swift`（新增）— CoreMotion 實測活動類型＋氣壓計相對高度
- `LocationTrack.swift` — TrackPoint 補 `speedMps` / `courseDeg` / 各精度 / `altitudeM`
  （一律取 CoreLocation 原生值，不由座標相減推算；無效時裝置回負值→存 nil）
- `Environment.swift` — 補風向、短波輻射；新增 `ThermalIndex` 個人化對流冷卻指標
- `EnvironmentStream.swift` — 走測期間取樣 5 分鐘 → 60 秒
- `Location.swift` — 走測開始時自動清除開發用 `demo_site` 圓形圍欄
- `RemoteSwitch.swift` — 上傳包新增 `activity` / `altitude`；
  加入忘記結束的防護（3 小時提醒、6 小時自動結束並上傳）

**即時心率一批**（2026-10-05 裝機實測通過：監看頁心率年齡數十秒內、與手錶一致）：

- `LiveHeartRelay.swift`（新增，手錶）— workout builder 每收到心率就經 WatchConnectivity 推給手機
  （5 秒節流；可達走 `sendMessage`，否則 `updateApplicationContext` 只留最新一筆），
  並回報「本 App 的體能訓練是否在跑」。手錶畫面那行小字是它的自我診斷（「⌚ msg #n 心率」＝正常）
- `LiveHeartReceiver.swift`（新增，iOS）— 收最新心率與訓練狀態；`reportFields()` 每次 `/api/live` 回報呼叫一次
- `WorkoutProbe.swift` — 接上 relay；session 被別的體能訓練或系統結束時把 `running` 歸零
  （原本會卡在 true，之後 iPhone 再叫也開不起來）
- `WatchLink.swift` — 轉發手錶訊息給 receiver；**整場走測每 25 秒看守**，訓練沒在跑就重叫
  （`startWatchApp` 加送 `{"cmd":"start"}`，手錶端已在跑會略過，不會開出第二個 session），
  每次中斷最多重試三次後發通知；按「結束走測」先取消看守。誤判未安裝時不再請受測者開「戶外步行」
- `RemoteSwitch.swift` — 回報心率取「即時推送、HealthKit 查詢、既有串流」三者最新；多送 `wo`
- `MainView.swift` — 移除「請在 Apple Watch 開戶外步行」；Apple Watch 列以手錶回報的訓練狀態為準

背後的兩個事實：沒有體能訓練時手錶心率只會幾分鐘抽測一次、App 也會被掛起，即時通道整條失效；
Apple Watch 同時只能跑一個體能訓練，另開會讓原本的收到 `HKErrorAnotherWorkoutSession` 並結束。
所以**受測者不要自己開「戶外步行」，也不要在手錶上按停止**，結束一律在手機按。

**Info.plist 需有**：`NSMotionUsageDescription`（少了會閃退）

**部署門檻與裝置**（2026-10-08 查證、10-09 實測）：

- iPhone 與 Watch 兩個 target 的 Minimum Deployments 都是 **26.5**，低於此版本的裝置任何管道都裝不上
- 手機要能跑 iOS 26：iPhone 11 以後、SE 第二／三代（Apple 文件對 SE 第二代能否帶手錶升 watchOS 26 說法不一）。
  iPhone 7 停在 iOS 15，配著它的手錶也卡在 watchOS 8，只能換手機（心動農場 006 即是）
- 手錶 Series 6 以後；Series 6／7／8 的最後一版是 watchOS 26（watchOS 27 不支援）
- 已升 iOS 27 的手機，Xcode 26 仍可安裝，但不能除錯（Xcode 顯示 `dyld_shared_cache_extract_dylibs failed`）。
  Xcode 27 只裝在 Apple 晶片 Mac、需 macOS Tahoe 26.6；2027 年 4 月起上傳 App Store Connect 須用 27 SDK
- 十組進度與逐步流程記在 claude.ai 上的「HealthProbe 十組佈署」頁（私人 artifact，問 Jake 要連結）

### 後端契約

`data.mjs` 接受壓縮上傳：標頭 `X-Body-Encoding: deflate-raw`（App 以 `NSData.compressed(using: .zlib)` 壓縮），
也收 `deflate`／`gzip`；不帶標頭照舊收純 JSON。**Netlify 函式單次請求上限 6 MB**，
長場次未壓縮會回 HTTP 413（2026-10-05 一趟 6 小時 36 公里的騎乘即因此定稿上傳失敗）。

`data.mjs` 已接受 `activity` 與 `altitude` 兩個新欄位，且**向下相容**
（舊版 App 未送 → 空陣列，計數為 0）。`drive-sync.mjs` 會多封存
`活動類型.json` 與 `高度.json`。

`live.mjs` 接受 `wo`（布林；不送或非布林一律存 `null`，**不可當成 false**，舊版 App 根本不送）。
監看頁據此標 ⌚運動中／⚠ 手錶運動未確認／⚠ 運動中但心率停更，沒有 `wo` 的裝置不標。

---

## 八、待辦

| 優先 | 項目 | 說明 |
|---|---|---|
| 高 | TestFlight 上架與十組佈署 | 直裝要逐台接線、開發者模式、手動登記手錶（血淚教訓十一），十組成本高；簽署一年到期。上架前要確認：Watch target 的 Skip Install 設 YES（否則 Archive 變成 generic archive）、隱私清單申報 UserDefaults、`ITSAppUsesNonExemptEncryption = NO`、兩個 target 的 1024 圖示。注意授權條款把內部測試定位在「測試、評估、開發」；測試者一人一個 Apple 帳號 |
| 高 | 心動農場 006 換機 | iPhone 7（iOS 15）配 Series 7（watchOS 8.8.1）。在 iPhone 7 的「Watch」App 解除配對 → 新手機「設定為新的 Apple Watch」→ 升到 watchOS 26.x。不可逆，配好前別抹除 iPhone 7；今年內完成（watchOS 8.8.1 的裝置啟用憑證 2027-01 到期，拖過之後抹除重配可能卡在啟用） |
| 中 | 即時心率第二階段：串流直接入庫 | 手錶推來的樣本目前只供監看。若同時寫進生理流，結束後就不必「等 Apple Watch 同步再上傳一次補齊心率」（手冊第五節那套流程可退役） |
| 中 | 行事曆分級取用 | 規格已定案（三級：忙碌度／時間結構／含標題），需 EventKit 與 Info.plist 權限字串。預設第一級給受測者 |
| 低 | 資料站改用實測活動類型 | 等有一筆帶 `activity` 欄位的資料回來再做 |
| 低 | 主控台改用 App 送來的 `speedMps` | `motionStats()` 目前以 haversine 從座標相減推算速度，與 iOS 端「一律取 CoreLocation 原生值」的原則不一致；`altitudeM`／`courseDeg` 也尚未讀用 |
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
