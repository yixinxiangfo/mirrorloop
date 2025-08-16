// processSessionAnswers.js（超軽量版 - タイムアウト対策）

const { pushText } = require('./lineUtils');

async function processSessionAnswers(answers, userId, notionClient, openaiClient, lineClient) {
  console.log('📄 Processing session answers for user:', userId.substring(0, 8) + '...');
  console.log('📝 Total answers:', answers.length);

  try {
    // シンプルな観照メッセージ（OpenAI呼び出しなし）
    await pushText(lineClient, userId, 
      `【観照の結果】\n\n9つの問いを通じて、あなた自身の心の動きを見つめることができました。`
    );
    
    console.log('✅ Simple observation message sent');

    // 非同期でSupabase保存（メイン処理をブロックしない）
    setImmediate(async () => {
      try {
        const supabase = require('./supabaseClient');
        
        const { data, error } = await supabase
          .from('mind_observations')
          .insert({
            line_user_id: userId,
            message_content: `観照セッション ${new Date().toLocaleDateString('ja-JP')}`,
            session_answers: answers,
            created_at: new Date().toISOString()
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

  } catch (error) {
    console.error('❌ Process error:', error.message);
    
    try {
      await pushText(lineClient, userId, 
        `【観照の結果】\n\n9つの問いに真摯に向き合い、自分の心を見つめることができました。`
      );
    } catch (fallbackError) {
      console.error("❌ Fallback message failed:", fallbackError.message);
    }
  }
}

module.exports = processSessionAnswers;