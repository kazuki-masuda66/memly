# Vercel Deployment Setup Guide

## 環境変数の設定

Vercelにデプロイする際に、以下の環境変数を設定する必要があります。Vercelのダッシュボードの「Project Settings」→「Environment Variables」で設定してください。

```
# Supabaseの設定
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# 本番環境のURL（重要）
NEXT_PUBLIC_SITE_URL=https://your-vercel-app.vercel.app
```

## Supabaseの設定

Supabaseのダッシュボードで以下の設定を行う必要があります:

1. Supabaseダッシュボードにログイン
2. プロジェクトを選択 → Authentication → URL Configuration 
3. 「Site URL」に本番環境のURLを設定: `https://your-vercel-app.vercel.app`
4. 「Redirect URLs」に以下を追加:
   - `https://your-vercel-app.vercel.app/auth/callback`
   - `https://your-vercel-app.vercel.app/api/auth/callback`

## トラブルシューティング

Googleログイン後にlocalhost:3000にリダイレクトされる場合:

1. Supabaseダッシュボードで「Site URL」と「Redirect URLs」が正しく設定されているか確認
2. Vercelの環境変数に`NEXT_PUBLIC_SITE_URL`が正しく設定されているか確認
3. デプロイキャッシュをクリアするために、Vercelダッシュボードから「Redeploy」を実行

## デバッグログ

デプロイ後に問題が継続する場合、Vercelのログを確認して、リダイレクトURLがどのように処理されているかを確認してください。
