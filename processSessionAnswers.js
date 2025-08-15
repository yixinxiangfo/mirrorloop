// processSessionAnswers.js（Supabaseクライアント修正版）

const parseGptOutput = require('./parseGptOutput');
const enrichMindFactorsWithRoot = require('./enrichMindFactorsWithRoot');
const { pushText } = require('./lineUtils');

async function processSessionAnswers(answers, userId, notionClient, openaiClient, lineClient) {
  const summaryText = answers.join('\n');
  
  console.log('🔄 Processing session answers for user:', userId.substring(0, 8) + '...');
  console.log('📝 Total answers:', answers.length);
  console.log('📏 Summary length:', summaryText.length, 'characters');
  
  // 🔧 文字数制限チェック（OpenAI安全対策）
  if (summaryText.length > 3000) {
    console.warn('⚠️ Summary too long, truncating...');
    const truncatedSummary = summaryText.substring(0, 2800) + '...（以下省略）';
    console.log('📏 Truncated to:', truncatedSummary.length, 'characters');
  }

  // 🔧 短縮・安全なプロンプト
  const safeSummary = summaryText.length > 3000 ? 
    summaryText.substring(0, 2800) + '...（以下省略）' : 
    summaryText;

  const prompt = `以下の観照セッション回答から、簡潔な観照コメントを作成してください。

観照セッション回答：
${safeSummary}

以下のJSON形式で出力してください：
{
  "comment": "内面への気づきを促す短いコメント（100文字以内）"
}`;

  let observationComment = null; // 🔧 変数を外側で定義

  try {
    console.log('🤖 Calling OpenAI...');
    console.log('📏 Prompt length:', prompt.length, 'characters');
    
    // 🔧 OpenAI呼び出しのタイムアウト対策
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒タイムアウト
    
    const res = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini', // 🔧 より軽量で安定したモデル
      messages: [{ 
        role: 'user', 
        content: prompt 
      }],
      temperature: 0.3, // 🔧 より安定した出力
      max_tokens: 500,   // 🔧 出力制限
    }, {
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    console.log('✅ OpenAI response received');

    const gptOutput = res.choices[0].message.content;
    console.log('🎯 GPT raw output:', gptOutput);

    // 🔧 安全なJSON解析
    try {
      // JSON部分を抽出
      const jsonMatch = gptOutput.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        const jsonData = JSON.parse(jsonMatch[0]);
        observationComment = jsonData.comment || null;
      } else {
        console.warn('⚠️ No JSON found in output, using raw text');
        observationComment = gptOutput.trim();
      }
    } catch (parseError) {
      console.warn('⚠️ JSON parse failed, using raw output:', parseError.message);
      observationComment = gptOutput.trim();
    }

    console.log('📝 Final comment:', observationComment);

    // 🔧 観照コメントの送信
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
    console.error("❌ OpenAI error details:", {
      message: openaiError.message,
      type: openaiError.type,
      code: openaiError.code,
      status: openaiError.status
    });
    
    // 🔧 エラータイプ別の対応
    let errorMessage;
    if (openaiError.message.includes('rate limit')) {
      errorMessage = 'AI分析サービスが混雑しています。少し時間をおいてから再度お試しください。';
    } else if (openaiError.message.includes('timeout')) {
      errorMessage = '分析に時間がかかりすぎました。ネットワーク状況をご確認ください。';
    } else {
      errorMessage = 'AI分析中に技術的な問題が発生しました。';
    }
    
    try {
      await pushText(lineClient, userId, 
        `【観照の結果】\n\n${errorMessage}\n\nしかし、9つの問いに真摯に向き合い、自分の心を見つめたことに大きな価値があります。この内省の時間そのものが、あなたの成長につながっています。`
      );
      
      console.log('✅ Error fallback message sent');
    } catch (fallbackError) {
      console.error("❌ Fallback message failed:", fallbackError.message);
    }
  }

  // 🔧 Supabase保存（OpenAIの処理とは独立）
  try {
    console.log('💾 Attempting Supabase save...');
    
    // 🔧 修正：正しいimport形式
    const supabase = require('./supabaseClient');
    
    const { data, error } = await supabase
      .from('mind_observations')
      .insert({
        line_user_id: userId,
        message_content: `観照セッション ${new Date().toLocaleDateString('ja-JP')}`,
        observation_comment: observationComment || 'コメント生成エラー',
        mind_factors: [], // 観照セッションでは心所分析なし
        mind_categories: [],
        three_poisons: []
      });

    if (error) {
      console.error("❌ Supabase save failed:", error.message);
    } else {
      console.log("✅ Supabase save successful:", data);
    }
    
  } catch (supabaseError) {
    console.error("❌ Supabase save failed:", supabaseError.message);
    // Supabase失敗は無視（ユーザーには影響しない）
  }
}

module.exports = processSessionAnswers;