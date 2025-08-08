// sessionMessageHandler.js
const { getSession, createSession, updateSession, clearSession } = require('./sessionStore');
const questions = require('./questions');
const { replyMessages, pushText } = require('./lineUtils');
const { classifyUserResponse, generateObservationComment } = require('./openaiUtils');
const processSessionAnswers = require('./processSessionAnswers');

// セッションタイマー管理
const sessionTimeouts = {}; // userId -> timeoutID
const SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15分

function setSessionTimeout(userId, lineClient) {
  // 既存のタイマーをクリア
  if (sessionTimeouts[userId]) {
    clearTimeout(sessionTimeouts[userId]);
  }
  
  sessionTimeouts[userId] = setTimeout(async () => {
    try {
      await pushText(lineClient, userId, "MirrorLoopにお越しいただきありがとうございました。また来てくださいね。");
      clearSession(userId);
      delete sessionTimeouts[userId];
    } catch (error) {
      console.error('❌ Session timeout error:', error);
    }
  }, SESSION_TIMEOUT_MS);
}

function clearSessionTimeout(userId) {
  if (sessionTimeouts[userId]) {
    clearTimeout(sessionTimeouts[userId]);
    delete sessionTimeouts[userId];
  }
}

// メインのメッセージハンドラー
async function sessionMessageHandler(event, notionClient, openaiClient, lineClient) {
  const userId = event.source.userId;
  const text = event.message.text.trim();
  
  try {
    let session = getSession(userId);
    
    // 新規セッション開始
    if (!session && text !== '') {
      console.log('🆕 Starting new session for user:', userId);
      createSession(userId);
      setSessionTimeout(userId, lineClient);
      
      // 複数メッセージを1回のreplyで送信（重要：replyTokenは1回のみ使用可能）
      await replyMessages(lineClient, event.replyToken, [
        "ようこそMirrorLoopへ。",
        questions[0]
      ]);
      return;
    }
    
    // セッション進行中の処理
    if (session && !session.isComplete) {
      console.log('📝 Processing session response:', { userId, questionIndex: session.currentQuestionIndex, text: text.substring(0, 50) + '...' });
      
      setSessionTimeout(userId, lineClient); // タイマーリセット
      
      // OpenAIでユーザー回答を分類
      const classification = await classifyUserResponse(openaiClient, text);
      console.log('🔍 Classification result:', classification);
      
      if (classification === "C") {
        // 逸脱・不適切な回答
        await replyMessages(lineClient, event.replyToken, [
          "今回は、あなたの答えから観照の意図を見つけることができませんでした。",
          "また改めて、心を見つめたいときにご利用ください。"
        ]);
        clearSession(userId);
        clearSessionTimeout(userId);
        return;
      }
      
      if (classification === "B") {
        // 相談・逆質問への対応
        const comment = await generateObservationComment(openaiClient, text);
        const qIndex = session.currentQuestionIndex;
        
        await replyMessages(lineClient, event.replyToken, [
          comment,
          questions[qIndex]
        ]);
        return;
      }
      
      // 通常の回答として処理（A）
      updateSession(userId, text);
      session = getSession(userId); // 更新されたセッション取得
      
      if (session.currentQuestionIndex < questions.length) {
        // まだ質問が残っている
        await replyMessages(lineClient, event.replyToken, [
          questions[session.currentQuestionIndex]
        ]);
      } else {
        // 全質問完了
        console.log('🎯 Session completed for user:', userId);
        session.isComplete = true;
        
        await replyMessages(lineClient, event.replyToken, [
          "ありがとうございます。観照をまとめます…"
        ]);
        
        // 非同期でNotion処理を実行（ユーザーを待たせない）
        processSessionAnswers(session.answers, userId, notionClient, openaiClient)
          .then(() => {
            console.log('✅ Session processing completed for user:', userId);
          })
          .catch((error) => {
            console.error('❌ Session processing error:', error);
          });
        
        clearSession(userId);
        clearSessionTimeout(userId);
      }
      return;
    }
    
    // セッション外からのメッセージ
    await replyMessages(lineClient, event.replyToken, [
      "MirrorLoopへようこそ。どんなことでも構いません。まずは感じたことを送ってみてください。"
    ]);
    
  } catch (error) {
    console.error('❌ Session handler error:', {
      error: error.message,
      stack: error.stack,
      userId,
      text: text.substring(0, 100)
    });
    
    // エラー時はセッションをクリア
    clearSession(userId);
    clearSessionTimeout(userId);
    
    try {
      await replyMessages(lineClient, event.replyToken, [
        "申し訳ありません。一時的な問題が発生しました。もう一度お試しください。"
      ]);
    } catch (replyError) {
      console.error('❌ Error reply failed:', replyError.message);
    }
  }
}

module.exports = { sessionMessageHandler };