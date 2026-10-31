# 分析程式驗證腳本

`console.html` 的分析區塊（控制後 r、去相關時間、區塊相關、殘差化）改動後，依 CLAUDE.md 第五節必須以合成資料實跑。
這兩支把那件事變成一行指令，在 repo 根目錄執行：

```bash
node tools/verify-analysis/point-level.mjs --base origin/main
```

```bash
node tools/verify-analysis/browser-report.mjs --base origin/main
```

`point-level.mjs` 把函式從 `console.html` 抽出來在 Node 裡跑，五組已知答案的情境：與心率無關的濕度（假陽性率）、
隨速度變但無獨立效果的濕度（干擾）、真的影響心率的氣溫（檢出率與估計值）、中段缺環境快照（缺值對齊），
以及各變項的控制組是否與手算一致。約 1 分鐘。

`browser-report.mjs` 用 Playwright 開真正的頁面，餵一場合成走測，中、英各跑一次，檢查頁面沒有錯誤、
讀人報告的數字與畫面是同一份計算、已知答案成立。需要 Playwright 與 Chromium，雲端環境已預裝。

`--base <git ref>` 可省略；給了就把那個版本的數字並列出來對照，只列不判。先 `git fetch origin main`，
本機的 `main` 分支常是舊的。任何一項未通過時結束碼為 1。

新增分析函式時，把它加進 `lib.mjs` 的 `NAMES`，並在 `point-level.mjs` 補一組已知答案的情境。
合成資料的產生方式寫在 `lib.mjs` 的 `walk()`。
