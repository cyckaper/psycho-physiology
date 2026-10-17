// 現場問卷：STAI-6（Marteau & Bekker, 1992；1–4）＋ PRS-11（Pasini et al., 2014；0–10）
// STAI-6 是情境焦慮量表（STAI Form Y-1）的六題短版，問「此時此刻」的感受，放在最前面，
// 先量剛走進來的當下，免得作答 PRS 時對環境的評估反過來影響情緒。
// STAI 以單選題（1–4 各點皆有標籤）；放單選而非量尺，是因為問卷頁的量尺範圍會統一套用到全部量尺題，
// 若 STAI 也做成量尺，日後在網頁上按一次儲存就會被改成 0–10。正向題（平靜、放鬆、滿足）id 以 _r 結尾。
// PRS 以量尺題（0 完全不符合 – 10 完全符合），題意改為就地作答（places like this）。
import fs from "node:fs";

const L = (zh, en) => ({ zh, en });
const prs = (id, zh, en) => ({ id, type: "scale", required: true, min: 0, max: 10,
  text: L(zh, en), low: L("完全不符合", "Not at all"), high: L("完全符合", "Completely") });

const PRS = [
  prs("prs_fa1", "像這樣的地方很迷人", "Places like this are fascinating"),
  prs("prs_fa2", "在像這樣的地方，我的注意力會被許多有趣的事物吸引", "In places like this my attention is drawn to many interesting things"),
  prs("prs_fa3", "在像這樣的地方，很難感到無聊", "In places like this it is hard to be bored"),
  prs("prs_ba1", "像這樣的地方是遠離煩擾的避風港", "Places like this are a refuge from nuisances"),
  prs("prs_ba2", "為了遠離平常需要我費心注意的事物，我喜歡到像這樣的地方", "To get away from things that usually demand my attention I like to go to places like this"),
  prs("prs_ba3", "為了暫時不去想那些必須完成的事，我喜歡到像這樣的地方", "To stop thinking about the things that I must get done I like to go to places like this"),
  prs("prs_co1", "像這樣的地方，實質環境的配置有清楚的秩序", "There is a clear order in the physical arrangement of places like this"),
  prs("prs_co2", "在像這樣的地方，很容易看出事物是如何安排的", "In places like this it is easy to see how things are organised"),
  prs("prs_co3", "在像這樣的地方，每樣事物似乎都在它應有的位置", "In places like this everything seems to have its proper place"),
  prs("prs_sc1", "這個地方夠大，可以往許多方向探索", "This place is large enough to allow exploration in many directions"),
  prs("prs_sc2", "在像這樣的地方，很少有邊界限制我四處走動", "In places like this there are few boundaries to limit my possibility to move about"),
];

const STAI_CHOICES = [
  { value: "1", label: L("1 完全沒有", "1 Not at all") },
  { value: "2", label: L("2 有一些", "2 Somewhat") },
  { value: "3", label: L("3 中等程度", "3 Moderately") },
  { value: "4", label: L("4 非常明顯", "4 Very much") },
];
const stai = (id, zh, en) => ({ id, type: "single", required: true,
  text: L("此時此刻，" + zh, "Right now, at this moment, " + en),
  choices: STAI_CHOICES });

const STAI = [
  stai("stai_calm_r",    "我覺得平靜", "I feel calm"),
  stai("stai_tense",     "我覺得緊張", "I am tense"),
  stai("stai_upset",     "我覺得心煩", "I feel upset"),
  stai("stai_relaxed_r", "我覺得放鬆", "I am relaxed"),
  stai("stai_content_r", "我覺得滿足", "I feel content"),
  stai("stai_worried",   "我覺得憂慮", "I am worried"),
];

const survey = {
  languages: ["zh", "en"],
  defaultLang: "zh",
  intake: { title: {}, questions: [] },
  ema: {
    title: L("公園現場問卷：此刻的感受，以及這個地方給你的感受",
             "In-park survey: how you feel right now, and how this place feels to you"),
    questions: [...STAI, ...PRS],
  },
};
fs.writeFileSync(new URL("./survey.json", import.meta.url), JSON.stringify(survey, null, 1));
console.log("ema questions:", survey.ema.questions.length);
