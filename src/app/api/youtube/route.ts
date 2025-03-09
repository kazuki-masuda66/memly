import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { writeFile, readFile, unlink, stat } from 'fs/promises';
import path from 'path';
import { mkdir } from 'fs/promises';
import { promisify } from 'util';
import { Configuration, OpenAIApi } from 'openai-edge';
import fs from 'fs';
import https from 'https';
import { IncomingMessage } from 'http';
import { YoutubeTranscript } from 'youtube-transcript';

// NodeJSランタイムを明示的に指定
export const runtime = 'nodejs';

// 最大実行時間を60秒に設定
export const maxDuration = 60;

// 一時ディレクトリのパス設定
const TEMP_DIR = process.env.TEMP_DIR || './tmp';

// execを非同期関数化
const execAsync = promisify(exec);

// OpenAI APIクライアントの初期化
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// YouTubeリンクのバリデーション関数
function isValidYoutubeUrl(url: string): boolean {
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
  return youtubeRegex.test(url);
}

// YouTubeのビデオIDを抽出する関数
function extractVideoId(url: string): string | null {
  const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  
  return (match && match[2].length === 11)
    ? match[2]
    : null;
}

// Caption インターフェースの定義
interface Caption {
  text: string;
  start: number;
  duration: number;
}

// youtube-transcript ライブラリを使用して字幕を取得する関数
async function getYoutubeTranscript(videoId: string): Promise<Caption[]> {
  try {
    console.log(`youtube-transcript ライブラリで字幕を取得: ${videoId}`);
    
    // 字幕を取得
    const transcripts = await YoutubeTranscript.fetchTranscript(videoId);
    
    // 返却形式に変換
    const captions: Caption[] = transcripts.map(entry => ({
      text: entry.text,
      start: entry.offset / 1000, // ミリ秒から秒に変換
      duration: entry.duration / 1000 // ミリ秒から秒に変換
    }));
    
    console.log(`字幕取得成功: ${captions.length}件`);
    return captions;
  } catch (error: any) {
    console.error(`字幕取得エラー:`, error.message);
    throw new Error(`字幕取得エラー: ${error.message}`);
  }
}

export async function POST(req: Request) {
  try {
    console.log('YouTube APIが呼び出されました');
    
    // 一時ディレクトリを確認
    try {
      await mkdir(TEMP_DIR, { recursive: true });
      console.log('一時ディレクトリを確認しました:', TEMP_DIR);
    } catch (err) {
      console.warn('一時ディレクトリの作成中にエラーが発生しました:', err);
    }
    
    // リクエストボディをパース
    const body = await req.json();
    
    // YouTubeのURLを取得
    const youtubeUrl = body.youtubeUrl;
    if (!youtubeUrl || !isValidYoutubeUrl(youtubeUrl)) {
      return NextResponse.json(
        { error: { message: '有効なYouTube URLを指定してください' } },
        { status: 400 }
      );
    }
    
    // ビデオIDを抽出
    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
      return NextResponse.json(
        { error: { message: 'YouTube URLからビデオIDを抽出できませんでした' } },
        { status: 400 }
      );
    }
    
    console.log('処理するYouTubeビデオID:', videoId);
    
    try {
      // 字幕取得のフラグ
      let needsTranscription = false;
      let captionText = '';
      let allCaptions: Caption[] = [];
      
      try {
        console.log('youtube-transcript ライブラリで字幕取得を開始します...');
        
        // 新しいライブラリを使用して字幕を取得
        allCaptions = await getYoutubeTranscript(videoId);
        
        if (allCaptions && allCaptions.length > 0) {
          // 字幕テキストを連結
          captionText = allCaptions.map(caption => caption.text).join(' ');
          console.log(`字幕を取得しました (${captionText.length} 文字, 取得元: youtube-transcript)`);
          needsTranscription = false;
        } else {
          console.log('字幕が見つかりませんでした。');
          captionText = '字幕が見つかりませんでした。';
          needsTranscription = true;
        }
      } catch (error: any) {
        console.error('字幕取得全体でエラーが発生しました:', error);
        captionText = '字幕の取得中にエラーが発生しました: ' + error.message;
        needsTranscription = true;
      }
      
      // YouTube情報取得
      console.log('YouTube情報取得を実行中...');
      const result = await getYoutubeInfo(videoId, captionText, needsTranscription);
      console.log('YouTube情報取得成功');
      
      return NextResponse.json({
        text: formatResponseText(result),
        videoInfo: result,
        captions: allCaptions
      }, { status: 200 });
      
    } catch (error: any) {
      console.error('YouTube API処理エラー:', error);
      return NextResponse.json(
        { error: { message: `処理中にエラーが発生しました: ${error?.message || '不明なエラー'}` } },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('YouTube API処理エラー:', error);
    return NextResponse.json(
      { error: { message: `処理中にエラーが発生しました: ${error?.message || '不明なエラー'}` } },
      { status: 500 }
    );
  }
}

// YouTube情報のみを取得する関数
async function getYoutubeInfo(videoId: string, captionText: string, needsTranscription: boolean) {
  // APIキーがない場合は模擬データを返す
  if (!process.env.YOUTUBE_API_KEY) {
    console.log('警告: YOUTUBE_API_KEYが設定されていないため、モックデータを使用します');
    return {
      title: `YouTube動画 ${videoId}`,
      description: "これはYouTube APIキーが設定されていないため生成されたモックデータです。実際のAPIキーを設定すると、本物の動画タイトルと説明文を取得できます。",
      publishedAt: new Date().toISOString(),
      videoId: videoId,
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/default.jpg`,
      captions: captionText,
      needsTranscription: needsTranscription
    };
  }
  
  // YouTube Data APIを使って動画情報を取得
  const options = {
    hostname: 'www.googleapis.com',
    path: `/youtube/v3/videos?id=${videoId}&part=snippet&key=${process.env.YOUTUBE_API_KEY}`,
    method: 'GET'
  };
  
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const apiResponse = JSON.parse(data);
          
          if (apiResponse.items && apiResponse.items.length > 0) {
            const snippet = apiResponse.items[0].snippet;
            
            resolve({
              title: snippet.title,
              description: snippet.description,
              publishedAt: snippet.publishedAt,
              videoId: videoId,
              thumbnailUrl: snippet.thumbnails.default.url,
              captions: captionText,
              needsTranscription: needsTranscription
            });
          } else {
            resolve({
              title: `YouTube動画 ${videoId}`,
              description: "YouTube APIからビデオ情報を取得できませんでした。",
              publishedAt: new Date().toISOString(),
              videoId: videoId,
              thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/default.jpg`,
              captions: captionText,
              needsTranscription: needsTranscription
            });
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('error', (e) => {
      reject(e);
    });
    
    req.end();
  });
}

// レスポンステキストをフォーマットする関数
function formatResponseText(videoInfo: any) {
  let textContent = `YouTube動画: ${videoInfo.title}
公開日: ${new Date(videoInfo.publishedAt).toLocaleDateString()}
ビデオID: ${videoInfo.videoId}

説明:
${videoInfo.description}`;

  // 字幕情報を追加
  textContent += `\n\n字幕:\n${videoInfo.captions}`;
  
  return textContent;
} 