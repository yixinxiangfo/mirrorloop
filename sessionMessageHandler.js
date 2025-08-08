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
    // ✅ pushTextにlineClientを正しく渡す
    pushText(lineClient, userId, "MirrorLoopにお越しいただきありがとうございました。また来てくださいね。");
    clearSession(userId);
    delete sessionTimeouts[userId];
  }, SESSION_TIMEOUT_MS);
}

// index.jsからクライアントを受け取る
async function sessionMessageHandler(event, notionClient, openaiClient, lineClient) {
  const userId = event.source.userId;
  const text = event.message.text.trim();

  let session = getSession(userId);

  // 新規入力があったら自動で観照セッション開始
  if (!session && text !== '') {
    createSession(userId);
    setSessionTimeout(userId, lineClient);
    // ✅ replyTextにlineClientを正しく渡す
    await replyText(lineClient, event.replyToken, "ようこそMirrorLoopへ。");
    await replyText(lineClient, event.replyToken, questions[0]);
    return;
  }

  if (session && !session.isComplete) {
    setSessionTimeout(userId, lineClient);

    // ✅ openaiClientを渡す
    const classification = await classifyUserResponse(openaiClient, text);

    if (classification === "C") {
      // ✅ replyTextにlineClientを正しく渡す
      await replyText(lineClient, event.replyToken,
        "今回は、あなたの答えから観照の意図を見つけることができませんでした。\nまた改めて、心を見つめたいときにご利用ください。"
      );
      clearSession(userId);
      clearTimeout(sessionTimeouts[userId]);
      delete sessionTimeouts[userId];
      return;
    }

    if (classification === "B") {
      // ✅ openaiClientとlineClientを渡す
      const comment = await generateObservationComment(openaiClient, text);
      await replyText(lineClient, event.replyToken, comment);
      const qIndex = session.currentQuestionIndex;
      await replyText(lineClient, event.replyToken, questions[qIndex]);
      return;
    }

    // 通常の回答として処理（A）
    updateSession(userId, text);
    session = getSession(userId);

    if (session.currentQuestionIndex < questions.length) {
      await replyText(lineClient, event.replyToken, questions[session.currentQuestionIndex]);
    } else {
      session.isComplete = true;
      await replyText(lineClient, event.replyToken, "ありがとうございます。観照をまとめます…");
      // ✅ notionClientとopenaiClientを渡す
      await processSessionAnswers(session.answers, userId, notionClient, openaiClient);
      clearSession(userId);
      clearTimeout(sessionTimeouts[userId]);
      delete sessionTimeouts[userId];
    }
    return;
  }
  await replyText(lineClient, event.replyToken, "MirrorLoopへようこそ。どんなことでも構いません。まずは感じたことを送ってみてください。");
}

module.exports = { sessionMessageHandler };