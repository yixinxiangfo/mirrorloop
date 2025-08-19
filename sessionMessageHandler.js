// sessionMessageHandler.js（修正版 - classification処理完全削除）
const { getSession, createSession, updateSession, clearSession } = require('./sessionStore');
const questions = require('./questions');
const { replyMessages, pushText } = require('./lineUtils');
const processSessionAnswers = require('./processSessionAnswers');
const { handleTypebotFlow } = require('./typebotHandler'); // ← 追加

// セッションタイマー管理
const sessionTimeouts = {}; // userId -> timeoutID
const SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15分

function setSessionTimeout(userId, lineClient) {
  if (sessionTimeouts[userId]) {
    clearTimeout(sessionTimeouts[userId]);
  }
  
  sessionTimeouts[userId] = setTimeout(async () => {
    try {
      console.log(`⏰ セッションタイムアウト: ${userId.substring(0, 8)}...`);
      await pushText(lineClient, userId, 
        "観照セッションが完了しました。\n\nまた心を見つめたいときにお声がけください。\n\n🙏 ありがとうございました。"
      );
      clearSession(userId);
      delete sessionTimeouts[userId];
      console.log(`✅ タイムアウト処理完了: ${userId.substring(0, 8)}...`);
    } catch (error) {
      console.error('❌ Session timeout error:', error);
      delete sessionTimeouts[userId]; // エラー時もクリーンアップ
    }
  }, SESSION_TIMEOUT_MS);
  
  console.log(`⏰ セッションタイマー設定: ${userId.substring(0, 8)}... (15分)`);
}

function clearSessionTimeout(userId) {
  if (sessionTimeouts[userId]) {
    clearTimeout(sessionTimeouts[userId]);
    delete sessionTimeouts[userId];
    console.log(`⏹️ セッションタイマー停止: ${userId.substring(0, 8)}...`);
  }
}

// メインのメッセージハンドラー（Typebot統合版）
async function sessionMessageHandler(event, notionClient, openaiClient, lineClient) {
  const USE_TYPEBOT = process.env.USE_TYPEBOT === 'true';
  
  if (USE_TYPEBOT) {
    return await handleTypebotFlow(event, notionClient, openaiClient, lineClient);
  }

  // 以下は既存の処理（Classicモード）
  const userId = event.source.userId;
  const text = event.message.text.trim();
  const userIdShort = userId.substring(0, 8) + '...';
  
  console.log('🔍 === SESSION HANDLER START ===');
  console.log('👤 User:', userIdShort);
  console.log('💬 Input:', text.substring(0, 100));
  
  try {
    let session = getSession(userId);
    
    // セッション状態ログ（簡素化）
    console.log('📊 Session state BEFORE processing:', {
      hasSession: !!session,
      sessionData: session ? {
        currentQuestionIndex: session.currentQuestionIndex,
        answersCount: session.answers.length,
        isComplete: session.isComplete
      } : null,
      totalQuestions: questions.length
    });
    
    // 新規セッション開始
    if (!session && text !== '') {
      console.log('🆕 Creating new session for user:', userIdShort);
      createSession(userId);
      session = getSession(userId);
      console.log('✅ New session created:', {
        currentQuestionIndex: session.currentQuestionIndex,
        answersCount: session.answers.length
      });
      
      // セッションタイマー開始
      setSessionTimeout(userId, lineClient);
      
      await replyMessages(lineClient, event.replyToken, [
        questions[0]  // "ようこそMirrorLoopへ。今日は、どんな出来事が..."
      ]);
      
      console.log('📤 Sent first question');
      return;
    }
    
    // セッション進行中の処理
    if (session && !session.isComplete) {
      console.log('📝 Processing active session response');
      
      // タイマーリセット（ユーザーが回答したため）
      setSessionTimeout(userId, lineClient);
      
      // 🔧 classification処理を完全削除 - すべて通常回答(A)として処理
      console.log('✅ Processing as normal answer (all responses treated as valid)');
      
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
      
      // 質問進行チェック
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
        // 次の質問を送信
        console.log('➡️ Sending next question');
        console.log('📝 Question index:', session.currentQuestionIndex);
        console.log('📝 Question content:', questions[session.currentQuestionIndex]);
        
        await replyMessages(lineClient, event.replyToken, [
          questions[session.currentQuestionIndex]
        ]);
        
        console.log('✅ Next question sent successfully');
      } else {
        // 全質問完了の処理
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
        
        // セッションタイマー停止（観照処理開始のため）
        clearSessionTimeout(userId);
        
        // 非同期で観照処理を実行（完了メッセージは送信しない）
        console.log('🔄 Starting processSessionAnswers...');
        processSessionAnswers(session.answers, userId, notionClient, openaiClient, lineClient)
          .then(() => {
            console.log('✅ processSessionAnswers completed successfully');
          })
          .catch((error) => {
            console.error('❌ processSessionAnswers error:', error);
          });
        
        // セッションクリア
        clearSession(userId);
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
      console.log('⚠️ Message to completed session - clearing session');
      clearSession(userId);
      clearSessionTimeout(userId);
    }
    
    // セッション外からのメッセージ
    console.log('🏠 No active session, showing welcome message');
    await replyMessages(lineClient, event.replyToken, [
      "MIRRORLOOPへようこそ。仏教の唯識をベースにしたAIです。今の自分が見つめたい気持ちや出来事を送っていただくと、問いから自分を見つめる観照セッションが始まります。"
    ]);
    
  } catch (error) {
    console.error('❌ Session handler error:', {
      error: error.message,
      stack: error.stack,
      userId: userIdShort,
      text: text.substring(0, 100)
    });
    
    // エラー時はタイマーもクリーンアップ
    clearSessionTimeout(userId);
    
    try {
      await replyMessages(lineClient, event.replyToken, [
        "申し訳ありません。一時的な問題が発生しました。\n\nもう一度お試しください。"
      ]);
    } catch (replyError) {
      console.error('❌ Error reply failed:', replyError.message);
    }
  } finally {
    console.log('🔍 === SESSION HANDLER END ===');
  }
}

module.exports = { sessionMessageHandler };