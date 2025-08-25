const axios = require('axios');

const sessionStore = new Map(); // セッション状態管理

async function handleTypebotFlow(event, notionClient, openaiClient, lineClient) {
  try {
    const userId = event.source.userId;
    const userMessage = event.message.text;
    
    console.log(`[Typebot] ユーザー ${userId} からのメッセージ: ${userMessage}`);

    // 環境変数から設定を取得
    const TYPEBOT_URL = process.env.TYPEBOT_URL;
    const TYPEBOT_API_TOKEN = process.env.TYPEBOT_API_TOKEN;
    
    if (!TYPEBOT_URL) {
      throw new Error('TYPEBOT_URL環境変数が設定されていません');
    }
    
    if (!TYPEBOT_API_TOKEN) {
      throw new Error('TYPEBOT_API_TOKEN環境変数が設定されていません');
    }

    console.log(`[Debug] TYPEBOT_URL: ${TYPEBOT_URL}`);
    console.log(`[Debug] TYPEBOT_API_TOKEN存在: ${!!TYPEBOT_API_TOKEN}`);

    // 認証ヘッダーを追加
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TYPEBOT_API_TOKEN}`
    };

    let sessionId = sessionStore.get(userId);
    let apiResponse;

    if (!sessionId) {
      // 新しいチャット開始
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
      // 既存セッションの続行
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

    // 🎯 Typebot応答の処理（改良版）
    console.log('[Typebot] API応答:', JSON.stringify(apiResponse.data, null, 2));
    
    const typebotMessages = apiResponse.data.messages || [];
    const typebotInput = apiResponse.data.input;

    // 🔧 LINE返信の構築（ボタン対応）
    await sendFormattedResponse(lineClient, event.replyToken, typebotMessages, typebotInput);

    // セッション完了判定の改良
    const isSessionComplete = checkSessionComplete(apiResponse.data);
    
    if (isSessionComplete) {
      console.log('[Typebot] セッション完了を検出');
      
      // 観照セッション分析の実行
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
        
        // 追加メッセージとして分析結果を送信
        await lineClient.pushMessage(userId, {
          type: 'text',
          text: `✨ 観照セッションが完了しました\n\n${analysisResult.comment}`
        });
      }
      
      // セッション終了時にクリーンアップ
      sessionStore.delete(userId);
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
 * 🆕 フォーマット済み応答の送信（ボタン対応）
 */
async function sendFormattedResponse(lineClient, replyToken, messages, input) {
  const lineMessages = [];
  
  // 1. テキストメッセージの処理
  if (messages && messages.length > 0) {
    for (const message of messages) {
      const messageText = extractTextFromMessage(message);
      if (messageText) {
        // 長いメッセージを分割
        const chunks = splitLongMessage(messageText);
        for (const chunk of chunks) {
          lineMessages.push({
            type: 'text',
            text: chunk
          });
        }
      }
    }
  }

  // 2. 入力タイプに基づく処理
  if (input) {
    console.log('[Typebot] Input detected:', input.type);
    console.log('[Typebot] Input full data:', JSON.stringify(input, null, 2));
    
    // 🎯 各種入力タイプに対応
    if (input.type === 'choice input' || input.type === 'buttons input' || input.items) {
      // 選択肢をLINE Quick Replyに変換
      const quickReply = convertToQuickReply(input);
      if (quickReply && quickReply.items.length > 0) {
        const lastMessage = lineMessages[lineMessages.length - 1];
        if (lastMessage) {
          lastMessage.quickReply = quickReply;
          console.log('[Typebot] QuickReply added to last message');
        } else {
          // メッセージがない場合は選択肢だけ送信
          lineMessages.push({
            type: 'text',
            text: '✨ 選択してください',
            quickReply: quickReply
          });
          console.log('[Typebot] Standalone QuickReply message created');
        }
      } else {
        console.log('[Typebot] Failed to create QuickReply from input');
      }
    } else if (input.type === 'text input') {
      // 🔇 テキスト入力時の案内メッセージを削除（ユーザー要望）
      // 必要に応じて特別な場合のみ表示するよう制御可能
      console.log('[Typebot] Text input detected - no additional message');
    }
  }

  // 3. メッセージ送信（最大5つまで）
  if (lineMessages.length > 0) {
    const messagesToSend = lineMessages.slice(0, 5); // LINE制限
    await lineClient.replyMessage(replyToken, messagesToSend);
  }
}

/**
 * 🆕 選択肢をLINE Quick Replyに変換（Typebot実データ対応 + 3つ制限）
 */
function convertToQuickReply(input) {
  console.log('[Debug] Converting input to QuickReply:', JSON.stringify(input, null, 2));
  
  if (!input.items || !Array.isArray(input.items)) {
    console.log('[Debug] No items found or items is not array');
    return null;
  }
  
  // 🎯 3つまでに制限（スクロール防止）
  const limitedItems = input.items.slice(0, 3);
  const hasMoreItems = input.items.length > 3;
  
  const quickReplyItems = limitedItems.map((item, index) => {
    // Typebotのアイテム構造に対応
    const label = item.content || item.text || item.label || `選択肢${index + 1}`;
    
    console.log(`[Debug] Item ${index}:`, { 
      content: item.content, 
      text: item.text, 
      label: item.label,
      final: label 
    });
    
    return {
      type: 'action',
      action: {
        type: 'message',
        label: label.trim(),
        text: label.trim()
      }
    };
  });

  // 4つ以上ある場合は「その他」を追加
  if (hasMoreItems) {
    quickReplyItems.push({
      type: 'action',
      action: {
        type: 'message',
        label: 'その他の選択肢',
        text: 'その他'
      }
    });
    console.log(`[Debug] Added "その他" button (${input.items.length} total items)`);
  }

  console.log('[Debug] Generated QuickReply items:', quickReplyItems);

  return {
    items: quickReplyItems
  };
}

/**
 * 🆕 長いメッセージを適切に分割
 */
function splitLongMessage(text, maxLength = 500) {
  if (text.length <= maxLength) return [text];
  
  const chunks = [];
  const paragraphs = text.split('\n\n');
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length + 2 > maxLength) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      
      if (paragraph.length > maxLength) {
        // 非常に長い段落は強制分割
        const sentences = paragraph.split('。');
        for (const sentence of sentences) {
          if (currentChunk.length + sentence.length + 1 > maxLength) {
            if (currentChunk) {
              chunks.push(currentChunk.trim());
              currentChunk = '';
            }
          }
          currentChunk += sentence + '。';
        }
      } else {
        currentChunk = paragraph;
      }
    } else {
      if (currentChunk) currentChunk += '\n\n';
      currentChunk += paragraph;
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
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
 * セッション回答抽出の改良版（デバッグ強化）
 */
function extractSessionAnswers(typebotResponse) {
  const answers = {};
  
  console.log('[Debug] === セッション回答抽出開始 ===');
  console.log('[Debug] typebotResponse全体:', JSON.stringify(typebotResponse, null, 2));
  
  // パターン1: typebot.variables から抽出
  if (typebotResponse.typebot && typebotResponse.typebot.variables) {
    console.log('[Debug] typebot.variables found:', typebotResponse.typebot.variables.length);
    typebotResponse.typebot.variables.forEach((variable, index) => {
      console.log(`[Debug] Variable ${index}:`, {
        name: variable.name,
        value: variable.value,
        isSessionVariable: variable.isSessionVariable
      });
      
      // answer1-answer9 以外の変数も確認
      if (variable.name && variable.value) {
        if (variable.name.match(/^answer[1-9]$/)) {
          answers[variable.name] = variable.value;
          console.log(`[Debug] ✅ Found answer: ${variable.name} = ${variable.value}`);
        } else {
          console.log(`[Debug] Other variable: ${variable.name} = ${variable.value}`);
        }
      }
    });
  } else {
    console.log('[Debug] ❌ typebot.variables not found');
  }
  
  // パターン2: result.variables から抽出
  if (typebotResponse.result && typebotResponse.result.variables) {
    console.log('[Debug] result.variables found:', typebotResponse.result.variables.length);
    typebotResponse.result.variables.forEach((variable, index) => {
      console.log(`[Debug] Result Variable ${index}:`, {
        name: variable.name,
        value: variable.value
      });
      
      if (variable.name && variable.name.match(/^answer[1-9]$/)) {
        answers[variable.name] = variable.value || '';
        console.log(`[Debug] ✅ Found result answer: ${variable.name} = ${variable.value}`);
      }
    });
  } else {
    console.log('[Debug] ❌ result.variables not found');
  }
  
  // パターン3: 他の場所を探索
  if (typebotResponse.variables) {
    console.log('[Debug] Direct variables found:', typebotResponse.variables.length);
    typebotResponse.variables.forEach((variable, index) => {
      console.log(`[Debug] Direct Variable ${index}:`, variable);
    });
  }
  
  console.log('[Debug] === 最終抽出結果 ===');
  console.log('[Debug] answers:', answers);
  console.log('[Debug] answers count:', Object.keys(answers).length);
  
  // 空の場合は警告
  if (Object.keys(answers).length === 0) {
    console.log('[WARNING] ⚠️ 回答が1つも抽出できませんでした！');
    console.log('[WARNING] Typebot変数名が想定と異なる可能性があります');
  }
  
  return answers;
}

module.exports = {
  handleTypebotFlow
};