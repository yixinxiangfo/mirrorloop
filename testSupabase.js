const supabase = require('./supabaseClient');

async function testConnection() {
  try {
    console.log('🔍 Testing Supabase connection...');
    
    // テストデータを挿入
    const { data, error } = await supabase
      .from('mind_observations')
      .insert({
        line_user_id: 'test_user',
        message_content: 'テストメッセージ',
        mind_factors: ['貪', '瞋'],
        mind_categories: ['根本煩悩'],
        observation_comment: 'テスト観照コメント',
        three_poisons: ['貪', '瞋']
      });

    if (error) {
      console.error('❌ Error:', error);
    } else {
      console.log('✅ Success:', data);
    }
  } catch (err) {
    console.error('❌ Connection failed:', err);
  }
}

testConnection();