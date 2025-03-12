import { readFile } from 'fs/promises';

/**
 * Word文書からテキストを抽出する関数
 * @param filePath Word文書のパス
 * @returns 抽出されたテキスト
 */
export async function extractTextFromWord(filePath: string): Promise<string> {
  try {
    // mammothを直接インポート
    const mammoth = require('mammoth');
    
    // ファイルをバッファとして読み込む
    const fileBuffer = await readFile(filePath);
    
    // mammothを使用してテキスト抽出
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    return result.value;
  } catch (error: any) {
    console.error('Word文書からのテキスト抽出エラー:', error);
    throw new Error(`Word文書からのテキスト抽出に失敗しました: ${error?.message || 'Unknown error'}`);
  }
}
