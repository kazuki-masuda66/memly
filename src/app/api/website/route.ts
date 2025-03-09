import { NextResponse } from 'next/server';

// Edge Runtimeを指定
export const runtime = 'edge';

// 最大実行時間を30秒に設定
export const maxDuration = 30;

// Webサイトからテキストを抽出する関数
async function extractTextFromWebsite(url: string): Promise<string> {
  try {
    // 開始時間を記録
    const startTime = Date.now();
    
    // URLの検証
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    // 指定されたURLからコンテンツを取得
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTPエラー: ${response.status}`);
    }

    // HTMLテキストを取得
    const html = await response.text();
    
    // HTMLからテキストを抽出（簡易実装）
    const text = extractTextFromHTML(html);

    // 終了時間を記録し、所要時間を計算（秒単位）
    const fetchTime = (Date.now() - startTime) / 1000;

    return text;
  } catch (error) {
    console.error('Webサイトの取得中にエラーが発生しました:', error);
    throw error;
  }
}

// HTMLからテキストを抽出する関数
function extractTextFromHTML(html: string): string {
  // 簡易的なHTMLタグ除去（実際のプロダクションでは、より堅牢なパーサーを使用することをお勧めします）
  let text = html
    // スクリプトタグの除去
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // スタイルタグの除去
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    // HTMLタグの除去
    .replace(/<[^>]+>/g, ' ')
    // 複数の空白を1つの空白に
    .replace(/\s+/g, ' ')
    // HTML特殊文字のデコード
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // 前後の空白を削除
    .trim();

  return text;
}

interface WebsiteRequest {
  url: string;
}

export async function POST(req: Request) {
  console.log('Webサイト取得API: リクエスト受信');
  
  try {
    // 開始時間を記録
    const startTime = Date.now();
    
    // リクエストボディを取得
    const body = await req.json() as WebsiteRequest;
    const { url } = body;
    
    if (!url) {
      return NextResponse.json({ error: 'URLが指定されていません' }, { status: 400 });
    }
    
    console.log('Webサイト取得API: URL', url);
    
    // Webサイトからテキストを抽出
    const text = await extractTextFromWebsite(url);
    
    // 終了時間を記録し、所要時間を計算（秒単位）
    const fetchTime = (Date.now() - startTime) / 1000;
    
    // メタデータ（URLなど）を含めた応答を作成
    const result = {
      text: `Webサイト: ${url}\n\n${text}`,
      websiteInfo: {
        url,
        textLength: text.length,
        fetchedAt: new Date().toISOString(),
        fetchTime: fetchTime // 取得にかかった時間を秒単位で追加
      }
    };
    
    console.log('Webサイト取得API: 取得成功', { textLength: text.length });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Webサイト取得API: エラー', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '不明なエラーが発生しました' },
      { status: 500 }
    );
  }
} 