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
