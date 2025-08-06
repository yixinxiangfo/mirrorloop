// handleUserMessage.js

const { promptTemplate } = require('./rootDictionary');
const parseGptOutput = require('./parseGptOutput');
// OpenAIクライアントの初期化を削除

/**
 * LINEから受け取ったメッセージを処理し、観照コメントと心所データを返す
 * @param {string} userMessage ユーザー発言
 * @param {string} userId ユーザーID
 * @param {object} openaiClient OpenAIクライアントのインスタンス
 * @returns {Promise<{ comment: string, mindFactors: Array, category: Array }>} 観照コメントと心所データ
 */
async function handleUserMessage(userMessage, userId, openaiClient) {
  const prompt = promptTemplate(userMessage);

  try {
    const completion = await openaiClient.chat.completions.create({
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

    // Notionに保存するための詳細データも返すように変更
    return {
      comment: parsed.comment,
      mindFactors: parsed.mindFactors,
      category: parsed.category
    };

  } catch (error) {
    console.error('handleUserMessageエラー:', error.message);
    if (error.response) {
      console.error('APIレスポンス:', error.response.status, error.response.data);
    }
    return {
      comment: '観照コメントを生成できませんでした。',
      mindFactors: [],
      category: []
    };
  }
}

module.exports = handleUserMessage;