// index.js

const express = require('express');
const dotenv = require('dotenv');
const line = require('@line/bot-sdk');
const { Client } = require('@notionhq/client');
const { OpenAI } = require('openai');
const { sessionMessageHandler } = require('./sessionMessageHandler');

dotenv.config();

// LINE設定
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

// クライアント初期化
const lineClient = new line.Client(config);
const notionClient = new Client({ auth: process.env.NOTION_TOKEN });
const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const app = express();
app.use(express.json());

// LINE署名検証ミドルウェア
app.post('/', line.middleware(config), async (req, res) => {
  console.log('📬 Webhook received:', JSON.stringify(req.body, null, 2));

  const events = req.body.events || [];

  for (const event of events) {
    // ...（省略）...

    if (event.type === 'message' && event.message.type === 'text') {
      // ✅ こちらに修正
      await sessionMessageHandler(event, notionClient, openaiClient, lineClient);
    }
  }

  res.sendStatus(200); // 即時200応答（LINE仕様）
});

// 動作確認用エンドポイント
app.get('/', (req, res) => {
  res.send('🧘 MirrorLoop is awake');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});