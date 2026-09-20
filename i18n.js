/* i18n.js — 讀人平台的中英切換（全站共用）
 * 用法：頁面元素加 data-i18n="key"（換文字）或 data-i18n-ph="key"（換 placeholder）、
 *      data-i18n-title="key"（換 title 屬性）；載入本檔後自動套用。
 * 語言選擇存 localStorage（heals_lang），全站共通；預設中文。
 * 動態產生的內容請在插入後呼叫 I18N.apply()，或用 I18N.t("key") 取字串。
 */
(function (global) {
  "use strict";

  var DICT = {
    /* ── 站名與共用 ── */
    "site.name":        ["讀人 · 即時心理生理研究平台", "Reading People · Real-Time Psychophysiology Platform"],
    "site.sub":         ["HEALS Design · 場域生心理量測", "HEALS Design · In-Situ Psychophysiological Measurement"],
    "nav.live":         ["即時監看", "Live Monitor"],
    "nav.guide":        ["操作手冊", "Manual"],
    "nav.back":         ["← 專案列表", "← Projects"],
    "nav.backProject":  ["← 返回專案", "← Back to Project"],
    "lang.toggle":      ["EN", "中"],

    /* ── 站別導覽 ── */
    "st.settings":      ["1 設定", "1 Settings"],
    "st.zones":         ["2 範圍", "2 Zones"],
    "st.survey":        ["3 問卷", "3 Survey"],
    "st.data":          ["4 資料", "4 Data"],
    "st.settings.short":["設定", "Settings"],
    "st.zones.short":   ["範圍", "Zones"],
    "st.survey.short":  ["問卷", "Survey"],
    "st.data.short":    ["資料", "Data"],

    /* ── 首頁 ── */
    "home.h1":          ["專案列表", "Projects"],
    "home.lede":        ["一切以專案為中心：範圍、問卷、執行與資料，都以專案代號歸檔。點入專案後依作業順序逐站設定。",
                         "Everything is organized by project: zones, surveys, sessions and data are filed under the project code. Open a project to work through each station in order."],
    "home.createTitle": ["建立專案", "Create Project"],
    "home.fId":         ["專案代號", "Project code"],
    "home.fIdHint":     ["英數短碼（可含 - 與 _），是所有資料歸檔與跨檔合併的欄位鍵，建立後不可更改。",
                         "Alphanumeric short code (may include - and _). It is the key for filing and merging all data, and cannot be changed later."],
    "home.fName":       ["專案名稱", "Project name"],
    "home.fNote":       ["備註", "Note"],
    "home.createBtn":   ["建立專案", "Create project"],
    "home.active":      ["進行中", "Active"],
    "home.archived":    ["封存", "Archived"],
    "home.empty":       ["尚無專案。建立第一個專案後，範圍、問卷與量測資料都會以專案代號歸檔。",
                         "No projects yet. Once you create one, zones, surveys and measurements will be filed under its code."],
    "home.archivedWrap":["已封存的專案", "Archived projects"],
    "home.testing":     ["人測試中", "in session"],
    "home.phId":        ["例：aa、park2026", "e.g. aa, park2026"],
    "home.phName":      ["例：大安森林公園走測（2026 春）", "e.g. Daan Forest Park walk (Spring 2026)"],
    "home.phNote":      ["選填：案場、期程、負責人", "Optional: site, period, person in charge"],

    /* ── 樞紐頁 ── */
    "hub.settingsTitle":["專案設定", "Project Settings"],
    "hub.settingsDesc": ["名稱與狀態。專案代號是所有資料歸檔與跨檔合併的欄位鍵，建立後不可更改。",
                         "Name and status. The project code is the key for filing and merging all data and cannot be changed."],
    "hub.status":       ["狀態", "Status"],
    "hub.statusActive": ["進行中（手機端可選）", "Active (selectable on phone)"],
    "hub.statusArch":   ["封存（手機端不顯示）", "Archived (hidden on phone)"],
    "hub.save":         ["儲存設定", "Save settings"],
    "hub.removeTitle":  ["自清單移除", "Remove from list"],
    "hub.removeDesc":   ["只移除登記，讓專案不再出現在清單與手機端；已儲存的範圍、問卷與量測資料都保留在後端，重新以相同代號建立即可復原。",
                         "Removes only the registry entry, so the project no longer appears in the list or on phones. Zones, surveys and measurements stay on the server and can be restored by creating the same code again."],
    "hub.zonesTitle":   ["反應區範圍", "Response Zones"],
    "hub.zonesDesc":    ["在地圖上畫定不規則多邊形反應區。受測者走入區內時，手機自動擷取當下生理與環境資料並跳出現場問卷；走出區外則作廢未完成的問卷。畫區時匯入讀地站的基地資料作為底圖參考，建置中。",
                         "Draw irregular polygon zones on the map. When a participant enters a zone, the phone captures physiology and environment at that moment and prompts the in-situ survey; leaving the zone voids an unfinished survey. Importing site data as a basemap is in development."],
    "hub.zonesOpen":    ["開啟範圍設定", "Open zone editor"],
    "hub.surveyTitle":  ["問卷設計", "Survey Design"],
    "hub.surveyDesc":   ["上傳現成問卷（PDF 或 Word），AI 解析為題目清單並產生多語系譯文草稿；選定量尺範圍、補上開放填答即可完成。入組問卷以範本一鍵套用。問卷觸發方式（範圍、定時或兩者）也在此站設定。",
                         "Upload an existing questionnaire (PDF or Word); AI extracts the items and drafts translations. Set the scale range, add open-ended items, and you are done. Intake surveys can be applied from a template. Trigger mode (zone, timed or both) is also set here."],
    "hub.surveyOpen":   ["開啟問卷設計", "Open survey designer"],
    "hub.dataTitle":    ["資料與交接", "Data & Handover"],
    "hub.dataDesc":     ["檢視各場次軌跡與心率路線圖、匯出 Excel。場次上傳後自動轉存 Google Drive；讀人資料包可自此匯出，交接給收斂（分區與動線規劃）站。",
                         "Review session tracks and heart-rate route maps, export Excel. Sessions are archived to Google Drive automatically; the data package can be exported here for the zoning & circulation station."],
    "hub.dataOpen":     ["開啟資料主控台", "Open data console"],
    "hub.transition":   ["過渡期：現行 App 仍以舊控制面板遠端啟動；手機端「開始走測」上線後，該面板退役。",
                         "Transitional: the legacy panel can still start sessions remotely; it will retire once the in-app Start Session button is fully deployed."],

    /* ── 範圍頁 ── */
    "zones.title":      ["反應區設定", "Response Zones"],
    "zones.sub":        ["在地圖上畫出不規則反應區。受測者在手機選定本專案後自動取用；走進區域時跳出現場問卷，走出未完成則作廢。受測者端不需任何設定。",
                         "Draw irregular response zones on the map. Phones load them automatically once the project is selected; entering a zone prompts the in-situ survey, leaving voids an unfinished one. No setup needed on the participant side."],
    "zones.save":       ["儲存反應區", "Save zones"],
    "zones.add":        ["＋ 新增區域", "+ Add zone"],
    "zones.undo":       ["復原一點", "Undo point"],
    "zones.done":       ["完成多邊形", "Finish polygon"],
    "zones.cancel":     ["取消", "Cancel"],
    "zones.listTitle":  ["已設定的反應區", "Configured zones"],

    /* ── 問卷頁 ── */
    "survey.title":     ["問卷設計", "Survey Design"],
    "survey.sub":       ["為每個專案設計兩份問卷。入組：受測者第一次用 App 填一次（基本資料、email），以範本一鍵套用。現場（EMA）：走進反應區當下每次填，可上傳現成問卷由 AI 解析為題目並產生多語系譯文草稿。手機依系統語言顯示，答案落在同一欄位可跨國合併。",
                         "Two surveys per project. Intake: filled once on first use (background, email), available from a template. In-situ (EMA): filled each time a zone is entered; upload an existing questionnaire and AI will extract items and draft translations. Phones display the participant's system language while answers stay in shared fields for cross-country merging."],
    "survey.save":      ["儲存問卷", "Save survey"],
    "survey.langs":     ["支援語言", "Languages"],
    "survey.defLang":   ["預設語言", "Default language"],
    "survey.trigger":   ["問卷觸發方式", "Trigger mode"],
    "survey.trigZone":  ["範圍（走進反應區）", "Zone entry"],
    "survey.trigTimed": ["定時", "Timed"],
    "survey.trigBoth":  ["兩者", "Both"],
    "survey.intakeH":   ["入組問卷（填一次）", "Intake Survey (once)"],
    "survey.emaH":      ["現場問卷 · EMA（每次填）", "In-Situ Survey · EMA (each time)"],
    "survey.tmplIntake":["套用入組範本", "Apply intake template"],
    "survey.tmplEma":   ["套用 EMA 五題範本", "Apply 5-item EMA template"],
    "survey.addScale":  ["＋量尺", "+ Scale"],
    "survey.addSingle": ["＋單選", "+ Single"],
    "survey.addMulti":  ["＋複選", "+ Multi"],
    "survey.addText":   ["＋開放填答", "+ Open text"],
    "survey.addEmail":  ["＋Email", "+ Email"],
    "survey.uploadH":   ["由檔案建立（PDF／Word .docx／純文字）", "Create from file (PDF / Word .docx / plain text)"],
    "survey.pickFile":  ["選擇問卷檔", "Choose file"],
    "survey.parse":     ["以 AI 解析為題目", "Extract items with AI"],
    "survey.scaleH":    ["量尺設定（範圍套用到全部量尺題）", "Scale settings (applied to all scale items)"],
    "survey.scMin":     ["最小值", "Minimum"],
    "survey.scMax":     ["最大值", "Maximum"],
    "survey.scLow":     ["預設左端標籤（新題未填時套用）", "Default low anchor (for new items)"],
    "survey.scHigh":    ["預設右端標籤（新題未填時套用）", "Default high anchor (for new items)"],
    "survey.titleEach": ["標題（各語言）", "Title (per language)"],
    "survey.addOpen":   ["＋開放填答", "+ Open text"],

    /* ── 資料頁 ── */
    "console.title":    ["專案資料主控台", "Data Console"],
    "console.sub":      ["一個專案、多位參與者（各一編號＝一組配對的 Apple Watch＋iPhone）。開頁自動抓回本專案所有已上傳場次，依時間對接出帶 GPS 的資料，全員疊在地圖上，可產出專案 Excel（每人一分頁）或存到 Google Drive。",
                         "One project, multiple participants (each code = one paired Apple Watch + iPhone). All uploaded sessions load automatically, are time-matched with GPS, and overlaid on the map. Export a project Excel (one sheet per participant) or save to Google Drive."],
    "console.export":   ["產出專案 Excel", "Export project Excel"],
    "console.drive":    ["存到 Google Drive", "Save to Google Drive"],
    "console.parts":    ["參與者（編號 × 場次）", "Participants (code × session)"],
    "console.adv":      ["進階：本機離線模式（不經後端）", "Advanced: local offline mode"],
    "console.fetching": ["抓取中…", "Loading…"],
    "console.fetchFail":["抓取失敗：", "Load failed: "],
    "console.noData":   ["的資料（尚未有裝置上傳）。", " has no data yet (no device has uploaded)."],
    "console.emptyAll": ["的場次都是空的。", " exists but all sessions are empty."],
    "console.loaded1":  ["已載入", "Loaded"],
    "console.loaded2":  ["組（編號×場次）、共", "groups (code × session) across"],
    "console.loaded3":  ["個場次。可直接看地圖／產出 Excel；需要離線拖檔請展開下方「進階」。",
                         "sessions. View the map or export Excel; for offline drag-and-drop, expand Advanced below."],
    "console.chipPhys": ["生理", "Physio"],
    "console.chipTrack":["軌跡", "Track"],
    "console.chipEnv":  ["環境", "Env"],
    "console.dropH":    ["拖入此參與者的 JSON", "Drop this participant's JSON here"],
    "console.dropS":    ["生理 ／ 軌跡 ／ 環境（可多檔，自動辨識）",
                         "Physiology / track / environment (multiple files, auto-detected)"],
    "console.showOnMap":["在地圖顯示", "Show on map"],
    "ctx.title":        ["脈絡分析：天氣變化 × 生理", "Context: weather change × physiology"],
    "ctx.reanalyze":    ["重新分析", "Re-analyse"],
    "ctx.loading":      ["查詢天氣中…", "Fetching weather…"],
    "ctx.analysed1":    ["已分析", "Analysed"],
    "ctx.analysed2":    ["個場次", "sessions"],
    "ctx.noWeather":    ["個查無天氣，多為缺座標或時間過舊", "with no weather data (missing coordinates or too old)"],
    "ctx.colSession":   ["場次", "Session"],
    "ctx.colTime":      ["時間", "Time"],
    "ctx.colDur":       ["時長", "Duration"],
    "ctx.colTemp":      ["氣溫", "Temp"],
    "ctx.colDTemp":     ["24h 溫差", "24h Δtemp"],
    "ctx.colPres":      ["氣壓", "Pressure"],
    "ctx.colDPres":     ["24h 壓差", "24h Δpressure"],
    "ctx.colRH":        ["濕度", "Humidity"],
    "ctx.colTrend":     ["氣壓趨勢（前 72h）", "Pressure trend (prior 72h)"],
    "ctx.colHR":        ["平均心率", "Mean HR"],
    "ctx.alongN":       ["沿途", "along route,"],
    "ctx.alongPts":     ["點", "pts"],
    "ctx.mslLabel":     ["海平面值", "sea-level"],
    "ctx.min":          ["分", "min"],
    "ctx.hour":         ["小時", "h"],
    "ctx.day":          ["天", "d"],
    "ctx.notEnded":     ["未正常結束", "not ended properly"],
    "md.notEnded":      ["此場次長達 12 小時以上，幾乎可以確定是走測未按「結束走測」、App 持續記錄所致。其中混雜了睡眠、通勤、工作等完全不同的狀態，去相關時間、天氣對接與區塊切分皆失去意義，不應用於分析。建議在事件維護中刪除，並於 SOP 強調結束走測的步驟。",
                         "This session runs for more than 12 hours, which almost certainly means the session was never ended and the app kept recording. It mixes sleep, commuting and work into one record; decorrelation time, weather matching and block segmentation all become meaningless, so it should not be analysed. Delete it under event maintenance and reinforce the end-session step in the SOP."],
    "inv.title":        ["可能影響心率的變項盤整", "Inventory of variables that may affect heart rate"],
    "inv.colVar":       ["變項", "Variable"],
    "inv.colCat":       ["類別", "Category"],
    "inv.colAvail":     ["可得場次", "Sessions"],
    "inv.colRange":     ["範圍", "Range"],
    "pt.title":         ["點層級分析：逐筆心率 × 當下環境", "Point-level: each HR sample × conditions at that moment"],
    "pt.meta":          ["心率點數", "HR points"],
    "pt.rho":           ["一階自相關 ρ", "lag-1 autocorrelation ρ"],
    "pt.neff":          ["有效樣本數", "effective sample size"],
    "pt.span":          ["時長", "duration"],
    "pt.gap":           ["取樣間隔中位數", "median sampling interval"],
    "pt.tau":           ["心率去相關時間 τ", "HR decorrelation time τ"],
    "pt.blockCI":       ["區塊 r（95% CI）", "Block r (95% CI)"],
    "pt.banner2":       ["以下數值<b>不可解讀</b>：跨日紀錄混雜睡眠、通勤與工作，氣溫與心率的相關幾乎必然來自晝夜節律（白天氣溫高、人清醒心率也高），而非環境效果。請先刪除此場次，改以正常結束的短場次分析。",
                         "The values below <b>cannot be interpreted</b>: a multi-day recording mixes sleep, commuting and work, so any correlation between temperature and heart rate almost certainly reflects the circadian cycle (warmer and more active by day) rather than an environmental effect. Delete this session and analyse properly ended short sessions instead."],
    "methods.title":    ["分析方法與取樣說明", "Methods and sampling notes"],
    "md.title":         ["分析模型診斷：哪些變項值得分析", "Model diagnostics: which variables are worth analysing"],
    "md.colVar":        ["變異", "Variation"],
    "md.colSpd":        ["與速度共線", "Collinear w/ speed"],
    "md.colTime":       ["與經過時間共線", "Collinear w/ elapsed"],
    "md.colBlocks":     ["可用區塊", "Blocks"],
    "md.colVerdict":    ["判定與建議", "Verdict"],
    "md.none":          ["無", "none"],
    "md.levels":        ["階", "levels"],
    "md.vNone":         ["資料不足", "insufficient data"],
    "md.vNoVar":        ["變異不足，無法分析", "too little variation to analyse"],
    "md.vTime":         ["與經過時間共線，無法與疲勞／節律分離", "collinear with elapsed time; cannot be separated from fatigue or circadian drift"],
    "md.vSpeed":        ["與速度高度共線，偏相關不穩定", "highly collinear with speed; partial correlation unstable"],
    "md.vEffect":       ["區塊不足，僅報告效果量", "too few blocks; report effect size only"],
    "md.vBlock":        ["可用：控制速度與晝夜後的區塊相關", "usable: block correlation, speed + time-of-day controlled"],
    "md.vBlockWeak":    ["區塊偏少（4–7），信賴區間過寬，僅供參考", "few blocks (4–7); interval too wide, indicative only"],
    "md.caution":       ["與速度或經過時間中度共線，結果需保留", "moderately collinear with speed or elapsed time — interpret with caution"],
    "md.aWeak":         ["區塊數偏少、信賴區間過寬，僅供參考的變項：", "Too few blocks and intervals too wide — indicative only: "],
    "md.overall":       ["本場次的模型建議", "Recommended model for this session"],
    "md.a1":            ["可用區塊法分析的變項：", "Variables analysable by the block method: "],
    "md.a2":            ["建議以「控制速度後的區塊相關」為主要結果，信賴區間不涵蓋 0 才視為值得追究的訊號；未控制的相關僅供對照。",
                         "Use the speed-controlled block correlation as the primary result; treat a signal as worth pursuing only when its confidence interval excludes zero. The uncontrolled correlation is for reference only."],
    "md.a3":            ["本場次沒有變項具備足夠的區塊數，僅能報告效果量（r），不做統計推論。時長過短或訊號持續性過高皆會導致此結果。",
                         "No variable in this session has enough blocks, so only effect sizes (r) can be reported and no inference drawn. This arises when the session is short or the signal is highly persistent."],
    "md.a4":            ["本場次的環境變項變異不足或與活動、時間高度共線，不建議在此場次內檢驗環境效果。",
                         "Environmental variables in this session either vary too little or are highly collinear with activity and time; testing environmental effects within this session is not advisable."],
    "md.a5":            ["以下變項在本場次不可分析：", "Not analysable in this session: "],
    "md.a6":            ["場次時長超過 4 小時，晝夜節律與疲勞會隨時間累積，與環境變項難以分離；若可能，改以較短且時段固定的重複量測。",
                         "The session exceeds four hours, over which circadian drift and fatigue accumulate and become hard to separate from environmental variables; where possible, use shorter repeated measurements at a fixed time of day."],
    "md.a7":            ["跨場次的環境效果不應以平均值相關檢驗。較可信的做法是<b>配對設計</b>：同一條路線、相近時段、不同天氣條件各走數次，以配對差值檢定。如此活動強度與節律自然被控制，剩下的差異才可歸因於環境。",
                         "Environmental effects across sessions should not be tested by correlating session means. A more trustworthy approach is a <b>paired design</b>: walk the same route at a comparable time of day several times under different weather, then test paired differences. Activity intensity and circadian phase are thereby held constant, so the remaining difference can be attributed to the environment."],
    "methods.body":     ["<h4>一、資料來源與取樣頻率</h4><p><b>心率</b>來自 Apple Watch，經 HealthKit 遞送至 iPhone。運動進行中約每 5 秒一筆，未開啟運動時取樣稀疏且不規則。手錶與手機的同步由系統排程，非即時，延遲數十秒至數分鐘屬正常。<br><b>軌跡</b>由 iPhone 記錄，每移動約 8 公尺一點，GPS 精度隨環境變動，樹蔭與高樓旁誤差可達數十公尺。<br><b>現場環境</b>為走測期間擷取的快照（氣溫、體感、濕度、AQI、PM2.5、PM10、風速、天氣），取樣頻率遠低於心率。<br><b>回溯天氣</b>由 open-meteo 依場次時間與座標查得逐時資料，非現場量測，與現場快照互為對照。跨距 3 公里以上的場次沿途取 3 至 5 點。</p><h4>二、時間對接規則</h4><p>每筆生理樣本以最近鄰方式對接到軌跡點，時間差超過<b>時間容差</b>（預設 90 秒，可於上方調整）即捨棄；軌跡點的 GPS 精度超過<b>精度上限</b>（預設 50 公尺）亦捨棄。環境快照僅在與生理樣本時間差 15 分鐘內才採用。這些門檻直接決定納入分析的樣本，調整後所有統計會即時重算。</p><h4>三、分析層級</h4><p><b>場次層級</b>（上方脈絡表）以一場走測為單位，用於描述當時的天氣條件，n 等於場次數。收案初期場次少，<b>不足以做任何統計推論</b>。<br><b>點層級</b>（下方分析表）以單筆心率為單位，在<b>單一場次之內</b>進行。跨場次把點混在一起會把場次之間的差異（活動型態、時段、地點）偷渡回來，可能產生辛普森悖論，因此場次在此是分層而非分析單位。</p><h4>四、干擾控制</h4><p>活動強度是心率最主要的決定因子。速度由軌跡以前後各兩點的位移除以時距計算，並以偏相關移除其影響——<b>「控制速度後 r」才是環境效果的候選</b>，未控制的相關多半在反映活動。時刻（晝夜節律）與場次內已經過時間亦一併納入表中檢視。</p><h4>五、自相關的分級處理</h4><p>連續的心率讀數高度不獨立，且取樣間隔不均勻，因此不以相鄰兩筆定義自相關，而是以實際時間戳估計<b>去相關時間 τ</b>：訊號要隔多久才算獨立。<br><b>第一級</b>僅報告 r，作為效果量，永遠成立。<br><b>第二級</b>以 n<sub>eff</sub> = 總時長 ÷ 2τ 折算後計算 p 值。此法不假設取樣均勻，較 AR(1) 折算合理；但它有時給出比 AR(1) 更小的數值，因為間隔不均時相鄰相關會低估真正的持續性——本法的價值在於更正確，而非更寬鬆。<br><b>第三級</b>將場次切成長於 2τ 的區塊，在各區塊內以全部樣本估計 r，再以區塊間變異求 95% 信賴區間。資訊利用最充分，且不需假設誤差結構，<b>三者之中以區塊結果最值得採信</b>。區塊數少於 4 時不予呈現。</p><h4>六、限制</h4><p>環境快照頻率遠低於心率，同一段時間內多筆心率可能共用一筆快照，其相關值應視為粗略指標。<br>本平台產生的是觀察性資料，非實驗操弄，相關不等於因果。<br>單一受測者、單一場次的結果不可外推；跨人比較需注意個體基礎心率差異甚大。</p><h4>七、研究設計上的建議</h4><p>增加獨立資訊量最有效的途徑是<b>設計而非統計</b>。同一條路線重複多次走測，其獨立資訊遠多於單次長時間量測：十次 30 分鐘的走測優於一次 5 小時的騎行。若要檢驗天氣效果，理想做法是<b>同路線、同時段、不同天氣條件</b>的配對比較，如此活動強度與晝夜節律自然被控制，剩下的差異才可歸因於環境。</p>",
                         "<h4>1. Data sources and sampling rates</h4><p><b>Heart rate</b> comes from the Apple Watch via HealthKit. During an active workout it is sampled roughly every 5 s; outside a workout, sampling is sparse and irregular. Watch-to-phone synchronisation is scheduled by the system and is not real time — lags of tens of seconds to several minutes are normal.<br><b>Track</b> is recorded by the iPhone, one point per ~8 m of movement. GPS accuracy varies with surroundings and can drift by tens of metres under tree cover or among tall buildings.<br><b>On-site environment</b> consists of snapshots captured during the session (air temperature, apparent temperature, humidity, AQI, PM2.5, PM10, wind speed, weather), sampled far less often than heart rate.<br><b>Retrospective weather</b> is retrieved from open-meteo by session time and coordinates as hourly series; it is not on-site measurement and complements the snapshots. Sessions spanning 3 km or more are sampled at 3–5 points along the route.</p><h4>2. Time-matching rules</h4><p>Each physiological sample is matched to its nearest track point; matches exceeding the <b>time tolerance</b> (default 90 s, adjustable above) are discarded, as are track points whose GPS accuracy exceeds the <b>accuracy limit</b> (default 50 m). Environmental snapshots are used only when within 15 minutes of the sample. These thresholds determine which samples enter the analysis, and all statistics recompute immediately when they change.</p><h4>3. Levels of analysis</h4><p><b>Session level</b> (context table above) treats one walk as the unit and describes the conditions at that time; n equals the number of sessions. Early in data collection this is <b>insufficient for any statistical inference</b>.<br><b>Point level</b> (analysis table below) treats each heart-rate sample as the unit and runs <b>within a single session</b>. Pooling points across sessions reintroduces between-session differences (activity type, time of day, location) and risks Simpson's paradox, so session here is a stratum, not the unit of analysis.</p><h4>4. Confound control</h4><p>Activity intensity is the principal determinant of heart rate. Speed is derived from the track as displacement over two points either side divided by elapsed time, and its influence is removed by partial correlation — <b>the r-with-speed-controlled column is where environmental effects could appear</b>; the uncontrolled correlation largely reflects activity. Time of day (circadian rhythm) and elapsed time within the session are also shown for inspection.</p><h4>5. Tiered handling of autocorrelation</h4><p>Consecutive heart-rate readings are highly dependent and sampling is irregular, so autocorrelation is not defined by adjacent samples. Instead the <b>decorrelation time τ</b> is estimated from actual timestamps: how far apart readings must be to count as independent.<br><b>Tier 1</b> reports r alone as an effect size; always valid.<br><b>Tier 2</b> computes p from n<sub>eff</sub> = duration ÷ 2τ. This assumes nothing about even spacing and is more defensible than an AR(1) correction; note that it sometimes yields a smaller value than AR(1), because with uneven gaps the adjacent-sample correlation underestimates true persistence. Its merit is accuracy, not leniency.<br><b>Tier 3</b> divides the session into blocks longer than 2τ, estimates r within each block using all its samples, and derives a 95% confidence interval from between-block variation. It uses the most information and assumes least about the error structure; <b>of the three, the block result is the most trustworthy</b>. It is omitted when fewer than four blocks are available.</p><h4>6. Limitations</h4><p>Environmental snapshots are sampled far less often than heart rate, so several heart-rate points may share one snapshot; those correlations are rough indicators.<br>This platform produces observational data, not experimental manipulation — correlation is not causation.<br>Results from a single participant or session cannot be generalised; comparisons across people must account for large individual differences in baseline heart rate.</p><h4>7. Recommendations for study design</h4><p>The most effective way to gain independent information is <b>design, not statistics</b>. Repeating the same route many times yields far more independent information than one long measurement: ten 30-minute walks beat a single five-hour ride. To test weather effects, the ideal approach is a paired comparison of the <b>same route at the same time of day under different weather</b>, which naturally holds activity intensity and circadian phase constant so that remaining differences can be attributed to the environment.</p>"],
    "pt.partial":       ["控制速度與晝夜後 r", "r | speed + time-of-day controlled"],
    "pt.noSession":     ["無可分析的場次。", "No session available."],
    "pt.modeAll":       ["全部模式", "All modes"],
    "pt.pts":           ["點", "pts"],
    "pt.modeWeight":    ["長條與第一個百分比為<b>時間</b>佔比；括號內為點數佔比。兩者差距大時代表取樣密度不均——運動中約 5 秒一筆、靜止時稀疏，點數會高估運動時段的份量，匯總的相關也會被那段主導。",
                         "The bar and the first percentage are shares of <b>time</b>; the figure in brackets is the share of points. A large gap between them indicates uneven sampling density — about every 5 s during a workout, sparse at rest — so point counts overstate active periods, and pooled correlations are dominated by them."],
    "pt.modeTooFew":    ["所選模式的點數不足（需 30 點以上）。", "Too few points in the selected mode (30 required)."],
    "pt.modeNote":      ["移動模式為<b>推定值</b>，依速度、心率抬升與 GPS 精度判別：速度可分出靜止、步行與高速，10–25 km/h 的重疊區靠心率是否明顯抬升來分辨騎行與車輛；GPS 精度劣化且幾乎不動者推定為室內。待 App 端記錄 CoreMotion 活動類型與室內外訊號後，改用實測值。",
                         "Movement mode is <b>inferred</b>, not measured, from speed, heart-rate elevation and GPS accuracy: speed separates stationary, walking and fast travel, while the 10–25 km/h overlap is resolved by whether heart rate is clearly elevated (cycling) or near resting (vehicle); degraded GPS accuracy with little movement is taken as indoors. This will be replaced by measured values once the app records CoreMotion activity type and indoor/outdoor signals."],
    "pt.tooFew":        ["此場次對接到的心率點數不足（需 30 點以上），無法做點層級分析。",
                         "Too few HR points matched in this session (30 required) for point-level analysis."],
    "pt.note":          ["分析在<b>單一場次之內</b>進行：跨場次把點混在一起等於把場次差異偷渡回來，可能產生辛普森悖論。<br><b>控制速度後 r</b> 是偏相關——移除活動強度後該變項與心率還剩多少關聯。這一欄才是環境效果的候選。<br><b>自相關採分級處理。</b>取樣間隔不均勻（運動中約 5 秒一筆，靜止時稀疏），因此不以相鄰兩筆定義自相關，而是用實際時間戳估計去相關時間 τ：訊號要隔多久才算獨立。<b>第一級</b>只看 r，是效果量，永遠成立。<b>第二級</b>以 n<sub>eff</sub> = 總時長 ÷ 2τ 折算後計算 p 值，比假設均勻取樣的 AR(1) 折算合理得多。<b>第三級</b>把場次切成長於 2τ 的區塊，各自求 r，再以區塊間變異給 95% 信賴區間——用到的資訊最多，也不必假設誤差結構，<b>三者之中以區塊結果最值得採信</b>。<br>環境變項來自走測當下的實測快照，取樣頻率遠低於心率，同一段時間內多筆心率可能共用一筆快照，其相關應視為粗略指標。",
                         "Analysis runs <b>within a single session</b>: pooling points across sessions smuggles between-session differences back in and risks Simpson's paradox.<br><b>r | speed controlled</b> is a partial correlation — what remains once activity intensity is removed. This is where environmental effects could appear.<br><b>Autocorrelation is handled in tiers.</b> Sampling is irregular (about every 5 s during a workout, sparser at rest), so autocorrelation is not defined by adjacent samples; instead the decorrelation time τ is estimated from actual timestamps — how far apart readings must be to count as independent. <b>Tier 1</b> reports r alone as an effect size, always valid. <b>Tier 2</b> computes p from n<sub>eff</sub> = duration ÷ 2τ, far more defensible than an AR(1) correction that assumes even spacing. <b>Tier 3</b> splits the session into blocks longer than 2τ, computes r within each, and derives a 95% confidence interval from between-block variation — this uses the most information, assumes least about the error structure, and <b>is the most trustworthy of the three</b>.<br>Environmental variables come from on-site snapshots sampled far less often than heart rate; several HR points may share one snapshot, so those correlations are rough indicators."],
    "ctx.note":         ["氣壓與氣溫的<b>變化</b>（與 24 小時前相比）在文獻中與情緒、自律神經活性的關聯，通常比當下的絕對值更穩定。表中「氣壓趨勢」為場次前 72 小時的逐時走勢。天氣資料由 open-meteo 依場次的時間與座標回溯查得，非現場量測，與 App 現場擷取的環境快照互為對照。跨距達 3 公里以上的場次會沿途取 3 至 5 點，氣溫與濕度顯示沿途範圍；<b>跨地點比較一律採海平面氣壓</b>，因為地面氣壓隨海拔劇烈變化（每上升 100 公尺約降 12 hPa），直接比較會把爬升誤讀為天氣變化。「24h 壓差」則為起點的地面氣壓變化，對應身體實際承受的壓力。",
                         "<b>Changes</b> in pressure and temperature (versus 24 hours earlier) tend to relate more consistently to mood and autonomic activity than absolute values do. The trend column shows hourly pressure over the 72 hours before each session. Weather is retrieved from open-meteo by session time and coordinates — it is not on-site measurement, and complements the environmental snapshots captured by the app. Sessions spanning 3 km or more are sampled at 3–5 points along the route, with temperature and humidity shown as ranges; <b>cross-location comparison always uses sea-level pressure</b>, because surface pressure falls about 12 hPa per 100 m of elevation, which would otherwise be misread as a weather change. The 24h Δpressure column uses surface pressure at the starting point, matching what the body actually experiences."],

    /* ── 監看頁 ── */
    "live.title":       ["即時監看", "Live Monitor"],
    "live.sub":         ["走測中的裝置每半分鐘回報一次位置與最近心率；超過三分鐘沒回報就視為離線。心率來自 Apple Watch 經 HealthKit 遞送，可能落後實際數十秒到數分鐘。",
                         "Devices in session report position and latest heart rate every 30 seconds; no report for three minutes counts as offline. Heart rate arrives via HealthKit from the Apple Watch and may lag by seconds to minutes."],
    "live.scope":       ["範圍", "Scope"],
    "live.all":         ["全部專案", "All projects"],
    "live.waiting":     ["等待你的裝置回報…", "Waiting for your device…"],
    "live.noneHere":    ["目前沒有裝置在回報", "No devices reporting"],
    "live.noneAll":     ["目前沒有進行中的量測。", "No sessions in progress."],
    "live.noneMine":    ["還沒收到你的裝置回報。開始走測後約半分鐘內會出現。",
                         "No report from your device yet. It should appear within about 30 seconds of starting a session."],
    "live.updated":     ["更新於", "Updated"],
    "live.secAgo":      ["秒前", "s ago"],
    "live.minAgo":      ["分前", "min ago"],
    "live.pos":         ["位置", "position"]
  };

  var lang = "zh";
  try {
    var saved = global.localStorage && localStorage.getItem("heals_lang");
    if (saved === "en" || saved === "zh") lang = saved;
  } catch (e) { /* 隱私模式忽略 */ }

  function t(key) {
    var e = DICT[key];
    if (!e) return key;
    return lang === "en" ? (e[1] || e[0]) : e[0];
  }

  function apply(root) {
    var scope = root || document;
    scope.querySelectorAll("[data-i18n]").forEach(function (el) {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    scope.querySelectorAll("[data-i18n-ph]").forEach(function (el) {
      el.placeholder = t(el.getAttribute("data-i18n-ph"));
    });
    scope.querySelectorAll("[data-i18n-title]").forEach(function (el) {
      el.title = t(el.getAttribute("data-i18n-title"));
    });
    document.documentElement.setAttribute("lang", lang === "en" ? "en" : "zh-Hant");
    var btn = document.getElementById("langBtn");
    if (btn) btn.textContent = t("lang.toggle");
  }

  function set(next) {
    lang = (next === "en") ? "en" : "zh";
    try { if (global.localStorage) global.localStorage.setItem("heals_lang", lang); } catch (e) {}
    apply();
    if (typeof global.onLangChange === "function") global.onLangChange(lang);
  }

  function toggle() { set(lang === "zh" ? "en" : "zh"); }

  /* 自動插入切換鈕：頁面若有 #langSlot 就放進去，否則浮在右上 */
  function mountButton() {
    if (document.getElementById("langBtn")) return;
    var b = document.createElement("button");
    b.id = "langBtn";
    b.type = "button";
    b.textContent = t("lang.toggle");
    b.addEventListener("click", toggle);
    var slot = document.getElementById("langSlot");
    if (slot) {
      b.className = "langbtn";
      slot.appendChild(b);
    } else {
      b.className = "langbtn langbtn-float";
      document.body.appendChild(b);
    }
    if (!document.getElementById("langBtnStyle")) {
      var s = document.createElement("style");
      s.id = "langBtnStyle";
      s.textContent =
        ".langbtn{font:inherit;font-size:13px;font-weight:600;letter-spacing:.04em;" +
        "background:#fffdf7;color:#3f5a2f;border:1px solid #e7ddc6;border-radius:999px;" +
        "padding:4px 14px;cursor:pointer;}" +
        ".langbtn:hover{border-color:#3f5a2f;}" +
        ".langbtn-float{position:fixed;top:14px;right:16px;z-index:9999;" +
        "box-shadow:0 1px 4px rgba(0,0,0,.08);}";
      document.head.appendChild(s);
    }
  }

  global.I18N = {
    t: t,
    apply: apply,
    set: set,
    toggle: toggle,
    get lang() { return lang; }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { mountButton(); apply(); });
  } else {
    mountButton();
    apply();
  }
})(window);
