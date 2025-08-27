// processSessionAnswers.js（簡素化版 - TypebotのOpenAI結果を活用）

async function processSessionAnswers(answers, openaiClient, notionClient, userId, observationResult) {
  console.log('📄 Processing session answers for user:', userId.substring(0, 8) + '...');
  console.log('📝 Total answers:', answers.length);
  console.log('🎯 Typebot observation result:', observationResult);

  // TypebotのOpenAI結果をパースして観照コメントを抽出
  let observationComment = 'Typebotでの観照が完了しました。心の動きを見つめることができました。';

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
      
      // 複数のキー名でコメントを探す
      observationComment = parsedResult['コメント'] || 
                          parsedResult['comment'] || 
                          parsedResult.コメント || 
                          parsedResult.comment || 
                          observationResult;
                          
      console.log('🎯 抽出された観照コメント:', observationComment);
    } catch (parseError) {
      console.log('⚠️ JSON parse failed:', parseError.message);
      console.log('⚠️ Raw observation result:', observationResult);
      // パースに失敗した場合、観照結果全体を使用
      observationComment = observationResult;
    }
  }

  console.log('📊 錯覚倍率計算をスキップ（将来実装予定）');

  // Supabase保存（非同期）
  setImmediate(async () => {
    try {
      console.log('💾 Attempting Supabase save...');
      const supabase = require('./supabaseClient');
      
      const { data, error } = await supabase
        .from('mind_observations')
        .insert({
          line_user_id: userId,
          message_content: `観照セッション ${new Date().toLocaleDateString('ja-JP')}\n\n${answers.map((ans, i) => `Q${i+1}: ${ans}`).join('\n')}`,
          observation_comment: 'Typebotでの観照セッション完了',
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

  // TypebotのOpenAI結果をそのまま返す（錯覚倍率削除）
  return {
    comment: observationComment
  };
}

module.exports = processSessionAnswers;