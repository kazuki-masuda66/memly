/** @type {import('next').NextConfig} */
const nextConfig = {
  // Edge Runtimeの設定
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse', 'mammoth', 'pdf.js-extract', '@google/generative-ai'],
    esmExternals: 'loose',
  },
  // サーバー環境の設定
  env: {
    // Windows環境では/tmpがないため、一時ディレクトリを設定
    TEMP_DIR: process.platform === 'win32' ? './tmp' : '/tmp',
    // YouTube APIキー（本番環境では.env.localファイルで設定することを推奨）
    YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY || ''
  },
  // 本番環境でのサーバーサイドコードの処理方法を指定
  output: 'standalone',
  // Vercel環境でのnpmパッケージの扱いを設定
  webpack: (config, { isServer }) => {
    if (isServer) {
      // サーバーサイドでのみ必要なパッケージをバンドルに含める
      config.externals = [...config.externals, 'canvas', 'jsdom'];
    }
    return config;
  },
};

module.exports = nextConfig;
