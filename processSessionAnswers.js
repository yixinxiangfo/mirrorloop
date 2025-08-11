// processSessionAnswers.js（緊急修復版）

const parseGptOutput = require('./parseGptOutput');
const enrichMindFactorsWithRoot = require('./enrichMindFactorsWithRoot');
const { pushText } = require('./lineUtils');

async function processSessionAnswers(answers, userId, notionClient, openaiClient, lineClient) {
  const summaryText = answers.join('\n');
  
  console.log('🔄 Processing session answers for user:', userId.substring(0, 8) + '...');
  console.log('📝 Answers summary:', summaryText.substring(0, 200) + '...');

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
    console.log('🤖 Calling OpenAI for observation analysis...');
    
    // OpenAIで観照分析を実行
    const res = await openaiClient.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5
    });

    const gptOutput = res.choices[0].message.content;
    console.log('🎯 GPT観照応答受信:', gptOutput.substring(0, 200) + '...');

    // GPT出力を解析
    const parsed = parseGptOutput(gptOutput);
    console.log('📊 解析結果:', {
      hasComment: !!parsed.comment,
      mindFactorsCount: parsed.mindFactors.length,
      categoriesCount: parsed.category.length
    });

    // 🔧 重要：まずユーザーに観照コメントを送信（Notion処理より優先）
    if (parsed.comment) {
      console.log('📤 Sending observation comment to user...');
      
      await pushText(lineClient, userId, 
        `【観照の結果】\n\n${parsed.comment}\n\n今回の心の動きから、このような気づきが得られました。`
      );
      
      console.log('✅ Observation comment sent successfully');
    } else {
      console.warn('⚠️ No comment generated, sending fallback message');
      
      await pushText(lineClient, userId, 
        `【観照の結果】\n\n今回のセッションを通じて、あなたの心の動きを見つめることができました。\n\n継続的な観照により、より深い洞察が得られるでしょう。`
      );
    }

    // 🔧 Notion保存は別途試行（失敗してもユーザー体験に影響しない）
    try {
      console.log('💾 Attempting to save to Notion...');
      
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
          rich_text: [{ text: { content: parsed.comment || '観照コメント生成エラー' } }]
        }
      };

      await notionClient.pages.create({
        parent: { database_id: process.env.NOTION_DATABASE_ID },
        properties: notionProperties,
      });
      
      console.log("✅ Notion保存成功");
      
      // Notion保存成功時は追加情報も送信
      await pushText(lineClient, userId, 
        `観照記録をデータベースに保存しました。\n\n継続的な自己観照により、心の傾向をより深く理解できるようになります。`
      );
      
    } catch (notionError) {
      console.error("❌ Notion保存エラー:", notionError.message);
      console.error("詳細:", notionError.body ? JSON.parse(notionError.body) : notionError);
      
      // Notion失敗は内部ログのみ（ユーザーには通知しない）
      // ユーザーには既に観照コメントが送信済みなので問題なし
    }

  } catch (openaiError) {
    console.error("❌ OpenAI観照分析エラー:", openaiError.message);
    
    // OpenAI失敗時はフォールバック観照コメントを送信
    try {
      await pushText(lineClient, userId, 
        `【観照の結果】\n\n技術的な問題により詳細な分析ができませんでしたが、あなたが9つの問いに向き合い、自分の心を見つめたこと自体に大きな意味があります。\n\n内省の時間を持ったあなたを称賛します。`
      );
      
      console.log('✅ Fallback message sent');
    } catch (fallbackError) {
      console.error("❌ フォールバックメッセージ送信失敗:", fallbackError.message);
    }
  }
}

module.exports = processSessionAnswers;