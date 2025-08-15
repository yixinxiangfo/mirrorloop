// usageLimiter.js
const supabase = require('./supabaseClient');

/**
 * ユーザーが今日新しいセッションを開始できるかチェック
 * @param {string} lineUserId - LINEユーザーID
 * @returns {Promise<boolean>} - 開始可能ならtrue
 */
async function canStartNewSession(lineUserId) {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD形式
    
    console.log('🔍 Checking usage limit for user:', lineUserId.substring(0, 8) + '...');
    console.log('📅 Today:', today);
    
    // 今日の利用状況を取得
    const { data, error } = await supabase
      .from('daily_usage')
      .select('session_count')
      .eq('line_user_id', lineUserId)
      .eq('usage_date', today)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = データが見つからない
      console.error('❌ Database query error:', error);
      return true; // エラー時は利用を許可（安全側に倒す）
    }
    
    if (!data) {
      // 今日初回利用
      console.log('✅ First time today - session allowed');
      return true;
    }
    
    const currentCount = data.session_count || 0;
    const canStart = currentCount < 1; // 1日1回制限
    
    console.log('📊 Current usage:', {
      sessionCount: currentCount,
      canStart: canStart
    });
    
    return canStart;
    
  } catch (error) {
    console.error('❌ canStartNewSession error:', error);
    return true; // エラー時は利用を許可
  }
}

/**
 * ユーザーの利用回数を記録・更新
 * @param {string} lineUserId - LINEユーザーID
 * @returns {Promise<boolean>} - 記録成功ならtrue
 */
async function recordSessionUsage(lineUserId) {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    console.log('📝 Recording session usage for user:', lineUserId.substring(0, 8) + '...');
    
    // UPSERT（存在すればUPDATE、なければINSERT）
    const { data, error } = await supabase
      .from('daily_usage')
      .upsert({
        line_user_id: lineUserId,
        usage_date: today,
        session_count: 1
      }, {
        onConflict: 'line_user_id,usage_date'
      })
      .select();
    
    if (error) {
      console.error('❌ Failed to record usage:', error);
      return false;
    }
    
    console.log('✅ Usage recorded successfully');
    return true;
    
  } catch (error) {
    console.error('❌ recordSessionUsage error:', error);
    return false;
  }
}

/**
 * 利用制限に達した時のメッセージ
 * @returns {string} - 制限メッセージ
 */
function getLimitReachedMessage() {
  return `今日の観照セッションは既に完了しています。

心を見つめる時間は、量よりも質が大切です。
今日得た気づきを大切にして、明日また新たな観照の時間をお過ごしください。

継続的な観照により、より深い洞察が得られるでしょう。`;
}

module.exports = {
  canStartNewSession,
  recordSessionUsage,
  getLimitReachedMessage
};