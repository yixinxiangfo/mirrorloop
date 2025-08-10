// sessionMessageHandler.js（応急処置版）
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
    
    console.log('🔍 Session debug:', {
      userId: userId.substring(0, 8) + '...',
      hasSession: !!session,
      sessionState: session ? {
        currentQuestionIndex: session.currentQuestionIndex,
        answersCount: session.answers.length,
        isComplete: session.isComplete
      } : null,
      userText: text.substring(0, 50) + '...'
    });
    
    // 新規セッション開始
    if (!session && text !== '') {
      console.log('🆕 Starting new session for user:', userId.substring(0, 8) + '...');
      createSession(userId);
      setSessionTimeout(userId, lineClient);
      
      await replyMessages(lineClient, event.replyToken, [
        "ようこそMirrorLoopへ。",
        questions[0]
      ]);
      return;
    }
    
    // セッション進行中の処理
    if (session && !session.isComplete) {
      console.log('📝 Processing session response:', { 
        userId: userId.substring(0, 8) + '...',
        questionIndex: session.currentQuestionIndex,
        text: text.substring(0, 50) + '...',
        totalQuestions: questions.length
      });
      
      setSessionTimeout(userId, lineClient); // タイマーリセット
      
      // 🚧 応急処置：分類機能を一時的に簡略化
      let classification = "A"; // デフォルトは正常回答として扱う
      
      // 明らかに不適切な回答のみをチェック
      const inappropriateKeywords = ['死ね', 'バカ', 'アホ', 'くそ', '殺す'];
      const isInappropriate = inappropriateKeywords.some(keyword => 
        text.toLowerCase().includes(keyword.toLowerCase())
      );
      
      // 非常に短い回答（1文字など）もチェック
      const isTooShort = text.length < 2;
      
      if (isInappropriate || isTooShort) {
        classification = "C";
      } else {
        // 💡 本格的な分類は後で実装（現在はほぼ全てA判定）
        try {
          // OpenAI分類をトライするが、エラー時はA判定にフォールバック
          classification = await classifyUserResponse(openaiClient, text);
          console.log('🔍 OpenAI Classification result:', classification);
          
          // 🚧 応急処置：C判定を緩和
          if (classification === "C" && text.length >= 5) {
            console.log('🔧 Overriding C classification to A for substantial response');
            classification = "A";
          }
        } catch (classifyError) {
          console.error('⚠️ Classification error, defaulting to A:', classifyError.message);
          classification = "A";
        }
      }
      
      console.log('🎯 Final classification:', classification);
      
      if (classification === "C") {
        // 逸脱・不適切な回答（非常に限定的にのみ）
        await replyMessages(lineClient, event.replyToken, [
          "もう一度、心を落ち着けて答えてみてください。",
          "どんな小さなことでも構いません。"
        ]);
        // 🔧 修正：セッションはクリアしない（チャンスを与える）
        return;
      }
      
      if (classification === "B") {
        // 相談・逆質問への対応
        try {
          const comment = await generateObservationComment(openaiClient, text);
          const qIndex = session.currentQuestionIndex;
          
          await replyMessages(lineClient, event.replyToken, [
            comment,
            questions[qIndex]
          ]);
        } catch (commentError) {
          console.error('⚠️ Comment generation error:', commentError.message);
          // フォールバック：シンプルな応答
          await replyMessages(lineClient, event.replyToken, [
            "その気持ち、よくわかります。",
            questions[session.currentQuestionIndex]
          ]);
        }
        return;
      }
      
      // 通常の回答として処理（A）
      console.log('✅ Processing as normal answer (A)');
      updateSession(userId, text);
      session = getSession(userId); // 更新されたセッション取得
      
      console.log('📊 Session after update:', {
        currentQuestionIndex: session.currentQuestionIndex,
        answersCount: session.answers.length,
        totalQuestions: questions.length
      });
      
      if (session.currentQuestionIndex < questions.length) {
        // まだ質問が残っている
        console.log('➡️ Sending next question:', session.currentQuestionIndex);
        await replyMessages(lineClient, event.replyToken, [
          questions[session.currentQuestionIndex]
        ]);
      } else {
        // 全質問完了
        console.log('🎯 Session completed for user:', userId.substring(0, 8) + '...');
        session.isComplete = true;
        
        await replyMessages(lineClient, event.replyToken, [
          "ありがとうございます。観照をまとめます…"
        ]);
        
        // 非同期でNotion処理を実行
        processSessionAnswers(session.answers, userId, notionClient, openaiClient)
          .then(() => {
            console.log('✅ Session processing completed for user:', userId.substring(0, 8) + '...');
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
    console.log('🏠 No active session, showing welcome message');
    await replyMessages(lineClient, event.replyToken, [
      "MirrorLoopへようこそ。どんなことでも構いません。まずは感じたことを送ってみてください。"
    ]);
    
  } catch (error) {
    console.error('❌ Session handler error:', {
      error: error.message,
      stack: error.stack,
      userId: userId.substring(0, 8) + '...',
      text: text.substring(0, 100)
    });
    
    // エラー時の処理を改善
    try {
      await replyMessages(lineClient, event.replyToken, [
        "申し訳ありません。一時的な問題が発生しました。もう一度お試しください。"
      ]);
    } catch (replyError) {
      console.error('❌ Error reply failed:', replyError.message);
    }
    
    // 🔧 重要な修正：エラー時もセッションは保持（ユーザー体験向上）
    // clearSession(userId);
    // clearSessionTimeout(userId);
  }
}

module.exports = { sessionMessageHandler };