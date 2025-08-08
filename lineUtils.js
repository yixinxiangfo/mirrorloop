// lineUtils.js

// const axios = require('axios');
// const LINE_MESSAGING_API = 'https://api.line.me/v2/bot/message';
// const LINE_ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN;

// ➡ `index.js`から受け取ったlineClientを使用するため、上記コードは不要

async function replyText(lineClient, replyToken, text) {
  await lineClient.replyMessage(replyToken, {
    type: 'text',
    text
  });
}

async function pushText(lineClient, userId, text) {
  await lineClient.pushMessage(userId, {
    type: 'text',
    text
  });
}

module.exports = { replyText, pushText };