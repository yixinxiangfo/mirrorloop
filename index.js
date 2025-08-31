// index.js
const express = require('express');
const dotenv = require('dotenv');
const line = require('@line/bot-sdk');
const { OpenAI } = require('openai');
const { sessionMessageHandler } = require('./sessionMessageHandler');

dotenv.config();

// processSessionAnswers の安全な読み込み
let processSessionAnswers = null;
try {
  processSessionAnswers = require('./processSessionAnswers');
  console.log('✅ processSessionAnswers loaded successfully');
} catch (error) {
  console.error('❌ processSessionAnswers loading failed:', error.message);
  processSessionAnswers = null;
}

// 環境変数の存在確認（アプリ終了ではなくログ出力のみ）
const requiredEnvVars = [
  'LINE_CHANNEL_ACCESS_TOKEN',
  'LINE_CHANNEL_SECRET',
  'OPENAI_API_KEY',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'TEST_USER_ID_1' // デモ用固定IDを追加
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
  if (process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    console.log('✅ OpenAI client initialized');
  }
} catch (error) {
  console.error('❌ OpenAI client initialization failed:', error.message);
}

// Supabaseクライアントの初期化確認
let supabaseClient = null;
try {
  supabaseClient = require('./supabaseClient');
  console.log('✅ Supabase client initialized');
} catch (error) {
  console.error('❌ Supabase client initialization failed:', error.message);
}

const app = express();

// JSONパーサーの設定（LINE Webhook以外のエンドポイント用）
app.use('/webhook', express.json());
app.use('/webhook', express.urlencoded({ extended: true }));

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
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      hasSupabaseUrl: !!process.env.SUPABASE_URL,
      hasSupabaseKey: !!process.env.SUPABASE_ANON_KEY,
      hasTestUserId: !!process.env.TEST_USER_ID_1
    },
    clients: {
      lineInitialized: !!lineClient,
      openaiInitialized: !!openaiClient,
      supabaseInitialized: !!supabaseClient
    },
    missingEnvVars: missingEnvVars,
    webhookModule: !!processSessionAnswers
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
          if (!openaiClient) {
            console.error('❌ Required clients not initialized');
            await lineClient.replyMessage(event.replyToken, {
              type: 'text',
              text: '申し訳ありません。一時的にサービスが利用できません。しばらくしてからお試しください。'
            });
            continue;
          }
          
          // セッションメッセージハンドラーを呼び出し（Notion削除）
          await sessionMessageHandler(event, null, openaiClient, lineClient);
          
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

// Typebot Webhook エンドポイント（userId問題対応版）
app.post('/webhook/typebot', async (req, res) => {
  console.log('📪 Typebot Webhook受信:', JSON.stringify(req.body, null, 2));
  
  try {
    let { userId, sessionId, answers, observationResult } = req.body;
    
    // userIdの問題を解決: {{userId}}のまま送信されている場合の対処
    if (!userId || userId === "{{userId}}" || userId.includes("{{")) {
      console.warn('⚠️ userId が正しく設定されていません。デモ用の固定IDを使用します');
      userId = process.env.TEST_USER_ID_1 || "demo_user_for_typebot"; // テストアカウントを使用
    }
    
    console.log('👤 使用するユーザーID:', userId.substring(0, 8) + '...');
    
    if (!answers || Object.keys(answers).length === 0) {
      throw new Error('観照の回答データが見つかりません');
    }
    
    console.log('📝 観照回答データ:', answers);
    console.log('🎯 TypebotのOpenAI結果:', observationResult);
    
    // 既存のコードと同じ...
    const answersArray = [];
    for (let i = 1; i <= 9; i++) {
      const answerKey = `answer${i}`;
      if (answers[answerKey] && answers[answerKey].trim() !== '') {
        answersArray.push(answers[answerKey].trim());
      }
    }
    
    if (!processSessionAnswers) {
      throw new Error('観照分析機能が利用できません');
    }
    
    const analysisResult = await processSessionAnswers(
      answersArray, 
      openaiClient, 
      supabaseClient, // supabaseClientを追加
      userId,
      observationResult
    );
    
    console.log('✅ 観照分析完了:', analysisResult);
    
    // LINEには送信せず、ログのみ（デモ対応）
    console.log('📱 分析結果（デモモード）:', analysisResult.comment);
    
    res.json({ 
      success: true, 
      message: '観照分析が正常に完了しました（デモモード）',
      sessionId: sessionId,
      analysisResult: analysisResult
    });
    
  } catch (error) {
    console.error('❌ Webhook処理エラー:', error);
    res.status(500).json({ 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// デバッグ用エンドポイント
app.post('/webhook/typebot/test', async (req, res) => {
  console.log('🧪 テスト用Webhook受信:', req.body);
  
  res.json({ 
    message: 'テスト成功 - MIRRORLOOPは正常に動作しています',
    received: req.body,
    timestamp: new Date().toISOString(),
    server: 'Render',
    project: 'MIRRORLOOP',
    processSessionAnswersAvailable: !!processSessionAnswers
  });
});

// Webhook健全性チェック
app.get('/webhook/typebot/health', (req, res) => {
  res.json({
    status: '✅ HEALTHY',
    project: 'MIRRORLOOP',
    endpoint: '/webhook/typebot',
    message: '観照AIは正常に動作中です',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production',
    clients: {
      lineInitialized: !!lineClient,
      openaiInitialized: !!openaiClient,
      supabaseInitialized: !!supabaseClient
    },
    modules: {
      processSessionAnswersLoaded: !!processSessionAnswers
    }
  });
});

// Renderで指定されたポートを使用
const PORT = process.env.PORT || 10000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📱 LINE Webhook URL: https://mirrorloop.onrender.com/`);
  console.log(`📄 KeepAlive URL: https://mirrorloop.onrender.com/keepalive`);
  console.log(`📪 Typebot Webhook URL: https://mirrorloop.onrender.com/webhook/typebot`);
  console.log('🔧 Initialization status:', {
    lineClient: !!lineClient,
    openaiClient: !!openaiClient,
    supabaseClient: !!supabaseClient,
    missingEnvVars: missingEnvVars.length,
    webhookModule: !!processSessionAnswers
  });
  
  if (missingEnvVars.length > 0) {
    console.warn('⚠️ Some features may be limited due to missing environment variables');
  }
  
  if (!processSessionAnswers) {
    console.warn('⚠️ Webhook analysis feature disabled due to module loading error');
  }
});
