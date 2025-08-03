// index.js

const express = require('express');
const { Client } = require('@notionhq/client');
const dotenv = require('dotenv');
const { Configuration, OpenAIApi } = require("openai");

dotenv.config();

const app = express();
app.use(express.json());

const notion = new Client({ auth: process.env.NOTION_TOKEN });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function classifyMindFactors(text) {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4", // または gpt-3.5-turbo など、利用可能なモデル
      messages: [
        {
          role: "system",
          content: `あなたは仏教の唯識学派の専門家です。以下の規則に厳密に従い、ユーザーの発言に含まれる煩悩や心所（五十一心所）を判断し、指定された形式で出力してください。
          【制約条件】1.心所名には、以下に示す「五十一心所」からのみ選んでください。絶対にそれ以外の名称を使ってはいけません。2.五十一心所に存在しない心所（例えば「慈悲」「正念」「静寂」「悪作」など）は、出力に含めないでください。3.出力はJASONのみで返してください。説明文や補足文を含めてはいけません。4.JASONのキーは「心所」「心所分類」「コメント」としてください。
          【出力形式の例】JSON形式で以下の情報を出力してください：1) 抽出された心所名（ラベル、配列形式）、2) 心所分類（善・悪・不定など、配列形式）、3) コメント（なぜそう判断したか）。出力はJSONのみとし、他のテキストは含めないでください。

以下に五十一心所の一部とその解説を示します。判断の参考にしてください。

--- 心所解説 ---
【遍行心所（5種）】
・作意（attention）：心を対象に向ける働き。
・触（contact）：心と対象が触れ合う働き。
・受（feeling）：対象を受け止めて快・不快・不苦不楽を感じる働き。主観。
・想（perception）：対象の姿や特徴を捉える働き。妄想。
・思（volition）：行動へと心を動かす働き。

【別境心所（5種）】
・欲（desire）：何かをしたいと願う心。
・勝解（resolve）：対象を確定的に理解し、疑わない心。
・念（memory）：過去の経験を記憶し、忘れない心。怨念。
・定（concentration）：心を一点に集中させる心。
・慧（wisdom）：物事を正しく見極める心。間違って選択する場合もある。

【善心所（11種）】
・信（faith）：真理や善を信じる清らかな心。
・精進（diligence）：善行に励み、怠らない心。
・慚（shame）：自己の悪行を恥じ、悔いる心。
・愧（moral apprehension）：他者の前で悪をすることを恥じ、憚る心。
・無貪（non-attachment）：貪りを離れる心。
・無瞋（non-anger）：怒りを離れる心。気に入らないことへの怒りがない。
・無痴（non-ignorance）：無知を離れ、智慧ある心。
・軽安（ease）：心が軽やかで穏やかな状態。禅定に入らないと現れないので凡人には適用できない。
・不放逸（conscientiousness）：善行を忘れず、怠らない心。
・行捨（equanimity）：心を平等にし、平静を保つ心。それが実行できていること。
・不害（non-harm）：他者を害さない心。

【根本煩悩（6種）】
・貪（greed）：対象に執着し、飽くなき欲望を抱く心。
・瞋（anger）：対象に怒りや不満を抱く心。気に入らないものに対する怒り。
・痴（ignorance）：物事の真実を知らない無明の心。
・慢（arrogance）：自分を他者より優れていると見なす心。
・疑（doubt）：真理や善を疑う心。
・悪見（wrong views）：誤った見解を持つ心。

【随煩悩（20種）】
・忿（indignation）：瞬間的な激しい怒り。
・恨（rancor）：怒りを長く持ち続ける心。
・覆（concealment）：過ちを隠そうとする心。
・悩（vexation）：いらだちや苦悩。過去にしがみつく。
・嫉（envy）：他者の成功をねたむ心。
・慳（miserliness）：自分のものを出し惜しみする心。
・誑（deception）：人を欺く心。
・諂（flattery）：他人にこびへつらう心。
・害（harm）：他者を傷つけようとする心。
・憍（haughtiness）：得意になって高ぶる心。
・無慚（shamelessness）：恥を知らない心。
・無愧（lack of moral apprehension）：他人を気にせず悪を行う心。
・掉挙（restlessness）：心が落ち着かず、浮つく心。
・昏沈（sloth）：心が沈み、意欲がない心。
・不信（lack of faith）：信じない心。
・懈怠（indolence）：努力を怠る心。
・放逸（heedlessness）：心を放任し、気をつけない心。
・散乱（distraction）：心が散漫になる心。
・不正知（wrong understanding）：正しく理解しない心。
・失念（forgotten）：真理や徳を忘れること。

【不定心所（4種）】
・悔（regret）：過去の行いを悔やむ心。
・眠（sleep）：心が沈んで眠りに落ちる状態。
・尋（inquiry）：心で言葉や意味を探し求める心。
・伺（investigation）：対象を細かく考察する心。

回答例: {"心所":["信","不害"],"心所分類":["善心所"],"コメント":"ユーザーの清らかな心を表しています。"}
回答例: {"心所":["瞋","忿"],"心所分類":["根本煩悩","随煩悩"],"コメント":"特定の対象への怒りが読み取れます。"}
回答例: {"心所":["掉挙"],"心所分類":["随煩悩"],"コメント":"心が落ち着かない状態です。"}

必ずJSON形式で回答してください。他のテキストは一切含めないでください。`
        },
        {
          role: "user",
          content: `この文章の心所をラベリングしてください：「${text}」`
        }
      ],
      temperature: 0.3,
    });

    const result = completion.choices[0].message.content;
    console.log("GPT-4からのラベリング結果（Raw）:", result);
    return JSON.parse(result);
  } catch (error) {
    console.error("OpenAI APIエラー:", error.response ? error.response.data : error.message);
    return null;
  }
}
app.post('/', async (req, res) => {
  console.log('📬 Webhook received:', JSON.stringify(req.body, null, 2));

  const events = req.body.events;

  if (!events || events.length === 0) {
    console.log('💡 No events in webhook body. Sending 200.');
    return res.sendStatus(200);
  }

  for (const event of events) {
    console.log('➡️ Processing event:', JSON.stringify(event, null, 2));

    if (event.type === 'message' && event.message && event.message.type === 'text') {
      const text = event.message.text;
      console.log('  - Detected text message:', text);

      const receivedTimestamp = new Date(event.timestamp).toISOString();
      console.log('  - Message timestamp:', receivedTimestamp);

      let notionProperties = {
        "名前": {
          title: [
            {
              text: {
                content: text,
              },
            },
          ],
        },
        "タイムスタンプ": {
          date: {
            start: receivedTimestamp,
          },
        },
      };

      const labelResult = await classifyMindFactors(text);

      if (labelResult) {
        if (labelResult.心所 && Array.isArray(labelResult.心所)) {
          notionProperties["心所ラベル"] = {
            multi_select: labelResult.心所.map(tag => ({ name: tag })),
          };
        }
        if (labelResult.心所分類 && Array.isArray(labelResult.心所分類)) {
          notionProperties["心所分類"] = {
            multi_select: labelResult.心所分類.map(tag => ({ name: tag })),
          };
        }
        if (labelResult.コメント) {
          notionProperties["心所コメント"] = {
            rich_text: [
              {
                text: {
                  content: labelResult.コメント,
                },
              },
            ],
          };
        }
        console.log('  - AIラベリング結果をNotionプロパティに追加しました。');
      } else {
        console.warn('  - AIラベリングに失敗したため、Notionにラベリング結果は追加されません。');
      }

      try {
        await notion.pages.create({
          parent: { database_id: process.env.NOTION_DATABASE_ID },
          properties: notionProperties,
        });
        console.log('✅ Notion に書き込み完了:', text);
      } catch (error) {
        console.error('❌ Notion 書き込みエラー:', error);
      }
    } else {
      console.log('  - Message is not a text message or text property is missing for type:', event.message?.type);
    }
  }

  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
