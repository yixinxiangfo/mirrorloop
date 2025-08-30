// lineUtils.js

// 改行修正用のヘルパー関数（追加）
function formatLineBreaks(text) {
  if (!text) return text;
  
  return text
    .replace(/\\n/g, '\n')       // エスケープされた\nを実際の改行に
    .replace(/\r\n/g, '\n')      // Windows改行を統一
    .replace(/\r/g, '\n')        // Mac改行を統一
    .trim();
}

/**
 * 複数のテキストメッセージを1回のreplyで送信
 * replyTokenは1回のみ使用可能なため、複数メッセージは配列で送信
 * @param {Object} lineClient - LINEクライアント
 * @param {string} replyToken - 応答トークン（1回のみ使用可能）
 * @param {string[]} texts - 送信するテキストの配列
 */
async function replyMessages(lineClient, replyToken, texts) {
  try {
    if (!texts || texts.length === 0) {
      console.warn('⚠️ No messages to reply');
      return;
    }
    
    // テキストメッセージオブジェクトの配列を作成（改行修正適用）
    const messages = texts.map(text => ({
      type: 'text',
      text: formatLineBreaks(text)  // 修正：改行処理を追加
    }));
    
    console.log(`📤 Replying with ${messages.length} messages`);
    
    await lineClient.replyMessage(replyToken, messages);
    console.log('✅ Reply messages sent successfully');
    
  } catch (error) {
    console.error('❌ Reply messages error:', {
      error: error.message,
      stack: error.stack,
      replyToken,
      messageCount: texts?.length
    });
    throw error;
  }
}

/**
 * 単一のテキストメッセージをreplyで送信（後方互換性用）
 * @param {Object} lineClient - LINEクライアント
 * @param {string} replyToken - 応答トークン
 * @param {string} text - 送信するテキスト
 */
async function replyText(lineClient, replyToken, text) {
  return await replyMessages(lineClient, replyToken, [text]);
}

/**
 * プッシュメッセージでテキストを送信
 * @param {Object} lineClient - LINEクライアント
 * @param {string} userId - ユーザーID
 * @param {string} text - 送信するテキスト
 */
async function pushText(lineClient, userId, text) {
  try {
    if (!text) {
      console.warn('⚠️ No text to push');
      return;
    }
    
    console.log(`📤 Pushing message to user: ${userId}`);
    
    await lineClient.pushMessage(userId, {
      type: 'text',
      text: formatLineBreaks(text)  // 修正：改行処理を追加
    });
    
    console.log('✅ Push message sent successfully');
    
  } catch (error) {
    console.error('❌ Push message error:', {
      error: error.message,
      stack: error.stack,
      userId,
      text: text?.substring(0, 50)
    });
    throw error;
  }
}

/**
 * 複数のテキストメッセージをプッシュで送信
 * @param {Object} lineClient - LINEクライアント
 * @param {string} userId - ユーザーID
 * @param {string[]} texts - 送信するテキストの配列
 */
async function pushMessages(lineClient, userId, texts) {
  try {
    if (!texts || texts.length === 0) {
      console.warn('⚠️ No messages to push');
      return;
    }
    
    const messages = texts.map(text => ({
      type: 'text',
      text: formatLineBreaks(text)  // 修正：改行処理を追加
    }));
    
    console.log(`📤 Pushing ${messages.length} messages to user: ${userId}`);
    
    await lineClient.pushMessage(userId, messages);
    console.log('✅ Push messages sent successfully');
    
  } catch (error) {
    console.error('❌ Push messages error:', {
      error: error.message,
      stack: error.stack,
      userId,
      messageCount: texts?.length
    });
    throw error;
  }
}

module.exports = {
  replyMessages,   // 新しい主要関数
  replyText,       // 後方互換性用
  pushText,
  pushMessages
};