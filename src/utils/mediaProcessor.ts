import { readFile } from 'fs/promises';
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * 音声ファイルからテキストを抽出する関数
 * @param filePath 音声ファイルのパス
 * @param mimeType ファイルのMIMEタイプ
 * @returns 抽出されたテキスト
 */
export async function extractTextFromAudio(
  filePath: string,
  mimeType: string
): Promise<string> {
  try {
    // Google API Keyが設定されているか確認
    const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
    if (!GOOGLE_API_KEY) {
      throw new Error('Google API Keyが設定されていません。環境変数GOOGLE_API_KEYを設定してください。');
    }
    
    // Google Generative AI APIの初期化
    const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
    
    // ファイルをBase64エンコード
    const fileBuffer = await readFile(filePath);
    const base64Audio = fileBuffer.toString('base64');
    
    // Gemini 1.5 Proモデルの初期化
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    
    // Gemini 1.5 Proの機能を使って音声を文字起こし
    const transcriptionPart = {
      inlineData: {
        data: base64Audio,
        mimeType: mimeType
      }
    };
    
    console.log('Gemini 1.5 Proを使用して音声の文字起こしを開始します...');
    const result = await model.generateContent([
      "以下の音声を文字起こししてください。話者の区別、句読点、段落分けなどを適切に行ってください。",
      transcriptionPart
    ]);
    
    // レスポンスからテキストを抽出
    const response = await result.response;
    return response.text();
  } catch (error: any) {
    console.error('音声ファイルの処理に失敗しました:', error);
    throw new Error(`音声ファイルの処理に失敗しました: ${error?.message || 'Unknown error'}`);
  }
}

/**
 * 画像ファイルからテキストを抽出する関数
 * @param filePath 画像ファイルのパス
 * @param mimeType ファイルのMIMEタイプ
 * @returns 抽出されたテキスト
 */
export async function extractTextFromImage(
  filePath: string,
  mimeType: string
): Promise<string> {
  try {
    // 対応している画像形式かどうかを確認
    const supportedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!supportedImageTypes.includes(mimeType)) {
      throw new Error(`サポートされていない画像フォーマットです: ${mimeType}。JPG、JPEG、PNG、GIF、WEBPのみサポートしています。`);
    }
    
    // Google API Keyが設定されているか確認
    const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
    if (!GOOGLE_API_KEY) {
      throw new Error('Google API Keyが設定されていません。環境変数GOOGLE_API_KEYを設定してください。');
    }
    
    // Google Generative AI APIの初期化
    const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
    
    // ファイルをBase64エンコード
    const fileBuffer = await readFile(filePath);
    const base64Image = fileBuffer.toString('base64');
    
    // Gemini 1.5 Proモデルの初期化
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    
    // Gemini 1.5 Proの機能を使って画像からテキスト抽出
    const imagePart = {
      inlineData: {
        data: base64Image,
        mimeType: mimeType
      }
    };
    
    console.log('Gemini 1.5 Proを使用して画像からテキストを抽出します...');
    const result = await model.generateContent([
      "この画像に含まれるすべてのテキストを抽出してください。テーブルやリスト、段落などの構造を可能な限り保持してください。",
      imagePart
    ]);
    
    // レスポンスからテキストを抽出
    const response = await result.response;
    return response.text();
  } catch (error: any) {
    console.error('画像ファイルの処理に失敗しました:', error);
    throw new Error(`画像ファイルの処理に失敗しました: ${error?.message || 'Unknown error'}`);
  }
}
