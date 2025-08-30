// processSessionAnswers.js（匿名化対応版）

const enrichMindFactorsWithRoot = require('./enrichMindFactorsWithRoot');
const { anonymizeUserId } = require('./userIdUtils'); // 追加：匿名化機能

function identifyThreePoisons(mindFactors) {
  if (!Array.isArray(mindFactors) || mindFactors.length === 0) return ['痴'];
  
  const mindFactorObjects = mindFactors.map(factor => ({ name: factor }));
  const enrichedFactors = enrichMindFactorsWithRoot(mindFactorObjects);
  const detectedRoots = new Set();
  
  enrichedFactors.forEach(factor => {
    if (factor.root && Array.isArray(factor.root)) {
      factor.root.forEach(root => detectedRoots.add(root));
    }
  });
  
  return Array.from(detectedRoots).length > 0 ? Array.from(detectedRoots) : ['痴'];
}

async function processSessionAnswers(answers, openaiClient, notionClient, userId, observationResult) {
  console.log('📄 Processing session answers for user:', userId.substring(0, 8) + '...');
  console.log('📝 Total answers:', answers.length);
  console.log('🎯 Typebot observation result:', observationResult);

  // TypebotのOpenAI結果をパースして観照コメントと心所データを抽出
  let observationComment = 'Typebotでの観照が完了しました。心の動きを見つめることができました。';
  let mindFactors = [];
  let mindCategories = [];

  if (observationResult) {
    console.log('🔍 受信した観照結果（生データ）:', observationResult);
    try {
      // 文字列から```jsonを除去してJSONのみ抽出
      let cleanedResult = observationResult;
      if (cleanedResult.includes('```json')) {
        cleanedResult = cleanedResult.replace(/```json/g, '').replace(/```/g, '');
      }
      
      const parsedResult = JSON.parse(cleanedResult);
      console.log('🔍 パース済みJSON:', parsedResult);
      
      // コメント抽出
      observationComment = parsedResult['コメント'] || 
                          parsedResult['comment'] || 
                          parsedResult.コメント || 
                          parsedResult.comment || 
                          observationResult;
      
      // 心所データ抽出
      mindFactors = parsedResult['心所'] || parsedResult.mindFactors || [];
      mindCategories = parsedResult['心所分類'] || parsedResult.mindCategories || [];
                          
      console.log('🎯 抽出された観照コメント:', observationComment);
      console.log('🧠 抽出された心所:', mindFactors);
      console.log('📋 抽出された心所分類:', mindCategories);
    } catch (parseError) {
      console.log('⚠️ JSON parse failed:', parseError.message);
      console.log('⚠️ Raw observation result:', observationResult);
      observationComment = observationResult;
    }
  }

  // 心所データを含む完全なメッセージを構築
  let fullMessage = observationComment;
  
  if (mindFactors.length > 0) {
    fullMessage += `\n\n検出された心の状態：${mindFactors.join('、')}`;
  }
  
  if (mindCategories.length > 0) {
    fullMessage += `\n分類：${mindCategories.join('、')}`;
  }

  console.log('📊 錯覚倍率計算をスキップ（将来実装予定）');

  // Supabase保存（非同期）
  setImmediate(async () => {
    try {
      console.log('💾 Attempting Supabase save...');
      const supabase = require('./supabaseClient');
      
      if (!supabase) {
        console.warn('⚠️ Supabase client not available - skipping database save');
        return;
      }

      const threePoisons = identifyThreePoisons(mindFactors);
      console.log('🔍 Identified three poisons:', threePoisons);

      // 修正：LINE User IDを匿名化
      const anonymizedUserId = anonymizeUserId(userId);
      console.log('🔒 Anonymized user ID:', anonymizedUserId);

      const saveData = {
        line_user_id: anonymizedUserId, // 修正：匿名化されたIDを保存
        session_id: `session_${Date.now()}`,
        message_content: `観照セッション ${new Date().toLocaleDateString('ja-JP')}\n\n${answers.map((ans, i) => `Q${i+1}: ${ans}`).join('\n')}`,
        observation_comment: observationComment,
        mind_factors: Array.isArray(mindFactors) ? mindFactors : [],
        mind_categories: Array.isArray(mindCategories) ? mindCategories : [],
        three_poisons: threePoisons
      };

      console.log('💾 Saving data:', {
        user_id: saveData.line_user_id,
        factors_count: saveData.mind_factors.length,
        categories_count: saveData.mind_categories.length,
        poisons_count: saveData.three_poisons.length
      });

      const { data, error } = await supabase
        .from('mind_observations')
        .insert(saveData)
        .select();

      if (error) {
        console.error("❌ Supabase save failed:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
      } else {
        console.log("✅ Supabase save successful, ID:", data?.[0]?.id);
      }
    } catch (supabaseError) {
      console.error("❌ Supabase save error:", supabaseError.message);
      console.error("Stack:", supabaseError.stack);
    }
  });

  // 心所データを含む完全なメッセージを返す
  return {
    comment: fullMessage
  };
}

module.exports = processSessionAnswers;