// processSessionAnswers.js（バランス版 - 観照コメント復活 + タイムアウト対策）

const { pushText } = require('./lineUtils');

async function processSessionAnswers(answers, userId, notionClient, openaiClient, lineClient) {
  console.log('📄 Processing session answers for user:', userId.substring(0, 8) + '...');
  console.log('📝 Total answers:', answers.length);

  const summaryText = answers.join('\n');
  const safeSummary = summaryText.length > 2000 ? 
    summaryText.substring(0, 1800) + '...（以下省略）' : 
    summaryText;

  let observationComment = null;

  try {
    console.log('🤖 Calling OpenAI for observation comment...');
    
    // 唯識に基づいた観照コメント生成プロンプト（簡潔版）
    const commentPrompt = `以下の観照セッション回答を唯識の視点で分析し、簡潔な観照コメントを作成してください。

観照セッション回答：
${safeSummary}

条件：
- 唯識思想（執着、煩悩、心の動き）の視点から洞察
- 一文か二文で終える（短く、鋭く）
- 相手の内面への気づきを促す
- 説教ではなく、鏡のように返す

JSON形式で出力：
{"comment": "観照コメント（80文字以内）"}`;

    const commentRes = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ 
        role: 'user', 
        content: commentPrompt 
      }],
      temperature: 0.6,
      max_tokens: 300, // トークン数削減
    });

    const commentOutput = commentRes.choices[0].message.content;
    console.log('🎯 Comment GPT output:', commentOutput);

    // 観照コメントを解析（シンプル版）
    try {
      const jsonMatch = commentOutput.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        const jsonData = JSON.parse(jsonMatch[0]);
        observationComment = jsonData.comment || null;
      } else {
        observationComment = commentOutput.trim();
      }
    } catch (parseError) {
      console.warn('⚠️ JSON parse failed, using raw output');
      observationComment = commentOutput.trim();
    }

    console.log('📝 Generated comment:', observationComment);

    // ユーザーに観照コメント送信
    if (observationComment && observationComment.length > 5) {
      await pushText(lineClient, userId, 
        `【観照の結果】\n\n${observationComment}`
      );
      console.log('✅ Observation comment sent successfully');
    } else {
      // フォールバック：唯識的なメッセージ
      await pushText(lineClient, userId, 
        `【観照の結果】\n\n心の動きを見つめることで、執着や煩悩の正体が見えてきます。この気づきこそが、真の自己理解への第一歩です。`
      );
      console.log('✅ Fallback observation comment sent');
    }

  } catch (openaiError) {
    console.error("❌ OpenAI error:", openaiError.message);
    
    // エラー時も唯識的なフォールバック
    try {
      await pushText(lineClient, userId, 
        `【観照の結果】\n\n9つの問いを通じて、あなた自身の心の動きを深く見つめることができました。執着や煩悩に気づくことが、解放への道です。`
      );
      console.log('✅ Error fallback message sent');
    } catch (fallbackError) {
      console.error("❌ Fallback message failed:", fallbackError.message);
    }
  }

  // 非同期でSupabase保存（メイン処理をブロックしない）
  setImmediate(async () => {
    try {
      console.log('💾 Attempting Supabase save...');
      const supabase = require('./supabaseClient');
      
      const { data, error } = await supabase
        .from('mind_observations')
        .insert({
          line_user_id: userId,
          message_content: `観照セッション ${new Date().toLocaleDateString('ja-JP')}\n\n${answers.map((ans, i) => `Q${i+1}: ${ans}`).join('\n')}`,
          observation_comment: observationComment || '観照セッション完了',
          mind_factors: [],
          mind_categories: [],
          three_poisons: []
        });

      if (error) {
        console.error("❌ Supabase save failed:", error.message);
      } else {
        console.log("✅ Supabase save successful");
      }
    } catch (supabaseError) {
      console.error("❌ Supabase save error:", supabaseError.message);
    }
  });
}

module.exports = processSessionAnswers;