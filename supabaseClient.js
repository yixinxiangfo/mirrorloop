// supabaseClient.js
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

// Supabase接続設定
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase環境変数が設定されていません');
  console.error('SUPABASE_URL:', !!supabaseUrl);
  console.error('SUPABASE_ANON_KEY:', !!supabaseKey);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('✅ Supabase client initialized');

// 🔧 修正：直接exportする形式に変更
module.exports = supabase;