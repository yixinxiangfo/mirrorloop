// typebotHandler.js
// Typebot統合ハンドラー（完全版）

const processSessionAnswers = require('./processSessionAnswers');

// Typebotセッション管理
const typebotSessions = {}; // userId -> { sessionId, lastActivity }

// Typebot API呼び出し
async function callTypebotAPI(message, userId) {
  const TYPEBOT_URL = process.env.TYPEBOT_URL || 'https://typebot.io/api/v1/typebots/my-typebot-vfisn8x';
  
  console.log('🤖 Calling Typebot API:', {
    userId: userId.substring(0, 8) + '...',
    message: message.substring(0, 50),
    hasExistingSession: !!typebotSessions[userId]
  });

  try {
    let apiUrl, requestBody;

    if (typebotSessions[userId] && typebotSessions[userId].sessionId) {
      // 既存セッションの継続
      const sessionId = typebotSessions[userId].sessionId;
      apiUrl = `https://typebot.io/api/v1/sessions/${sessionId}/continueChat`;
      requestBody = {
        message: message
      };
      console.log('📞 Continuing existing session:', sessionId.substring(0, 8) + '...');
    } else {
      // 新規セッション開始
      apiUrl = `${TYPEBOT_URL}/startChat`;
      requestBody = {
        message: message || ''
      };
      console.log('🆕 Starting new Typebot session');
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Typebot API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    console.log('✅ Typebot API response:', {
      sessionId: data.sessionId?.substring(0, 8) + '...' || 'N/A',
      messagesCount: data.messages?.length || 0,
      hasMessages: !!(data.messages && data.messages.length > 0)
    });

    // セッションIDを保存
    if (data.sessionId) {
      typebotSessions[userId] = {
        sessionId: data.sessionId,
        lastActivity: new Date()
      };
    }

    return data;

  } catch (error) {
    console.error('❌ Typebot API call failed:', {
      error: error.message,
      userId: userId.substring(0, 8) + '...',
      url: apiUrl || 'N/A'
    });
    throw error;
  }
}

// 観照セッション完了判定
function isSessionComplete(typebotResponse) {
  if (!typebotResponse || !typebotResponse.messages) {
    return false;
  }

  // Typebotからの最後のメッセージをチェック
  const lastMessage = typebotResponse.messages[typebotResponse.messages.length - 1];
  
  if (lastMessage && lastMessage.content) {
    const content = lastMessage.content.toLowerCase();
    
    // 観照セッション完了を示すキーワード
    const completionKeywords = [
      '観照の結果',
      '心の動き',
      '執着や煩悩',
      '真の自己理解'
    ];
    
    const isComplete = completionKeywords.some(keyword => content.includes(keyword));
    
    console.log('🔍 Session completion check:', {
      isComplete,
      lastMessagePreview: content.substring(0, 100)
    });
    
    return isComplete;
  }

  return false;
}

// Typebotから回答データを抽出
function extractAnswersFromTypebot(typebotResponse) {
  const answers = [];
  
  // Typebotの変数から回答を抽出
  // 注：これはTypebotの変数設定に依存します
  for (let i = 1; i <= 9; i++) {
    const variableName = `answer${i}`;
    if (typebotResponse.variables && typebotResponse.variables[variableName]) {
      answers.push(typebotResponse.variables[variableName]);
    }
  }
  
  console.log('📊 Extracted answers from Typebot:', {
    answerCount: answers.length,
    expectedCount: 9
  });
  
  return answers;
}

// メイン処理関数
async function handleTypebotFlow(event, notionClient, openaiClient, lineClient) {
  const userId = event.source.userId;
  const message = event.message.text;
  
  console.log('🤖 === TYPEBOT HANDLER START ===');
  console.log('👤 User:', userId.substring(0, 8) + '...');
  console.log('💬 Message:', message.substring(0, 100));
  
  try {
    // 1. Typebot API呼び出し
    const typebotResponse = await callTypebotAPI(message, userId);
    
    // 2. Typebotからの応答をLINEに送信
    if (typebotResponse.messages && typebotResponse.messages.length > 0) {
      const responseMessage = typebotResponse.messages[0].content;
      
      await lineClient.replyMessage(event.replyToken, {
        type: 'text',
        text: responseMessage
      });
      
      console.log('📤 Sent Typebot response to LINE');
    }
    
    // 3. 観照セッション完了チェック
    if (isSessionComplete(typebotResponse)) {
      console.log('🎯 === TYPEBOT SESSION COMPLETED ===');
      
      // 4. 回答データ抽出
      const answers = extractAnswersFromTypebot(typebotResponse);
      
      if (answers.length >= 9) {
        // 5. 既存の分析処理を実行
        console.log('🔄 Starting processSessionAnswers...');
        
        // 非同期で分析処理実行
        processSessionAnswers(answers, userId, notionClient, openaiClient, lineClient)
          .then(() => {
            console.log('✅ processSessionAnswers completed successfully');
          })
          .catch((error) => {
            console.error('❌ processSessionAnswers error:', error);
          });
      } else {
        console.warn('⚠️ Insufficient answers extracted:', answers.length);
      }
      
      // 6. セッションクリア
      delete typebotSessions[userId];
      console.log('🧹 Typebot session cleared');
    }
    
  } catch (error) {
    console.error('❌ Typebot handler error:', {
      error: error.message,
      stack: error.stack,
      userId: userId.substring(0, 8) + '...'
    });
    
    // エラー時はセッションクリア
    delete typebotSessions[userId];
    
    // エラー応答
    try {
      await lineClient.replyMessage(event.replyToken, {
        type: 'text',
        text: '申し訳ありません。一時的な問題が発生しました。もう一度お試しください。'
      });
    } catch (replyError) {
      console.error('❌ Error reply failed:', replyError.message);
    }
  } finally {
    console.log('🤖 === TYPEBOT HANDLER END ===');
  }
}

// セッションクリーンアップ（オプション：古いセッションを定期的にクリア）
function cleanupOldSessions() {
  const now = new Date();
  const TIMEOUT_MS = 30 * 60 * 1000; // 30分
  
  Object.keys(typebotSessions).forEach(userId => {
    const session = typebotSessions[userId];
    if (session.lastActivity && (now - session.lastActivity) > TIMEOUT_MS) {
      delete typebotSessions[userId];
      console.log('🧹 Cleaned up old Typebot session:', userId.substring(0, 8) + '...');
    }
  });
}

// 定期クリーンアップ（5分ごと）
setInterval(cleanupOldSessions, 5 * 60 * 1000);

module.exports = { handleTypebotFlow };