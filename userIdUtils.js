// userIdUtils.js - LINE ID匿名化機能
const crypto = require('crypto');

/**
 * LINE User IDを匿名化（ハッシュ化）
 * 同じユーザーIDは常に同じハッシュになるが、元のIDは復元不可能
 */
function anonymizeUserId(lineUserId) {
  // 固定ソルト（本番環境では環境変数から取得推奨）
  const salt = process.env.USER_ID_SALT || 'mirrorloop_anonymize_salt_2025';
  
  const hash = crypto
    .createHash('sha256')
    .update(lineUserId + salt)
    .digest('hex')
    .substring(0, 16); // 16文字に短縮
  
  return `user_${hash}`;
}

/**
 * テストアカウントかどうかを判定
 */
function isTestAccount(lineUserId) {
  const testAccountIds = [
    process.env.TEST_USER_ID_1, // あなたのメインアカウント
    process.env.TEST_USER_ID_2, // 開発用アカウント
  ].filter(Boolean); // undefined除去
  
  return testAccountIds.includes(lineUserId);
}

module.exports = {
  anonymizeUserId,
  isTestAccount
};