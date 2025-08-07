// enrichMindFactorsWithRoot.js

const rootDictionary = require('./rootDictionary');

/**
 * GPTからの出力（例: [{ name: "無慚" }, { name: "忿" }]）に対して、
 * rootDictionaryに基づいて三毒（貪・瞋・痴）を付加する
 */
function enrichMindFactorsWithRoot(mindFactors) {
  if (!Array.isArray(mindFactors)) return [];

  return mindFactors.map(factor => {
    const name = factor.name;
    const root = rootDictionary[name] || [];
    return {
      ...factor,
      root: root
    };
  });
}

module.exports = enrichMindFactorsWithRoot;
