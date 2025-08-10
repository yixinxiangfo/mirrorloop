// index.js
const express = require('express');
const dotenv = require('dotenv');
const line = require('@line/bot-sdk');
const { Client } = require('@notionhq/client');
const { OpenAI } = require('openai');
const { sessionMessageHandler } = require('./sessionMessageHandler');

dotenv.config();

// 環境変数の存在確認（アプリ終了ではなくログ出力のみ）
const requiredEnvVars = [
  'LINE_CHANNEL_ACCESS_TOKEN',
  'LINE_CHANNEL_SECRET',
  'NOTION_TOKEN',
  'OPENAI_API_KEY',
  'NOTION_DATABASE_ID'
];

const missingEnvVars = [];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`⚠️ Missing environment variable: ${envVar}`);
    missingEnvVars.push(envVar);
  }
}

// 重要な環境変数のみチェック（LINE Botの基本動作に必要な分のみ）
const criticalEnvVars = ['LINE_CHANNEL_ACCESS_TOKEN', 'LINE_CHANNEL_SECRET'];
const missingCritical = criticalEnvVars.filter(envVar => !process.env[envVar]);

if (missingCritical.length > 0) {
  console.error(`❌ Critical environment variables missing: ${missingCritical.join(', ')}`);
  console.error('LINE Bot functionality will be disabled');
}

// 各クライアントの安全な初期化
let lineClient = null;
let notionClient = null;
let openaiClient = null;

try {
  if (process.env.LINE_CHANNEL_ACCESS_TOKEN && process.env.LINE_CHANNEL_SECRET) {
    const config = {
      channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
      channelSecret: process.env.LINE_CHANNEL_SECRET
    };
    lineClient = new line.Client(config);
    console.log('✅ LINE client initialized');
  }
} catch (error) {
  console.error('❌ LINE client initialization failed:', error.message);
}

try {
  if (process.env.NOTION_TOKEN) {
    notionClient = new Client({ auth: process.env.NOTION_TOKEN });
    console.log('✅ Notion client initialized');
  }
} catch (error) {
  console.error('❌ Notion client initialization failed:', error.message);
}

try {
  if (process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    console.log('✅ OpenAI client initialized');
  }
} catch (error) {
  console.error('❌ OpenAI client initialization failed:', error.message);
}

const app = express();

// 軽量なKeepAlive専用エンドポイント（cronjob用）
app.get('/keepalive', (req, res) => {
  res.status(200).json({ 
    status: 'alive', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    message: 'MirrorLoop KeepAlive OK'
  });
});

// ヘルスチェック用エンドポイント（軽量化）
app.get('/', (req, res) => {
  res.send('🧘 MirrorLoop is awake');
});

// 詳細ヘルスチェック（デバッグ用）
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    env_check: {
      hasLineToken: !!process.env.LINE_CHANNEL_ACCESS_TOKEN,
      hasLineSecret: !!process.env.LINE_CHANNEL_SECRET,
      hasNotionToken: !!process.env.NOTION_TOKEN,
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      hasNotionDB: !!process.env.NOTION_DATABASE_ID
    },
    clients: {
      lineInitialized: !!lineClient,
      notionInitialized: !!notionClient,
      openaiInitialized: !!openaiClient
    },
    missingEnvVars: missingEnvVars
  });
});

// LINE Webhook用のミドルウェア設定
app.post('/', async (req, res) => {
  // クライアントが初期化されていない場合は早期リターン
  if (!lineClient) {
    console.error('❌ LINE client not initialized');
    return res.sendStatus(200); // LINEには正常応答
  }

  try {
    // LINE署名検証ミドルウェアを手動で実行
    const config = {
      channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
      channelSecret: process.env.LINE_CHANNEL_SECRET
    };
    
    await new Promise((resolve, reject) => {
      line.middleware(config)(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    console.log('📬 Webhook received:', JSON.stringify(req.body, null, 2));
    
    const events = req.body.events || [];
    
    // 各イベントを順次処理
    for (const event of events) {
      try {
        if (event.type === 'message' && event.message.type === 'text') {
          console.log('💬 Processing message:', event.message.text);
          console.log('👤 User ID:', event.source.userId);
          
          // 必要なクライアントが揃っているかチェック
          if (!notionClient || !openaiClient) {
            console.error('❌ Required clients not initialized');
            await lineClient.replyMessage(event.replyToken, {
              type: 'text',
              text: '申し訳ありません。一時的にサービスが利用できません。しばらくしてからお試しください。'
            });
            continue;
          }
          
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
        
        // エラー時はユーザーに通知
        try {
          if (lineClient && event.replyToken) {
            await lineClient.replyMessage(event.replyToken, {
              type: 'text',
              text: '申し訳ありません。処理中にエラーが発生しました。もう一度お試しください。'
            });
          }
        } catch (replyError) {
          console.error('❌ Failed to send error message:', replyError.message);
        }
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
  console.error('❌ Global error handler:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method
  });
  
  if (error instanceof line.SignatureValidationFailed) {
    console.error('❌ LINE Signature validation failed');
    res.status(401).json({ error: 'Signature validation failed' });
  } else if (error instanceof line.JSONParseError) {
    console.error('❌ LINE JSON parse error');
    res.status(400).json({ error: 'JSON parse error' });
  } else {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Renderで指定されたポートを使用
const PORT = process.env.PORT || 10000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📱 LINE Webhook URL: https://mirrorloop.onrender.com/`);
  console.log(`🔄 KeepAlive URL: https://mirrorloop.onrender.com/keepalive`);
  console.log('🔧 Initialization status:', {
    lineClient: !!lineClient,
    notionClient: !!notionClient,
    openaiClient: !!openaiClient,
    missingEnvVars: missingEnvVars.length
  });
  
  if (missingEnvVars.length > 0) {
    console.warn('⚠️ Some features may be limited due to missing environment variables');
  }
});