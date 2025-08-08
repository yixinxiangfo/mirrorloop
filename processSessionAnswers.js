// processSessionAnswers.js

const parseGptOutput = require('./parseGptOutput');
const enrichMindFactorsWithRoot = require('./enrichMindFactorsWithRoot');

async function processSessionAnswers(answers, userId, notionClient, openaiClient) {
  const summaryText = answers.join('\n');

  const prompt = `
以下は、ある人物の観照セッションでの9つの回答です。
この回答をもとに、以下を出力してください：

1. 観照コメント（内面への気づきを促す短い一言）
2. 心所ラベル（五十一心所の中から該当するもの）
3. 心所分類（善・煩悩・随煩悩など）
4. 三毒（貪・瞋・痴）

観照セッション：
${summaryText}

出力形式：
{
  "comment": "...",
  "mindFactors": [
    { "name": "無慚", "root": ["痴"] },
    ...
  ],
  "category": ["随煩悩", "煩悩"]
}
`;

  try {
    const res = await openaiClient.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5
    });

    const gptOutput = res.choices[0].message.content;
    console.log('GPTからの観照応答:', gptOutput);

    const parsed = parseGptOutput(gptOutput);
    const enrichedFactors = enrichMindFactorsWithRoot(parsed.mindFactors);

    const notionProperties = {
      "名前": {
        title: [{ text: { content: summaryText.slice(0, 60) } }]
      },
      "タイムスタンプ": {
        date: { start: new Date().toISOString() }
      },
      "心所ラベル": {
        multi_select: enrichedFactors.map(f => ({ name: f.name }))
      },
      "三毒": {
        multi_select: Array.from(new Set(enrichedFactors.flatMap(f => f.root))).map(r => ({ name: r }))
      },
      "心所分類": {
        multi_select: parsed.category.map(c => ({ name: c }))
      },
      "観照コメント": {
        rich_text: [{ text: { content: parsed.comment } }]
      }
    };

    await notionClient.pages.create({
      parent: { database_id: process.env.NOTION_DATABASE_ID },
      properties: notionProperties,
    });
    console.log("✅ Notionページが正常に作成されました。");

  } catch (error) {
    console.error("❌ Notionページ作成エラー:", error.body ? JSON.parse(error.body) : error);
  }
}

module.exports = processSessionAnswers;