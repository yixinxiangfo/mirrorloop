// index.js
const express = require('express');
const dotenv = require('dotenv');
const line = require('@line/bot-sdk');
const { Client } = require('@notionhq/client');
const { OpenAI } = require('openai');
const { sessionMessageHandler } = require('./sessionMessageHandler');

dotenv.config();

// 環境変数の存在確認
const requiredEnvVars = [
  'LINE_CHANNEL_ACCESS_TOKEN',
  'LINE_CHANNEL_SECRET',
  'NOTION_TOKEN',
  'OPENAI_API_KEY',
  'NOTION_DATABASE_ID'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// LINE設定
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

// 各クライアントの初期化
const lineClient = new line.Client(config);
const notionClient = new Client({ auth: process.env.NOTION_TOKEN });
const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const app = express();

// ヘルスチェック用エンドポイント
app.get('/', (req, res) => {
  res.send('🧘 MirrorLoop is awake');
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    env_check: {
      hasLineToken: !!process.env.LINE_CHANNEL_ACCESS_TOKEN,
      hasLineSecret: !!process.env.LINE_CHANNEL_SECRET,
      hasNotionToken: !!process.env.NOTION_TOKEN,
      hasOpenAIKey: !!process.env.OPENAI_API_KEY
    }
  });
});

// LINE Webhook用のミドルウェア設定
app.post('/', line.middleware(config), async (req, res) => {
  try {
    console.log('📬 Webhook received:', JSON.stringify(req.body, null, 2));
    
    const events = req.body.events || [];
    
    // 各イベントを順次処理
    for (const event of events) {
      try {
        if (event.type === 'message' && event.message.type === 'text') {
          console.log('💬 Processing message:', event.message.text);
          console.log('👤 User ID:', event.source.userId);
          
          // セッションメッセージハンドラーを呼び出し
          await sessionMessageHandler(event, notionClient, openaiClient, lineClient);
          
          console.log('✅ Message processed successfully');
        } else {
          console.log('ℹ️ Skipping non-text message:', event.type);
        }
      } catch (eventError) {
        console.error('❌ Error processing individual event:', {
          error: eventError.message,
          stack: eventError.stack,
          eventType: event.type,
          userId: event.source?.userId
        });
        // 個別のイベント処理エラーでも全体を止めない
      }
    }
    
    // LINE Webhookには必ず200を返す
    res.sendStatus(200);
    
  } catch (error) {
    console.error('❌ Webhook processing error:', {
      error: error.message,
      stack: error.stack
    });
    
    // エラーが発生してもLINEには200を返す（重要）
    res.sendStatus(200);
  }
});

// エラーハンドリングミドルウェア
app.use((error, req, res, next) => {
  if (error instanceof line.SignatureValidationFailed) {
    console.error('❌ LINE Signature validation failed:', {
      error: error.message,
      headers: req.headers,
      body: req.body
    });
    res.status(401).json({ error: 'Signature validation failed' });
  } else if (error instanceof line.JSONParseError) {
    console.error('❌ LINE JSON parse error:', error.message);
    res.status(400).json({ error: 'JSON parse error' });
  } else {
    console.error('❌ Unexpected error:', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Renderで指定されたポートを使用
const PORT = process.env.PORT || 10000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📱 LINE Webhook URL: https://your-app-name.onrender.com/`);
  console.log('🔧 Environment check:', {
    hasLineToken: !!process.env.LINE_CHANNEL_ACCESS_TOKEN,
    hasLineSecret: !!process.env.LINE_CHANNEL_SECRET,
    hasNotionToken: !!process.env.NOTION_TOKEN,
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    hasNotionDB: !!process.env.NOTION_DATABASE_ID
  });
});