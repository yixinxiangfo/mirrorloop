// openaiUtils.js
const OpenAI = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function classifyUserResponse(text) {
  const prompt = `
ユーザーの発言を以下の3つに分類してください：
A. 観照問いに対する誠実な回答
B. 観照Botへの相談・逆質問
C. 逸脱・意味不明・ふざけた回答（観照に値しない）

ユーザー発言：「${text}」

→ 回答：A / B / C のいずれかのみを出力してください。
  `;

  const res = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3
  });

  return res.choices[0].message.content.trim();
}

async function generateObservationComment(text) {
  const prompt = `
あなたは仏教的観照Botです。以下のような問い返しに対し、
慰めや励ましではなく、気づきを促す静かな一言を返してください。

ユーザー発言：「${text}」

→ 返信例：
- それは、相手に理解されたいという願いが根底にあるかもしれませんね。
- 「どう言えばよかったか」を探す前に、まず今のあなたの心の動きに目を向けてみましょう。
  `;

  const res = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7
  });

  return res.choices[0].message.content.trim();
}

module.exports = {
  classifyUserResponse,
  generateObservationComment
};
