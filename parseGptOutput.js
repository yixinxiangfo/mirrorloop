const { enrichMindFactorsWithRoot } = require('./rootDictionary');

/**
 * GPTからのJSON出力をパースし、心所に根本煩悩情報を付加する関数
 * @param {string} text GPTの出力テキスト
 * @returns {{mindFactors: Array, category: Array, comment: string}} 解析されたデータ
 */
function parseGptOutput(text) {
  try {
    // 🔍 デバッグ: 生のGPT出力を確認
    console.log("=== DEBUG: GPT生出力 ===");
    console.log(text);
    console.log("========================");

    // 前後にノイズが混ざってても { ... } 部分だけ抽出
    const match = text.match(/\{[\s\S]*?\}/);
    const cleanJson = match ? match[0] : '{}';

    // 🔍 デバッグ: 抽出されたJSON部分を確認
    console.log("=== DEBUG: 抽出JSON ===");
    console.log(cleanJson);
    console.log("======================");

    const raw = JSON.parse(cleanJson);

    // 🔍 デバッグ: パース後のrawデータを確認
    console.log("=== DEBUG: パース後 ===");
    console.log("心所:", raw["心所"]);
    console.log("心所分類:", raw["心所分類"]);
    console.log("コメント:", raw["コメント"]);
    console.log("=====================");

    const rawMindFactors = raw["心所"];
    const mindFactorsArray = Array.isArray(rawMindFactors) ? rawMindFactors : [];

    const enriched = enrichMindFactorsWithRoot(mindFactorsArray);

    // 🔍 デバッグ: enriched後のデータを確認
    console.log("=== DEBUG: enriched後 ===");
    console.log(enriched);
    console.log("========================");

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