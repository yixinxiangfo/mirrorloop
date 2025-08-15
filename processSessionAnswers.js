// processSessionAnswers.js（個別心所分析版）

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
  let individualAnalysis = [];
  let allMindFactors = [];
  let allMindCategories = [];
  let allThreePoisons = [];

  try {
    console.log('🤖 Calling OpenAI for observation comment...');
    
    // 🔧 元の観照コメント生成プロンプト（全体を使用）
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

    // 🔧 特定の回答のみ心所分析（1, 2, 4, 5, 6, 7）
    const targetAnswerIndices = [1, 2, 4, 5, 6, 7]; // 分析対象の回答番号
    console.log('🔍 === 個別心所分析開始（対象: 回答1,2,4,5,6,7のみ）===');
    
    for (let i = 0; i < answers.length; i++) {
      const answer = answers[i];
      const questionIndex = i + 1;
      
      // 分析対象の回答かチェック
      if (!targetAnswerIndices.includes(questionIndex)) {
        console.log(`⏭️ 回答${questionIndex}: "${answer}" → 分析対象外（スキップ）`);
        
        // 分析対象外として記録
        individualAnalysis.push({
          questionIndex,
          answer: answer,
          mindFactors: [],
          categories: [],
          analysisComment: '分析対象外（内省的回答）',
          skipped: true
        });
        continue;
      }
      
      console.log(`🔍 分析中: 回答${questionIndex}: "${answer}"`);
      
      try {
        // 個別の心所分析
        const mindAnalysisPrompt = promptTemplate(answer);
        
        console.log(`🤖 GPT呼び出し ${questionIndex} (${targetAnswerIndices.indexOf(questionIndex) + 1}/${targetAnswerIndices.length})...`);
        
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
        console.log(`🎯 回答${questionIndex} GPT出力:`, mindAnalysisOutput);

        // 心所分析結果を解析
        const mindAnalysisResult = parseGptOutput(mindAnalysisOutput);
        
        // 個別分析結果を保存
        const analysis = {
          questionIndex,
          answer: answer,
          mindFactors: mindAnalysisResult.mindFactors || [],
          categories: mindAnalysisResult.category || [],
          analysisComment: mindAnalysisResult.comment || ''
        };
        
        individualAnalysis.push(analysis);
        
        // 全体の心所・分類を集計
        analysis.mindFactors.forEach(factor => {
          if (!allMindFactors.find(f => f.name === factor.name)) {
            allMindFactors.push(factor);
          }
        });
        
        analysis.categories.forEach(category => {
          if (!allMindCategories.includes(category)) {
            allMindCategories.push(category);
          }
        });
        
        console.log(`✅ 回答${questionIndex}分析完了:`, {
          mindFactors: analysis.mindFactors.map(f => f.name),
          categories: analysis.categories
        });
        
        // API制限を考慮して少し待機
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (analysisError) {
        console.error(`❌ 回答${questionIndex}の分析エラー:`, analysisError.message);
        
        // エラーの場合はデフォルト値を設定
        individualAnalysis.push({
          questionIndex,
          answer: answer,
          mindFactors: [],
          categories: [],
          analysisComment: '分析エラー',
          error: analysisError.message
        });
      }
    }
    
    // 三毒を抽出
    const poisonsSet = new Set();
    allMindFactors.forEach(factor => {
      if (factor.root && Array.isArray(factor.root)) {
        factor.root.forEach(poison => {
          if (['貪', '瞋', '痴'].includes(poison)) {
            poisonsSet.add(poison);
          }
        });
      }
    });
    allThreePoisons = Array.from(poisonsSet);

    console.log('🔍 === 個別心所分析完了（分析対象6回答のみ）===');
    console.log('📊 Final analysis results:', {
      totalAnswers: individualAnalysis.length,
      analyzedAnswers: individualAnalysis.filter(a => !a.skipped).length,
      skippedAnswers: individualAnalysis.filter(a => a.skipped).length,
      allMindFactors: allMindFactors.map(f => f.name),
      allMindCategories,
      allThreePoisons
    });
    
    // 🔧 個別分析結果の詳細ログ
    console.log('📋 === 個別分析結果詳細 ===');
    individualAnalysis.forEach(analysis => {
      console.log(`Q${analysis.questionIndex}: "${analysis.answer}"`);
      if (analysis.skipped) {
        console.log(`  → スキップ（分析対象外）`);
      } else {
        console.log(`  → 心所: [${analysis.mindFactors.map(f => f.name).join(', ')}]`);
        console.log(`  → 分類: [${analysis.categories.join(', ')}]`);
        if (analysis.error) {
          console.log(`  → エラー: ${analysis.error}`);
        }
      }
    });
    console.log('================================');

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

  // 🔧 Supabase保存（個別分析結果も含む）
  try {
    console.log('💾 Attempting Supabase save...');
    
    const supabase = require('./supabaseClient');
    
    // 全体の心所名のみを配列で保存
    const allMindFactorNames = allMindFactors.map(factor => factor.name);
    
    const { data, error } = await supabase
      .from('mind_observations')
      .insert({
        line_user_id: userId,
        message_content: `観照セッション ${new Date().toLocaleDateString('ja-JP')}`,
        observation_comment: observationComment || 'コメント生成エラー',
        mind_factors: allMindFactorNames,
        mind_categories: allMindCategories,
        three_poisons: allThreePoisons,
        individual_analysis: individualAnalysis  // 個別分析結果も保存
      });

    if (error) {
      console.error("❌ Supabase save failed:", error.message);
    } else {
      console.log("✅ Supabase save successful:", data);
      console.log("📊 Saved mind factors:", allMindFactorNames);
      console.log("📊 Saved three poisons:", allThreePoisons);
      console.log("📊 Saved individual analyses:", individualAnalysis.length);
    }
    
  } catch (supabaseError) {
    console.error("❌ Supabase save failed:", supabaseError.message);
    // Supabase失敗は無視（ユーザーには影響しない）
  }
}

module.exports = processSessionAnswers;