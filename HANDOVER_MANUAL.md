
# MIRRORLOOP プロジェクト引き継ぎ完全マニュアル

## 🚨 【最重要】既存機能の保護

### 絶対に変更してはいけない核心機能
- **9つの問いワークフロー**: questions.js → sessionMessageHandler.js
- **LINEメッセージ受信 → 観照セッション開始の流れ**
- **index.jsのメッセージ処理ロジック**
- **sessionMessageHandler.jsの状態管理**

### ⚠️ 変更時の鉄則
```
❌ やってはいけないこと
- index.js の全面書き換え
- sessionMessageHandler.js の動作変更
- 既存ワークフローへの分岐追加
- "通常発言処理" などの新概念追加

✅ 安全な変更方法
- 保存部分のみの変更（Notion→Supabase等）
- 新機能は新しいファイルで実装
- 部分修正のみ（全面書き換え禁止）
```

---

## 📋 プロジェクト概要（再確認）

### 基本仕様
**仏教唯識思想に基づいた自己観照アプリケーション**
- LINE Bot・Supabase・OpenAI API 連携
- ユーザーの発言を唯識の五十一心所でラベリング・分析
- 観照コメントを返す

### 核心的な動作フロー
```
1. LINEでメッセージ受信
   ↓
2. 「MIRRORLOOPへようこそ」表示
   ↓  
3. 9つの問い順次投げかけ（questions.js）
   ↓
4. sessionMessageHandler.js で各回答処理
   ↓
5. 心所分析・観照コメント生成
   ↓
6. データベース保存（現在：Supabase）
   ↓
7. 週次レポート配信
```

---

## 📁 ファイル構造と役割

### 🚨 コア機能（変更厳禁）
```
index.js                    # LINE Webhook処理・メッセージルーティング
sessionMessageHandler.js   # 9つの問いワークフロー制御・セッション管理
questions.js               # 問いの内容定義
```

### 🛠️ サポート機能（変更可能）
```
rootDictionary.js          # 51心所マスターデータ・プロンプトテンプレート
parseGptOutput.js          # GPT出力解析・JSON解析
enrichMindFactorsWithRoot.js # 心所から三毒変換
supabaseClient.js          # DB接続設定
processSessionAnswers.js   # セッション回答処理
```

### 🔧 設定・管理
```
.env                       # 環境変数
package.json              # 依存関係
usageLimiter.js           # API使用制限
```

---

## 🎯 現在地とロードマップ

### 完了済み
- ✅ 9つの問いワークフロー（core機能）
- ✅ 心所分析・観照コメント生成
- ✅ Supabase移行（セッション保存）

### 今後予定
- 📊 週次レポート機能
- 🎨 六道キャラクター化
- 💰 有料化対応
- 📈 可視化・分析機能

---

## 🔧 安全な変更手順

### 1. 変更前の必須確認
```bash
# 現在の動作確認
# LINE Botに何かメッセージを送り、9つの問いが正常に動作するか

# 変更対象ファイルの特定
grep -r "変更したい機能" . --include="*.js"
```

### 2. 変更の原則
- **部分修正のみ**: 全面書き換え禁止
- **新機能は新ファイル**: 既存ファイルに機能追加禁止
- **保存処理のみ変更可**: ワークフロー変更禁止

### 3. テストとデプロイ
```bash
# ローカルテスト
npm start
# 9つの問いが完全に動作することを確認後デプロイ

# デプロイ
git add .
git commit -m "明確な変更内容"
git push origin main
```

---

## 💬 AI引き継ぎ時の定型文

### ChatGPT/Claude への最初の指示

```
このプロジェクトの引き継ぎです。

【絶対に変更禁止】
- 9つの問いワークフロー（core機能）
- index.js の既存メッセージ処理
- sessionMessageHandler.js の動作
- LINE受信→9つの問い開始の流れ

【現在の正常な動作】
LINE受信 → 「MIRRORLOOPへようこそ」→ 9つの問い → 心所分析 → 観照コメント → Supabase保存

【変更要求】
[具体的な変更内容のみを記載]

【制約】
- 既存機能を壊さない部分修正のみ
- 新機能は新ファイルで実装
- コア機能の動作確認必須
- 全面書き換え禁止

質問：○○の部分を変更したいが、どのファイルのどの部分を変更すれば安全か？
```

---

## 🚨 緊急時の復旧手順

### Git復旧コマンド
```bash
# コミット履歴確認
git log --oneline -10

# 正常だった状態に戻す
git reset --hard [正常だったコミットハッシュ]
git push --force origin main

# 動作確認：9つの問いが正常に動作するか
```

### 復旧確認チェックリスト
- [ ] LINE Botにメッセージ送信
- [ ] 「MIRRORLOOPへようこそ」表示
- [ ] 9つの問いが順次表示
- [ ] 観照コメント生成
- [ ] Supabase保存確認

---

## 📊 環境変数一覧

### 必須環境変数
```
LINE_CHANNEL_ACCESS_TOKEN    # LINE Bot認証
LINE_CHANNEL_SECRET         # LINE Bot署名検証
OPENAI_API_KEY             # GPT-4 API
SUPABASE_URL               # Supabase接続URL
SUPABASE_ANON_KEY          # Supabase認証キー
```

### 旧環境変数（移行中）
```
NOTION_TOKEN               # Notion API（段階的廃止予定）
NOTION_DATABASE_ID         # Notion DB（段階的廃止予定）
```

---

## 🔍 トラブルシューティング

### よくある問題

#### 1. 「サービスが使えない」
```bash
# Renderログ確認
# supabaseClient: false → 環境変数未設定
# openaiClient: false → API Key未設定
```

#### 2. 「9つの問いが動かない」
```bash
# sessionMessageHandler.js 確認
# questions.js 確認
# index.js のルーティング確認
```

#### 3. 「保存されない」
```bash
# supabaseClient.js 確認
# テーブル構造確認（mind_observations）
```

---

## 📝 変更履歴テンプレート

### コミットメッセージ規則
```
✅ 安全な変更: "保存処理のSupabase対応"
❌ 危険な変更: "メッセージ処理の全面リファクタリング"

推奨形式:
- "Supabase保存処理修正"
- "週次レポート機能追加"
- "心所分析精度向上"
```

---

## 🎯 次回変更時のチェックリスト

### 変更前
- [ ] 既存の9つの問いワークフローの理解
- [ ] 変更対象ファイルの特定
- [ ] 部分修正か全面書き換えかの判断
- [ ] コア機能への影響評価

### 変更中
- [ ] 既存コードの保持
- [ ] 新機能は新ファイルで実装
- [ ] 段階的な変更とテスト

### 変更後
- [ ] ローカルでの9つの問い動作確認
- [ ] デプロイ後の動作確認
- [ ] Supabase保存確認

---

## 🔒 このドキュメントの重要性

**このマニュアルは、MIRRORLOOPプロジェクトの核心機能を保護し、安全な開発継続を保証するものです。**

- 新しい開発者・AI との協業時は必ずこのドキュメントを共有
- 変更前には必ずこのマニュアルに従った安全性確認を実施
- 核心機能の保護を最優先に開発を進行

**破壊的変更を防ぎ、プロジェクトの持続的発展を実現します。**
