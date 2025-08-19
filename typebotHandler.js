// typebotHandler.js
// Typebot統合ハンドラー

//const fetch = require('node-fetch');← この行を削除またはコメントアウト
const processSessionAnswers = require('./processSessionAnswers');

// Typebotセッション管理
const typebotSessions = {}; // userId -> sessionId

// メイン処理関数
async function handleTypebotFlow(event, notionClient, openaiClient, lineClient) {
  const userId = event.source.userId;
  const message = event.message.text;
  
  console.log('🤖 Typebot handler called:', {
    userId: userId.substring(0, 8) + '...',
    message: message.substring(0, 50)
  });
  
  try {
    // TODO: Typebot API呼び出し実装
    console.log('⏳ Typebot API call - Coming soon...');
    
    // 暫定的な応答
    await lineClient.replyMessage(event.replyToken, {
      type: 'text',
      text: 'Typebot統合モードです（実装中）'
    });
    
  } catch (error) {
    console.error('❌ Typebot handler error:', error);
    
    await lineClient.replyMessage(event.replyToken, {
      type: 'text',
      text: '申し訳ありません。一時的な問題が発生しました。'
    });
  }
}

module.exports = { handleTypebotFlow };