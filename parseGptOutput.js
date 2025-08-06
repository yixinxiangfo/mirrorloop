const { enrichMindFactorsWithRoot } = require('./rootDictionary');

/**
 * GPTからのJSON出力をパースし、心所に根本煩悩情報を付加する関数
 * @param {string} text GPTの出力テキスト
 * @returns {{mindFactors: Array, category: Array, comment: string}} 解析されたデータ
 */
function parseGptOutput(text) {
  try {
    // 前後にノイズが混ざってても { ... } 部分だけ抽出
    const match = text.match(/\{[\s\S]*?\}/);
    const cleanJson = match ? match[0] : '{}';

    const raw = JSON.parse(cleanJson);

    const rawMindFactors = raw["心所"];
    const mindFactorsArray = Array.isArray(rawMindFactors) ? rawMindFactors : [];

    const enriched = enrichMindFactorsWithRoot(mindFactorsArray);

    return {
      mindFactors: enriched,
      category: raw["心所分類"] || [],
      comment: raw["コメント"] || ""
    };
  } catch (e) {
    console.error("GPT出力の解析エラー:", e, "\n元の出力:", text);
    return {
      mindFactors: [],
      category: [],
      comment: "（解析エラー）観照コメントを生成できませんでした。"
    };
  }
}

module.exports = parseGptOutput;