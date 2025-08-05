const { enrichMindFactorsWithRoot } = require('./rootDictionary');

/**
 * GPTからのJSON出力をパースし、心所に根本煩悩情報を付加する関数
 * @param {string} text GPTの出力テキスト
 * @returns {{mindFactors: Array, category: Array, comment: string}} 解析されたデータ
 */
function parseGptOutput(text) {
  try {
    const raw = JSON.parse(text);

    const rawMindFactors = raw["心所"];

    // GPTの出力が配列であることを確認し、そうでない場合は空の配列をデフォルト値とする
    const mindFactorsArray = Array.isArray(rawMindFactors) ? rawMindFactors : [];

    // 三毒 root を追加
    const enriched = enrichMindFactorsWithRoot(mindFactorsArray);

    return {
      mindFactors: enriched, // [{ name: "嫉", root: ["瞋"] }, ...]
      category: raw["心所分類"] || [],
      comment: raw["コメント"] || ""
    };
  } catch (e) {
    console.error("GPT出力の解析エラー:", e);
    return {
      mindFactors: [],
      category: [],
      comment: "（解析エラー）観照コメントを生成できませんでした。"
    };
  }
}

module.exports = parseGptOutput;