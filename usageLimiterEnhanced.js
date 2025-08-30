// usageLimiterEnhanced.js - 使用制限機能（テストアカウント除外）
const { isTestAccount } = require('./userIdUtils');

/**
 * ユーザーの使用制限チェック
 * テストアカウントは無制限、一般ユーザーは1日1回
 */
async function checkUsageLimit(lineUserId, supabase) {
  // テストアカウントは制限なし
  if (isTestAccount(lineUserId)) {
    console.log('✅ Test account detected - unlimited usage allowed');
    return { allowed: true, isTestAccount: true };
  }
  
  if (!supabase) {
    console.warn('⚠️ Supabase not available - allowing usage');
    return { allowed: true, reason: 'database_unavailable' };
  }
  
  try {
    // 今日の使用回数チェック
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { data, error } = await supabase
      .from('mind_observations')
      .select('id')
      .eq('line_user_id', lineUserId)
      .gte('created_at', today.toISOString())
      .eq('session_type', 'typebot_contemplation');
    
    if (error) {
      console.error('❌ Usage limit check failed:', error);
      return { allowed: true, reason: 'check_failed' };
    }
    
    const usageCount = data?.length || 0;
    const limit = 1; // 1日1回制限
    
    console.log(`📊 Usage check - User: ${lineUserId.substring(0, 8)}..., Today's usage: ${usageCount}/${limit}`);
    
    if (usageCount >= limit) {
      return { 
        allowed: false, 
        usageCount, 
        limit,
        message: '今日の観照セッションは既に完了しています。明日また心の観察をしてみてください。'
      };
    }
    
    return { allowed: true, usageCount, limit };
    
  } catch (error) {
    console.error('❌ Usage limit check error:', error);
    return { allowed: true, reason: 'error_fallback' };
  }
}

/**
 * セッション前の制限チェック統合
 */
async function validateSessionAccess(lineUserId) {
  const supabase = require('./supabaseClient');
  
  const limitResult = await checkUsageLimit(lineUserId, supabase);
  
  if (!limitResult.allowed) {
    return {
      canProceed: false,
      message: limitResult.message,
      isTestAccount: false
    };
  }
  
  return {
    canProceed: true,
    isTestAccount: limitResult.isTestAccount || false,
    usageInfo: `使用回数: ${limitResult.usageCount || 0}/${limitResult.limit || 1}`
  };
}

module.exports = {
  checkUsageLimit,
  validateSessionAccess
};