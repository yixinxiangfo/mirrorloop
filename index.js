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
let supabaseClient = null;
let notionClient = null;

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
try {
  supabaseClient = require('./supabaseClient');
  console.log('✅ Supabase client initialized');
} catch (error) {
  console.error('❌ Supabase client initialization failed:', error.message);
}

// Notionクライアントの初期化確認
try {
  const { Client } = require('@notionhq/client');
  if (process.env.NOTION_TOKEN) {
    notionClient = new Client({ auth: process.env.NOTION_TOKEN });
    console.log('✅ Notion client initialized');
  }
} catch (error) {
  console.error('❌ Notion client initialization failed:', error.message);
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
      hasTestUserId: !!process.env.TEST_USER_ID_1,
      hasNotionToken: !!process.env.NOTION_TOKEN,
    },
    clients: {
      lineInitialized: !!lineClient,
      openaiInitialized: !!openaiClient,
      supabaseInitialized: !!supabaseClient,
      notionInitialized: !!notionClient
    },
    modules: {
      processSessionAnswersLoaded: !!processSessionAnswers
    }
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

// Typebot Webhook エンドポイント（最終修正版）
app.post('/webhook/typebot', async (req, res) => {
  console.log('📪 Typebot Webhook受信:', JSON.stringify(req.body, null, 2));
  
  try {
    let { userId, sessionId, answers, observationResult } = req.body;
    
    // userIdの問題を解決
    if (!userId || userId === "{{userId}}" || userId.includes("{{")) {
      console.warn('⚠️ userId が正しく設定されていません。テストアカウントを使用します');
      userId = process.env.TEST_USER_ID_1 || "demo_user_for_typebot";
    }
    
    // ユーザーIDが存在しない場合でも、`substring`の代わりに`slice`を使用し、エラーを回避
    const shortUserId = (typeof userId === 'string' && userId.length > 8) ? userId.slice(0, 8) + '...' : userId;
    console.log('👤 使用するユーザーID:', shortUserId);
    
    if (!answers || Object.keys(answers).length === 0) {
      throw new Error('観照の回答データが見つかりません');
    }
    
    console.log('📝 観照回答データ:', answers);
    console.log('🎯 TypebotのOpenAI結果:', observationResult);
    
    // 必要なクライアントの確認
    if (!lineClient || !openaiClient) {
      throw new Error('必要なクライアントが初期化されていません');
    }
    
    if (!processSessionAnswers) {
      throw new Error('観照分析機能が利用できません');
    }
    
    // 回答データを配列形式に変換
    const answersArray = [];
    for (let i = 1; i <= 9; i++) {
      const answerKey = `answer${i}`;
      if (answers[answerKey] && answers[answerKey].trim() !== '') {
        answersArray.push(answers[answerKey].trim());
      }
    }
    
    console.log('📄 変換された回答配列:', answersArray);
    
    if (answersArray.length === 0) {
      throw new Error('有効な回答が見つかりませんでした');
    }
    
    // 観照分析実行
    console.log('🧠 観照分析を開始...');
    
    // Notionクライアントを引数に追加
    const analysisResult = await processSessionAnswers(
      answersArray, 
      openaiClient, 
      supabaseClient,
      userId,
      observationResult
    );
    
    console.log('✅ 観照分析完了:', analysisResult);
    
    // 分析結果をLINEで送信（デバッグ強化版）
    try {
      console.log('📱 LINE送信準備中...');
      console.log('📱 送信先ユーザーID:', userId);
      console.log('📱 送信メッセージ長:', analysisResult.comment?.length);
      console.log('📱 LINEクライアント状態:', !!lineClient);
      
      const resultMessage = {
        type: 'text',
        text: analysisResult.comment
      };
      
      const pushResult = await lineClient.pushMessage(userId, resultMessage);
      console.log('📱 LINE送信結果:', pushResult);
      console.log('✅ LINE通知完了 - ユーザー:', shortUserId);
    } catch (lineError) {
      console.error('❌ LINE送信エラー詳細:', {
        message: lineError.message,
        stack: lineError.stack,
        userId: userId,
        hasLineClient: !!lineClient
      });
      throw new Error(`LINE送信に失敗: ${lineError.message}`);
    }
    
    res.json({ 
      success: true, 
      message: '観照分析が正常に完了し、LINEに送信しました',
      sessionId: sessionId,
      analysisResult: {
        processedAnswers: answersArray.length,
        commentSent: true
      }
    });
    
  } catch (error) {
    console.error('❌ Webhook処理エラー:', error);
    
    try {
      if (req.body.userId && lineClient && req.body.userId !== "{{userId}}") {
        await lineClient.pushMessage(req.body.userId, {
          type: 'text',
          text: '申し訳ございません。観照分析中に問題が発生しました。'
        });
      }
    } catch (lineError) {
      console.error('❌ エラー通知送信失敗:', lineError.message);
    }
    
    res.status(500).json({ 
      error: error.message,
      details: 'Webhook処理に失敗しました',
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

// ===== 750時間制限対応追加コード =====
// 以下のコードを既存のindex.jsの最後に追加してください
// （既存のコードは一切変更しません）

console.log('🎯 Adding hackathon-safe usage tracking...');

// 使用量トラッキング（既存機能への影響なし）
let monthlyUsage = {
  hours: 0,
  startDate: new Date(),
  lastKeepAlive: null,
  totalPings: 0
};

function resetMonthlyUsage() {
  const now = new Date();
  const currentMonth = now.getMonth();
  const startMonth = monthlyUsage.startDate.getMonth();
  
  if (currentMonth !== startMonth) {
    const oldUsage = monthlyUsage.hours;
    monthlyUsage = {
      hours: 0,
      startDate: now,
      lastKeepAlive: null,
      totalPings: 0
    };
    console.log(`📅 Monthly usage reset - Previous: ${oldUsage.toFixed(1)}h`);
  }
}

function checkUsageLimit() {
  resetMonthlyUsage();
  
  const HOUR_LIMIT = 700; // 750h - 50h安全マージン
  const remaining = HOUR_LIMIT - monthlyUsage.hours;
  
  let status = 'safe';
  if (remaining <= 0) status = 'exceeded';
  else if (remaining < 48) status = 'warning'; // 2日分未満
  
  return {
    used: monthlyUsage.hours,
    remaining: Math.max(0, remaining),
    limit: HOUR_LIMIT,
    status: status,
    month: new Date().getMonth() + 1
  };
}

// 新しい制限付きKeepAliveエンドポイント（既存の /keepalive は保持）
app.get('/keepalive-limited', (req, res) => {
  const usage = checkUsageLimit();
  const now = new Date();
  const hour = now.getHours();
  
  console.log(`🔍 Limited KeepAlive check - Status: ${usage.status}, Used: ${usage.used.toFixed(1)}h`);
  
  // 制限超過時の対応
  if (usage.status === 'exceeded') {
    console.log('🚫 Usage limit exceeded - Allowing sleep');
    return res.json({
      status: 'sleep-allowed',
      reason: 'Monthly usage limit exceeded',
      usage: usage,
      app: 'openai-free',
      message: 'Switch to Claude版: https://lin.ee/30l9d9x',
      next_reset: getNextMonthDate()
    });
  }
  
  // 警告状態での時間制限（深夜1-6時はスリープ）
  if (usage.status === 'warning' && hour >= 1 && hour <= 6) {
    console.log('⚠️ Warning usage - Sleep during low-traffic hours (1-6 AM)');
    return res.json({
      status: 'sleep-allowed',
      reason: 'Conserving remaining hours during low-traffic period',
      usage: usage,
      app: 'openai-free',
      message: 'Limited hours remaining - sleeping during 1-6 AM'
    });
  }
  
  // 通常のKeepAlive実行
  const hoursToAdd = 0.167; // 10分 = 0.167時間
  monthlyUsage.hours += hoursToAdd;
  monthlyUsage.lastKeepAlive = now;
  monthlyUsage.totalPings += 1;
  
  console.log(`✅ Limited KeepAlive success - Total: ${monthlyUsage.hours.toFixed(1)}h/${usage.limit}h`);
  
  res.json({
    status: 'kept-alive',
    app: 'openai-free',
    usage: usage,
    message: `Active - ${usage.remaining.toFixed(1)}h remaining this month`,
    ping_count: monthlyUsage.totalPings,
    conservation_mode: usage.status === 'warning'
  });
});

// 使用量確認用ダッシュボード
app.get('/usage-dashboard', (req, res) => {
  const usage = checkUsageLimit();
  const now = new Date();
  
  res.json({
    timestamp: now.toISOString(),
    service: 'openai-free-limited',
    monthly_usage: usage,
    daily_projection: {
      current_day: now.getDate(),
      daily_average: (usage.used / now.getDate()).toFixed(2),
      projected_month_total: ((usage.used / now.getDate()) * 30).toFixed(1)
    },
    recommendations: getUsageRecommendations(usage),
    endpoints: {
      original_keepalive: '/keepalive (preserved for hackathon)',
      limited_keepalive: '/keepalive-limited (750h limit)',
      usage_check: '/usage-dashboard'
    }
  });
});

// 推奨事項生成
function getUsageRecommendations(usage) {
  const recommendations = [];
  
  switch (usage.status) {
    case 'exceeded':
      recommendations.push('🚫 OpenAI版は月間制限に達しました');
      recommendations.push('🤖 Claude版をご利用ください: https://lin.ee/30l9d9x');
      recommendations.push('📅 来月1日に自動リセットされます');
      break;
    case 'warning':
      recommendations.push('⚠️ 残り時間が少なくなっています');
      recommendations.push('🌙 深夜1-6時は節約モードです');
      recommendations.push('🤖 Claude版の併用を推奨します');
      break;
    case 'safe':
      recommendations.push('✅ 正常稼働中です');
      recommendations.push('📊 使用量は制限内に収まっています');
      break;
  }
  
  return recommendations;
}

// 来月1日の日付取得
function getNextMonthDate() {
  const next = new Date();
  next.setMonth(next.getMonth() + 1);
  next.setDate(1);
  next.setHours(0, 0, 0, 0);
  return next.toISOString().slice(0, 10);
}

// サービス状態比較（両版の状況）
app.get('/service-comparison', (req, res) => {
  const usage = checkUsageLimit();
  
  res.json({
    timestamp: new Date().toISOString(),
    services: {
      openai_original: {
        endpoint: '/keepalive',
        status: 'preserved-for-hackathon',
        url: 'https://lin.ee/DetEqmc',
        description: 'Original endpoint maintained for hackathon stability'
      },
      openai_limited: {
        endpoint: '/keepalive-limited',
        status: usage.status,
        available: usage.status !== 'exceeded',
        remaining_hours: usage.remaining.toFixed(1),
        description: '750h monthly limit with smart conservation'
      },
      claude_unlimited: {
        endpoint: '/keepalive',
        status: 'unlimited',
        available: true,
        url: 'https://lin.ee/30l9d9x',
        description: 'Render Pro - 24/7 availability'
      }
    },
    current_recommendation: usage.status === 'exceeded' ? 'claude_unlimited' : 'both_available'
  });
});

console.log('✅ Hackathon-safe usage tracking added successfully');
console.log('📍 Original /keepalive endpoint preserved');
console.log('📍 New /keepalive-limited endpoint ready');
console.log('📊 Usage dashboard available at /usage-dashboard');
