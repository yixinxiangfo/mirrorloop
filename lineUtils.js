// lineUtils.js

// ✅ axiosを削除し、lineClientを引数として受け取るように修正
async function replyText(lineClient, replyToken, text) {
  await lineClient.replyMessage(replyToken, { type: 'text', text });
}

async function pushText(lineClient, userId, text) {
  await lineClient.pushMessage(userId, { type: 'text', text });
}

module.exports = { replyText, pushText };