// processSessionAnswers.js（プロンプト内容変更なし版）

const parseGptOutput = require('./parseGptOutput');
const enrichMindFactorsWithRoot = require('./enrichMindFactorsWithRoot');
const { pushText } = require('./lineUtils');
const { promptTemplate } = require('./rootDictionary');

async function processSessionAnswers(answers, userId, notionClient, openaiClient, lineClient) {
  const summaryText = answers.join('\n');
  
  console.log('🔄 Processing session answers for user:', userId.substring(0, 8) + '...');
  console.log('📝 Total answers:', answers.length);
  console.log('📏 Summary length:', summaryText.length, 'characters');
  
  // 🔧 文字数制限チェック（OpenAI安全対策）
  const safeSummary = summaryText.length > 3000 ? 
    summaryText.substring(0, 2800) + '...（以下省略）' : 
    summaryText;

  let observationComment = null;
  let mindFactors = [];
  let mindCategories = [];
  let threePoisons = [];

  try {
    console.log('🤖 Calling OpenAI for observation comment...');
    
    // 🔧 元の観照コメント生成プロンプト
    const commentPrompt = `以下の観照セッション回答から、簡潔な観照コメントを作成してください。

観照セッション回答：
${safeSummary}

以下のJSON形式で出力してください：
{
  "comment": "内面への気づきを促す短いコメント（100文字以内）"
}`;

    const commentRes = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ 
        role: 'user', 
        content: commentPrompt 
      }],
      temperature: 0.3,
      max_tokens: 500,
    });

    const commentOutput = commentRes.choices[0].message.content;
    console.log('🎯 Comment GPT output:', commentOutput);

    // 🔧 観照コメントを解析
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

    // 🔧 心所分析（元のpromptTemplateをそのまま使用）
    console.log('🤖 Calling OpenAI for mind factor analysis...');
    
    const mindAnalysisPrompt = promptTemplate(safeSummary);

    const mindAnalysisRes = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ 
        role: 'user', 
        content: mindAnalysisPrompt 
      }],
      temperature: 0.7,
      max_tokens: 800,
    });

    const mindAnalysisOutput = mindAnalysisRes.choices[0].message.content;
    console.log('🎯 Mind analysis GPT output:', mindAnalysisOutput);

    // 🔧 心所分析結果を解析
    const mindAnalysisResult = parseGptOutput(mindAnalysisOutput);
    
    // 心所分析結果を取得
    mindFactors = mindAnalysisResult.mindFactors || [];
    mindCategories = mindAnalysisResult.category || [];
    
    // 三毒を抽出
    const poisonsSet = new Set();
    mindFactors.forEach(factor => {
      if (factor.root && Array.isArray(factor.root)) {
        factor.root.forEach(poison => {
          if (['貪', '瞋', '痴'].includes(poison)) {
            poisonsSet.add(poison);
          }
        });
      }
    });
    threePoisons = Array.from(poisonsSet);

    console.log('📊 Mind analysis results:', {
      mindFactors: mindFactors.map(f => f.name),
      mindCategories,
      threePoisons
    });

    // 🔧 ユーザーには観照コメントのみ送信
    if (observationComment && observationComment.length > 10) {
      console.log('📤 Sending observation comment only...');
      
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

  // 🔧 Supabase保存（心所分析結果を含む - 週次レポート用）
  try {
    console.log('💾 Attempting Supabase save...');
    
    const supabase = require('./supabaseClient');
    
    // 心所名のみを配列で保存
    const mindFactorNames = mindFactors.map(factor => factor.name);
    
    const { data, error } = await supabase
      .from('mind_observations')
      .insert({
        line_user_id: userId,
        message_content: `観照セッション ${new Date().toLocaleDateString('ja-JP')}`,
        observation_comment: observationComment || 'コメント生成エラー',
        mind_factors: mindFactorNames,
        mind_categories: mindCategories,
        three_poisons: threePoisons
      });

    if (error) {
      console.error("❌ Supabase save failed:", error.message);
    } else {
      console.log("✅ Supabase save successful:", data);
      console.log("📊 Saved mind factors:", mindFactorNames);
      console.log("📊 Saved three poisons:", threePoisons);
    }
    
  } catch (supabaseError) {
    console.error("❌ Supabase save failed:", supabaseError.message);
    // Supabase失敗は無視（ユーザーには影響しない）
  }
}

module.exports = processSessionAnswers;