// lineUtils.js

async function replyText(lineClient, replyToken, text) {
  await lineClient.replyMessage(replyToken, { type: 'text', text });
}

async function pushText(lineClient, userId, text) {
  await lineClient.pushMessage(userId, { type: 'text', text });
}

module.exports = { replyText, pushText };