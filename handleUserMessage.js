const { promptTemplate } = require('./rootDictionary');
const parseGptOutput = require('./parseGptOutput');

const { OpenAI } = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * LINEから受け取ったメッセージを処理し、観照コメントを返す
 * @param {string} userMessage ユーザー発言
 * @param {string} userId ユーザーID（Notion保存などに使用）
 * @returns {Promise<{ comment: string }>} 観照コメント
 */
async function handleUserMessage(userMessage, userId) {
  // ユーザーメッセージを組み込んでプロンプトを生成
  const prompt = promptTemplate(userMessage);

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7
    });

    const gptReply = completion.choices[0].message.content;
    const parsed = parseGptOutput(gptReply);

    // ← 後で Notion 保存追加するポイント

    return { comment: parsed.comment };
  } catch (error) {
    // エラーメッセージをより具体的にログ出力
    console.error('handleUserMessageエラー:', error.message);
    if (error.response) {
      console.error('APIレスポンス:', error.response.status, error.response.data);
    }
    return { comment: '観照コメントを生成できませんでした。' };
  }
}

module.exports = handleUserMessage;