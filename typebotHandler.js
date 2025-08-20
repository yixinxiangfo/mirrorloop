const axios = require('axios');

const sessionStore = new Map(); // セッション状態管理

async function handleTypebotFlow(event, notionClient, openaiClient, lineClient) {
  try {
    const userId = event.source.userId;
    const userMessage = event.message.text;
    
    console.log(`[Typebot] ユーザー ${userId} からのメッセージ: ${userMessage}`);

    // 環境変数から設定を取得
    const TYPEBOT_URL = process.env.TYPEBOT_URL;
    const TYPEBOT_API_TOKEN = process.env.TYPEBOT_API_TOKEN; // 🆕 追加
    
    if (!TYPEBOT_URL) {
      throw new Error('TYPEBOT_URL環境変数が設定されていません');
    }
    
    if (!TYPEBOT_API_TOKEN) {
      throw new Error('TYPEBOT_API_TOKEN環境変数が設定されていません');
    }

    // 🆕 認証ヘッダーを追加
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TYPEBOT_API_TOKEN}`
    };

    let sessionId = sessionStore.get(userId);
    let apiResponse;

    if (!sessionId) {
      // 🔄 新しいチャット開始 (認証ヘッダー追加)
      console.log('[Typebot] 新しいセッション開始');
      
      const startChatUrl = `${TYPEBOT_URL}/startChat`;
      const requestBody = {
        message: {
          type: "text",
          text: userMessage
        },
        isStreamEnabled: false
      };

      console.log(`[Typebot] StartChat API呼び出し: ${startChatUrl}`);
      console.log(`[Typebot] Request body:`, JSON.stringify(requestBody, null, 2));

      apiResponse = await axios.post(startChatUrl, requestBody, { headers });
      
      // セッションIDを保存
      sessionId = apiResponse.data.sessionId;
      sessionStore.set(userId, sessionId);
      
      console.log(`[Typebot] セッション開始成功: ${sessionId}`);
      
    } else {
      // 🔄 既存セッションの続行 (認証ヘッダー追加)
      console.log(`[Typebot] 既存セッション続行: ${sessionId}`);
      
      const continueChatUrl = `https://typebot.io/api/v1/sessions/${sessionId}/continueChat`;
      const requestBody = {
        message: {
          type: "text",
          text: userMessage
        }
      };

      console.log(`[Typebot] ContinueChat API呼び出し: ${continueChatUrl}`);
      
      apiResponse = await axios.post(continueChatUrl, requestBody, { headers });
    }

    // 🎯 Typebot応答の処理
    console.log('[Typebot] API応答:', JSON.stringify(apiResponse.data, null, 2));
    
    const typebotMessages = apiResponse.data.messages || [];
    const typebotInput = apiResponse.data.input;

    // LINE返信メッセージを構築
    let replyText = '';
    
    if (typebotMessages.length > 0) {
      replyText = typebotMessages
        .map(msg => extractTextFromMessage(msg))
        .filter(text => text)
        .join('\n\n');
    }

    // セッション完了判定の改良
    const isSessionComplete = checkSessionComplete(apiResponse.data);
    
    if (isSessionComplete) {
      console.log('[Typebot] セッション完了を検出');
      
      // 🔍 観照セッション分析の実行
      const sessionAnswers = extractSessionAnswers(apiResponse.data);
      
      if (sessionAnswers && Object.keys(sessionAnswers).length > 0) {
        console.log('[Typebot] セッション回答を抽出:', sessionAnswers);
        
        // processSessionAnswers.js を呼び出し
        const { processSessionAnswers } = require('./processSessionAnswers');
        const analysisResult = await processSessionAnswers(
          sessionAnswers, 
          openaiClient, 
          notionClient, 
          userId
        );
        
        replyText += `\n\n✨ 観照セッションが完了しました\n${analysisResult.comment}`;
      }
      
      // セッション終了時にクリーンアップ
      sessionStore.delete(userId);
    }

    // LINE返信
    if (replyText) {
      await lineClient.replyMessage(event.replyToken, {
        type: 'text',
        text: replyText
      });
    }

    return { success: true, sessionComplete: isSessionComplete };

  } catch (error) {
    console.error('[Typebot] エラー発生:', error);
    
    // より詳細なエラー情報をログ出力
    if (error.response) {
      console.error('[Typebot] API Error Response:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        headers: error.response.headers
      });
    }
    
    // ユーザーにエラーメッセージを返信
    await lineClient.replyMessage(event.replyToken, {
      type: 'text',
      text: '申し訳ありません。システムエラーが発生しました。\n従来版での観照をお試しください。'
    });
    
    return { success: false, error: error.message };
  }
}

/**
 * メッセージからテキストを抽出
 */
function extractTextFromMessage(message) {
  if (!message || !message.content) return '';
  
  if (message.content.type === 'richText' && message.content.richText) {
    try {
      // richTextが配列の場合の処理
      if (Array.isArray(message.content.richText)) {
        return message.content.richText
          .map(block => {
            if (block.children && Array.isArray(block.children)) {
              return block.children.map(child => child.text || '').join('');
            }
            return block.text || '';
          })
          .join('');
      }
      
      // richTextが直接テキストの場合
      if (typeof message.content.richText === 'string') {
        return message.content.richText;
      }
    } catch (e) {
      console.warn('[Typebot] richText解析エラー:', e);
    }
  }
  
  return message.content.text || '';
}

/**
 * セッション完了判定の改良版
 */
function checkSessionComplete(typebotResponse) {
  // 1. inputがnullまたは未定義 = セッション終了
  if (!typebotResponse.input) {
    return true;
  }
  
  // 2. 最後のメッセージに完了の兆候があるか
  const lastMessage = typebotResponse.messages?.[typebotResponse.messages.length - 1];
  if (lastMessage) {
    const messageText = extractTextFromMessage(lastMessage).toLowerCase();
    const completionKeywords = [
      'セッション完了', 'ありがとうございました', '観照が終了',
      'session complete', 'thank you', 'goodbye'
    ];
    
    if (completionKeywords.some(keyword => messageText.includes(keyword))) {
      return true;
    }
  }
  
  // 3. 進行度が100%の場合
  if (typebotResponse.progress === 100) {
    return true;
  }
  
  return false;
}

/**
 * セッション回答抽出の改良版
 */
function extractSessionAnswers(typebotResponse) {
  const answers = {};
  
  // variables から answer1-answer9 を抽出
  if (typebotResponse.typebot && typebotResponse.typebot.variables) {
    typebotResponse.typebot.variables.forEach(variable => {
      if (variable.name && variable.name.match(/^answer[1-9]$/)) {
        answers[variable.name] = variable.value || '';
      }
    });
  }
  
  // 代替方法: resultから抽出
  if (Object.keys(answers).length === 0 && typebotResponse.result) {
    if (typebotResponse.result.variables) {
      typebotResponse.result.variables.forEach(variable => {
        if (variable.name && variable.name.match(/^answer[1-9]$/)) {
          answers[variable.name] = variable.value || '';
        }
      });
    }
  }
  
  console.log('[Typebot] 抽出された回答:', answers);
  return answers;
}

module.exports = {
  handleTypebotFlow
};