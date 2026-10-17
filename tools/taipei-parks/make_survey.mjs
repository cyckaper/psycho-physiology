// 現場問卷：PRS-11（Pasini et al., 2014；0–10）＋ PSS-10（Cohen & Williamson, 1988；0–4）
// PRS 以量尺題（0 完全不符合 – 10 完全符合），題意改為就地作答（places like this）。
// PSS 以單選題（0–4 各點皆有標籤）；放單選而非量尺，是因為問卷頁的量尺範圍會統一套用到全部量尺題，
// 若 PSS 也做成量尺，日後在網頁上按一次儲存就會被改成 0–10。反向題 id 以 r 結尾（4、5、7、8）。
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

const PSS_CHOICES = [
  { value: "0", label: L("0 從不", "0 Never") },
  { value: "1", label: L("1 幾乎不", "1 Almost never") },
  { value: "2", label: L("2 有時", "2 Sometimes") },
  { value: "3", label: L("3 常常", "3 Fairly often") },
  { value: "4", label: L("4 非常常", "4 Very often") },
];
const pss = (id, zh, en) => ({ id, type: "single", required: true,
  text: L("最近一個月，你有多常" + zh, "In the last month, how often have you " + en),
  choices: PSS_CHOICES });

const PSS = [
  pss("pss01",  "因為發生意料之外的事而心煩意亂？", "been upset because of something that happened unexpectedly?"),
  pss("pss02",  "覺得無法掌控生活中重要的事情？", "felt that you were unable to control the important things in your life?"),
  pss("pss03",  "感到緊張和「有壓力」？", "felt nervous and \"stressed\"?"),
  pss("pss04r", "對自己處理個人問題的能力感到有信心？", "felt confident about your ability to handle your personal problems?"),
  pss("pss05r", "覺得事情的發展順著你的意思？", "felt that things were going your way?"),
  pss("pss06",  "發現自己無法應付所有必須做的事？", "found that you could not cope with all the things that you had to do?"),
  pss("pss07r", "能夠控制生活中令你惱怒的事？", "been able to control irritations in your life?"),
  pss("pss08r", "覺得自己能掌握一切？", "felt that you were on top of things?"),
  pss("pss09",  "因為無法掌控的事情而生氣？", "been angered because of things that were outside of your control?"),
  pss("pss10",  "覺得困難堆積如山，多到你無法克服？", "felt difficulties were piling up so high that you could not overcome them?"),
];

const survey = {
  languages: ["zh", "en"],
  defaultLang: "zh",
  intake: { title: {}, questions: [] },
  ema: {
    title: L("公園現場問卷：這個地方給你的感受，以及最近的壓力",
             "In-park survey: how this place feels to you, and your recent stress"),
    questions: [...PRS, ...PSS],
  },
};
fs.writeFileSync(new URL("./survey.json", import.meta.url), JSON.stringify(survey, null, 1));
console.log("ema questions:", survey.ema.questions.length);
