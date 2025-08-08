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
    pushText(lineClient, userId, "MirrorLoopにお越しいただきありがとうございました。また来てくださいね。");
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
    // ✅ 引数の順序を修正
    await replyText(lineClient, event.replyToken, "ようこそMirrorLoopへ。");
    await replyText(lineClient, event.replyToken, questions[0]);
    return;
  }

  if (session && !session.isComplete) {
    setSessionTimeout(userId, lineClient); // 各返信ごとにタイマーリセット

    // ✅ 引数の順序を修正
    const classification = await classifyUserResponse(openaiClient, text);

    if (classification === "C") {
      // ✅ 引数の順序を修正
      await replyText(lineClient, event.replyToken,
        "今回は、あなたの答えから観照の意図を見つけることができませんでした。\nまた改めて、心を見つめたいときにご利用ください。"
      );
      clearSession(userId);
      clearTimeout(sessionTimeouts[userId]);
      delete sessionTimeouts[userId];
      return;
    }

    if (classification === "B") {
      // ✅ 引数の順序を修正
      const comment = await generateObservationComment(openaiClient, text);
      await replyText(lineClient, event.replyToken, comment);
      // 直前の質問を再提示
      const qIndex = session.currentQuestionIndex;
      // ✅ 引数の順序を修正
      await replyText(lineClient, event.replyToken, questions[qIndex]);
      return;
    }

    // 通常の回答として処理（A）
    updateSession(userId, text);
    session = getSession(userId);

    if (session.currentQuestionIndex < questions.length) {
      // ✅ 引数の順序を修正
      await replyText(lineClient, event.replyToken, questions[session.currentQuestionIndex]);
    } else {
      session.isComplete = true;
      // ✅ 引数の順序を修正
      await replyText(lineClient, event.replyToken, "ありがとうございます。観照をまとめます…");
      // ✅ NotionとOpenAIクライアントを引数として渡す
      await processSessionAnswers(session.answers, userId, notionClient, openaiClient);
      clearSession(userId);
      clearTimeout(sessionTimeouts[userId]);
      delete sessionTimeouts[userId];
    }
    return;
  }
  // ✅ 引数の順序を修正
  await replyText(lineClient, event.replyToken, "MirrorLoopへようこそ。どんなことでも構いません。まずは感じたことを送ってみてください。");
}

module.exports = { sessionMessageHandler };