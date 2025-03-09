/** @type {import('next').NextConfig} */
const nextConfig = {
  // Edge Runtimeの設定
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse', 'mammoth', 'pdf.js-extract'],
    esmExternals: 'loose',
  },
  // サーバー環境の設定
  env: {
    // Windows環境では/tmpがないため、一時ディレクトリを設定
    TEMP_DIR: process.platform === 'win32' ? './tmp' : '/tmp',
    // YouTube APIキー（本番環境では.env.localファイルで設定することを推奨）
    YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY || ''
  }
};

module.exports = nextConfig; 