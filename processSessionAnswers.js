// processSessionAnswers.js（軽量版 - 観照コメントのみ、Supabase保存修正）

const { pushText } = require('./lineUtils');

async function processSessionAnswers(answers, userId, notionClient, openaiClient, lineClient) {
  const summaryText = answers.join('\n');
  
  console.log('📄 Processing session answers for user:', userId.substring(0, 8) + '...');
  console.log('📝 Total answers:', answers.length);
  
  // 文字数制限チェック
  const safeSummary = summaryText.length > 3000 ? 
    summaryText.substring(0, 2800) + '...（以下省略）' : 
    summaryText;

  let observationComment = null;

  try {
    console.log('🤖 Calling OpenAI for observation comment...');
    
    // 観照コメント生成プロンプト
    const commentPrompt = `以下の観照セッション回答から、簡潔で深い観照コメントを作成してください。

観照セッション回答：
${safeSummary}

条件：
- 説明ではなく、気づきを促す言葉にする
- 一文か二文で終える（短く、鋭く）
- 相手に問いを返す、または鏡のように返す
- 内側への気づきを促す（煩悩、執着、恐れなど）

以下のJSON形式で出力してください：
{
  "comment": "内面への気づきを促す観照コメント（100文字以内）"
}`;

    const commentRes = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ 
        role: 'user', 
        content: commentPrompt 
      }],
      temperature: 0.7,
      max_tokens: 500,
    });

    const commentOutput = commentRes.choices[0].message.content;
    console.log('🎯 Comment GPT output:', commentOutput);

    // 観照コメントを解析
    try {
      const jsonMatch = commentOutput.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        const jsonData = JSON.parse(jsonMatch[0]);
        observationComment = jsonData.comment || null;
      } else {
        observationComment = commentOutput.trim();
      }
    } catch (parseError) {
      console.warn('⚠️ Comment JSON parse failed, using raw output:', parseError.message);
      observationComment = commentOutput.trim();
    }

    console.log('📝 Generated comment:', observationComment);

    // ユーザーに観照コメント送信
    if (observationComment && observationComment.length > 10) {
      console.log('📤 Sending observation comment...');
      
      await pushText(lineClient, userId, 
        `【観照の結果】\n\n${observationComment}\n\n今回の内省を通じて、新たな気づきを得ることができました。`
      );
      
      console.log('✅ Observation comment sent successfully');
    } else {
      console.warn('⚠️ Generated comment too short or empty, sending fallback');
      
      await pushText(lineClient, userId, 
        `【観照の結果】\n\n9つの問いを通じて、あなた自身の心の動きを深く見つめることができました。\n\n継続的な観照により、より深い自己理解が得られるでしょう。`
      );
    }

  } catch (openaiError) {
    console.error("❌ OpenAI error details:", openaiError.message);
    
    const errorMessage = 'AI分析中に技術的な問題が発生しました。';
    
    try {
      await pushText(lineClient, userId, 
        `【観照の結果】\n\n${errorMessage}\n\nしかし、9つの問いに真摯に向き合い、自分の心を見つめたことに大きな価値があります。この内省の時間そのものが、あなたの成長につながっています。`
      );
      
      console.log('✅ Error fallback message sent');
    } catch (fallbackError) {
      console.error("❌ Fallback message failed:", fallbackError.message);
    }
  }

  // Supabase保存（基本情報のみ、エラーハンドリング強化）
  try {
    console.log('💾 Attempting Supabase save...');
    
    const supabase = require('./supabaseClient');
    
    const saveData = {
      line_user_id: userId,
      message_content: `観照セッション ${new Date().toLocaleDateString('ja-JP')}`,
      observation_comment: observationComment || 'コメント生成エラー',
      session_answers: answers, // 9つの回答を配列で保存
      created_at: new Date().toISOString()
    };
    
    console.log('💾 Saving data:', {
      userId: userId.substring(0, 8) + '...',
      answersCount: answers.length,
      commentLength: (observationComment || '').length
    });
    
    const { data, error } = await supabase
      .from('mind_observations')
      .insert(saveData);

    if (error) {
      console.error("❌ Supabase save failed:", error.message);
      console.error("❌ Error details:", error);
    } else {
      console.log("✅ Supabase save successful");
      console.log("📊 Saved observation comment successfully");
      console.log("📊 Saved answers count:", answers.length);
    }
    
  } catch (supabaseError) {
    console.error("❌ Supabase save failed:", supabaseError.message);
    console.error("❌ Supabase error details:", supabaseError);
  }
}

module.exports = processSessionAnswers;