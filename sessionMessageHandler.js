// sessionMessageHandler.js（デバッグ強化版）
const { getSession, createSession, updateSession, clearSession } = require('./sessionStore');
const questions = require('./questions');
const { replyMessages, pushText } = require('./lineUtils');
const { classifyUserResponse, generateObservationComment } = require('./openaiUtils');
const processSessionAnswers = require('./processSessionAnswers');

// セッションタイマー管理
const sessionTimeouts = {}; // userId -> timeoutID
const SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15分

function setSessionTimeout(userId, lineClient) {
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
  const userIdShort = userId.substring(0, 8) + '...';
  
  console.log('🔍 === SESSION HANDLER START ===');
  console.log('👤 User:', userIdShort);
  console.log('💬 Input:', text.substring(0, 100));
  
  try {
    let session = getSession(userId);
    
    // 詳細なセッション状態ログ
    console.log('📊 Session state BEFORE processing:', {
      hasSession: !!session,
      sessionData: session ? {
        currentQuestionIndex: session.currentQuestionIndex,
        answersCount: session.answers.length,
        isComplete: session.isComplete,
        answers: session.answers.map((ans, i) => `${i}: ${ans.substring(0, 30)}...`)
      } : 'NO SESSION',
      totalQuestions: questions.length
    });
    
    // 新規セッション開始
    if (!session && text !== '') {
      console.log('🆕 Creating new session for user:', userIdShort);
      createSession(userId);
      session = getSession(userId); // 作成直後の状態確認
      console.log('✅ New session created:', {
        currentQuestionIndex: session.currentQuestionIndex,
        answersCount: session.answers.length
      });
      
      setSessionTimeout(userId, lineClient);
      
      // 重複メッセージ修正済み
      await replyMessages(lineClient, event.replyToken, [
        questions[0]  // "ようこそMirrorLoopへ。今日は、どんな出来事が..."
      ]);
      
      console.log('📤 Sent first question');
      return;
    }
    
    // セッション進行中の処理
    if (session && !session.isComplete) {
      console.log('📝 Processing active session response');
      
      setSessionTimeout(userId, lineClient);
      
      // 🚧 分類処理を一時的に無効化（デバッグ用）
      console.log('🔧 CLASSIFICATION TEMPORARILY DISABLED FOR DEBUGGING');
      const classification = "A"; // 強制的にA判定
      
      /* 
      // 分類処理（一時的にコメントアウト）
      let classification = "A";
      
      const inappropriateKeywords = ['死ね', 'バカ', 'アホ', 'くそ', '殺す'];
      const isInappropriate = inappropriateKeywords.some(keyword => 
        text.toLowerCase().includes(keyword.toLowerCase())
      );
      const isTooShort = text.length < 2;
      
      if (isInappropriate || isTooShort) {
        classification = "C";
      } else {
        try {
          classification = await classifyUserResponse(openaiClient, text);
          console.log('🔍 OpenAI Classification result:', classification);
          
          if (classification === "C" && text.length >= 5) {
            console.log('🔧 Overriding C classification to A for substantial response');
            classification = "A";
          }
        } catch (classifyError) {
          console.error('⚠️ Classification error, defaulting to A:', classifyError.message);
          classification = "A";
        }
      }
      */
      
      console.log('🎯 Final classification:', classification);
      
      if (classification === "C") {
        await replyMessages(lineClient, event.replyToken, [
          "もう一度、心を落ち着けて答えてみてください。",
          "どんな小さなことでも構いません。"
        ]);
        return;
      }
      
      if (classification === "B") {
        try {
          const comment = await generateObservationComment(openaiClient, text);
          const qIndex = session.currentQuestionIndex;
          
          await replyMessages(lineClient, event.replyToken, [
            comment,
            questions[qIndex]
          ]);
        } catch (commentError) {
          console.error('⚠️ Comment generation error:', commentError.message);
          await replyMessages(lineClient, event.replyToken, [
            "その気持ち、よくわかります。",
            questions[session.currentQuestionIndex]
          ]);
        }
        return;
      }
      
      // 通常の回答として処理（A）
      console.log('✅ Processing as normal answer (A)');
      console.log('📊 Session BEFORE updateSession:', {
        currentQuestionIndex: session.currentQuestionIndex,
        answersCount: session.answers.length
      });
      
      // セッション更新
      updateSession(userId, text);
      session = getSession(userId); // 更新後の状態取得
      
      console.log('📊 Session AFTER updateSession:', {
        currentQuestionIndex: session.currentQuestionIndex,
        answersCount: session.answers.length,
        lastAnswer: session.answers[session.answers.length - 1]?.substring(0, 50) + '...'
      });
      
      // 🔧 重要：質問数チェックの詳細ログ
      console.log('🔍 Question progress check:', {
        currentIndex: session.currentQuestionIndex,
        totalQuestions: questions.length,
        hasMoreQuestions: session.currentQuestionIndex < questions.length,
        nextQuestionIndex: session.currentQuestionIndex,
        nextQuestion: session.currentQuestionIndex < questions.length ? 
          questions[session.currentQuestionIndex].substring(0, 100) + '...' : 
          'NO MORE QUESTIONS'
      });
      
      if (session.currentQuestionIndex < questions.length) {
        // まだ質問が残っている
        console.log('➡️ Sending next question');
        console.log('📝 Question index:', session.currentQuestionIndex);
        console.log('📝 Question content:', questions[session.currentQuestionIndex]);
        
        await replyMessages(lineClient, event.replyToken, [
          questions[session.currentQuestionIndex]
        ]);
        
        console.log('✅ Next question sent successfully');
      } else {
        // 🎯 全質問完了の処理
        console.log('🎯 === ALL QUESTIONS COMPLETED ===');
        console.log('📊 Final session state:', {
          totalAnswers: session.answers.length,
          expectedAnswers: questions.length,
          answers: session.answers.map((ans, i) => `Q${i+1}: ${ans.substring(0, 30)}...`)
        });
        
        // セッション完了フラグを設定
        session.isComplete = true;
        
        await replyMessages(lineClient, event.replyToken, [
          "ありがとうございます。観照をまとめます…"
        ]);
        
        console.log('📤 Completion message sent');
        
        // 非同期でNotion処理を実行（OpenAI呼び出しを含む）
        console.log('🔄 Starting processSessionAnswers...');
        processSessionAnswers(session.answers, userId, notionClient, openaiClient, lineClient)
          .then(() => {
            console.log('✅ processSessionAnswers completed successfully');
            return pushText(lineClient, userId, "観照セッションが完了しました。また心を見つめたいときにお声がけください。");
          })
          .then(() => {
            console.log('✅ Completion message pushed successfully');
          })
          .catch((error) => {
            console.error('❌ processSessionAnswers error:', error);
            return pushText(lineClient, userId, "処理中にエラーが発生しましたが、あなたの観照は記録されています。");
          });
        
        // セッションクリア
        clearSession(userId);
        clearSessionTimeout(userId);
        console.log('🧹 Session cleared');
      }
      
      console.log('📊 Session state AFTER processing:', {
        hasSession: !!getSession(userId),
        sessionData: getSession(userId)
      });
      
      return;
    }
    
    // セッション完了後またはセッション外のメッセージ処理
    if (session && session.isComplete) {
      console.log('⚠️ Message to completed session - this should not happen after clearSession');
      clearSession(userId);
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
      userId: userIdShort,
      text: text.substring(0, 100)
    });
    
    try {
      await replyMessages(lineClient, event.replyToken, [
        "申し訳ありません。一時的な問題が発生しました。もう一度お試しください。"
      ]);
    } catch (replyError) {
      console.error('❌ Error reply failed:', replyError.message);
    }
  } finally {
    console.log('🔍 === SESSION HANDLER END ===\n');
  }
}

module.exports = { sessionMessageHandler };