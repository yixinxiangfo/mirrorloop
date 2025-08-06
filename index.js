// index.js

const express = require('express');
const { Client } = require('@notionhq/client');
const dotenv = require('dotenv');
const OpenAI = require("openai");
const line = require('@line/bot-sdk');
const handleUserMessage = require('./handleUserMessage');

dotenv.config();

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new line.Client(config);
const app = express();
app.use(express.json());

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Webhook受信エンドポイント
app.post('/', (req, res) => {
  console.log('📬 Webhook received:', JSON.stringify(req.body, null, 2));

  const events = req.body.events || [];

  for (const event of events) {
    processEvent(event).catch(err =>
      console.error('❌ 非同期処理エラー:', err)
    );
  }

  // LINEの仕様に従い、即時レスポンス
  res.sendStatus(200);
});

// イベントごとの非同期処理本体
async function processEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') return;

  const text = event.message.text;
  const userId = event.source.userId;
  const replyToken = event.replyToken;
  const receivedTimestamp = new Date(event.timestamp).toISOString();

  // openaiクライアントを引数として渡す
  const response = await handleUserMessage(text, userId, openai);

  // LINEに観照コメントを返信
  await client.replyMessage(replyToken, {
    type: 'text',
    text: response.comment
  });

  // Notionに記録するプロパティ構築
  const notionProperties = {
    "名前": {
      title: [{ text: { content: text } }]
    },
    "タイムスタンプ": {
      date: { start: receivedTimestamp }
    },
    "心所ラベル": {
      multi_select: response.mindFactors.map(f => ({ name: f.name }))
    },
    "三毒": {
      multi_select: Array.from(new Set(response.mindFactors.flatMap(f => f.root))).map(r => ({ name: r }))
    },
    "心所分類": {
      multi_select: response.category.map(tag => ({ name: tag }))
    },
    "心所コメント": {
      rich_text: [{ text: { content: response.comment } }]
    }
  };

  try {
    await notion.pages.create({
      parent: { database_id: process.env.NOTION_DATABASE_ID },
      properties: notionProperties,
    });
    console.log('✅ Notion に書き込み完了:', text);
  } catch (error) {
    console.error('❌ Notion 書き込みエラー:', error);
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});