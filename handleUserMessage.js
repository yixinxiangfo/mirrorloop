// handleUserMessage.js

const { promptTemplate } = require('./rootDictionary');
const parseGptOutput = require('./parseGptOutput');

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
    console.log('GPTからのRaw応答:', gptReply); // <<< この行を追加
    const parsed = parseGptOutput(gptReply);

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