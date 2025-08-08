// sessionMessageHandler.js

const { getSession, createSession, updateSession, clearSession } = require('./sessionStore');
const questions = require('./questions');
const { replyText, pushText } = require('./lineUtils');
const { classifyUserResponse, generateObservationComment } = require('./openaiUtils');
const processSessionAnswers = require('./processSessionAnswers');

// セッションタイマー管理
const sessionTimeouts = {}; // userId -> timeoutID
const SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15分

function setSessionTimeout(userId, lineClient) {
  clearTimeout(sessionTimeouts[userId]);
  sessionTimeouts[userId] = setTimeout(() => {
    pushText(userId, "MirrorLoopにお越しいただきありがとうございました。また来てくださいね。", lineClient);
    clearSession(userId);
    delete sessionTimeouts[userId];
  }, SESSION_TIMEOUT_MS);
}

// index.jsからクライアントを受け取るように引数を追加
async function sessionMessageHandler(event, notionClient, openaiClient, lineClient) {
  const userId = event.source.userId;
  const text = event.message.text.trim();

  let session = getSession(userId);

  // 新規入力があったら自動で観照セッション開始
  if (!session && text !== '') {
    createSession(userId);
    setSessionTimeout(userId, lineClient);
    await replyText(event.replyToken, "ようこそMirrorLoopへ。", lineClient); // ✅ ここを修正
    await replyText(event.replyToken, questions[0], lineClient); // ✅ ここを修正
    return;
  }

  if (session && !session.isComplete) {
    setSessionTimeout(userId, lineClient); // 各返信ごとにタイマーリセット

    const classification = await classifyUserResponse(openaiClient, text);

    if (classification === "C") {
      await replyText(event.replyToken,
        "今回は、あなたの答えから観照の意図を見つけることができませんでした。\nまた改めて、心を見つめたいときにご利用ください。",
        lineClient // ✅ ここを修正
      );
      clearSession(userId);
      clearTimeout(sessionTimeouts[userId]);
      delete sessionTimeouts[userId];
      return;
    }

    if (classification === "B") {
      const comment = await generateObservationComment(openaiClient, text);
      await replyText(event.replyToken, comment, lineClient); // ✅ ここを修正
      // 直前の質問を再提示
      const qIndex = session.currentQuestionIndex;
      await replyText(event.replyToken, questions[qIndex], lineClient); // ✅ ここを修正
      return;
    }

    // 通常の回答として処理（A）
    updateSession(userId, text);
    session = getSession(userId);

    if (session.currentQuestionIndex < questions.length) {
      await replyText(event.replyToken, questions[session.currentQuestionIndex], lineClient); // ✅ ここを修正
    } else {
      session.isComplete = true;
      await replyText(event.replyToken, "ありがとうございます。観照をまとめます…", lineClient); // ✅ ここを修正
      await processSessionAnswers(session.answers, userId, notionClient, openaiClient);
      clearSession(userId);
      clearTimeout(sessionTimeouts[userId]);
      delete sessionTimeouts[userId];
    }
    return;
  }
  await replyText(event.replyToken, "MirrorLoopへようこそ。どんなことでも構いません。まずは感じたことを送ってみてください。", lineClient); // ✅ ここを修正
}

module.exports = { sessionMessageHandler };