// lineUtils.js
const axios = require('axios');

const LINE_MESSAGING_API = 'https://api.line.me/v2/bot/message';
const LINE_ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN;

async function replyText(replyToken, text) {
  await axios.post(`${LINE_MESSAGING_API}/reply`, {
    replyToken,
    messages: [{ type: 'text', text }]
  }, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`
    }
  });
}

async function pushText(userId, text) {
  await axios.post(`${LINE_MESSAGING_API}/push`, {
    to: userId,
    messages: [{ type: 'text', text }]
  }, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`
    }
  });
}

module.exports = { replyText, pushText };
