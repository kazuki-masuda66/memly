import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { writeFile } from 'fs/promises';
import { unlink } from 'fs/promises';
import { mkdir } from 'fs/promises';
import crypto from 'crypto';

// NodeJSランタイムを明示的に指定
export const runtime = 'nodejs';
export const maxDuration = 120; // 120秒に拡張（音声処理は時間がかかる可能性がある）

// 一時ディレクトリのパス設定
const TEMP_DIR = process.env.TEMP_DIR || './tmp';

export async function POST(req: NextRequest) {
  try {
    console.log('ファイルアップロードAPIが呼び出されました');
    
    // 一時ディレクトリが存在することを確認
    try {
      await mkdir(TEMP_DIR, { recursive: true });
      console.log('一時ディレクトリを確認しました:', TEMP_DIR);
    } catch (err) {
      console.warn('一時ディレクトリの作成中にエラーが発生しました:', err);
      // エラーは無視して続行（既に存在する場合など）
    }
    
    const formData = await req.formData();
    const file = formData.get('file');

    console.log('ファイル情報:', file instanceof File ? `${file.name}, タイプ: ${file.type}` : 'ファイルなし');

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: { message: 'ファイルがアップロードされていません' } },
        { status: 400 }
      );
    }

    // ファイルタイプの検証
    const fileType = file.type;
    let extractedText = '';

    // 一時ファイルに保存（ライブラリがディスク上のファイルを必要とするため）
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // 一時ファイル名を生成
    const tempFileName = path.join(TEMP_DIR, `${crypto.randomUUID()}${path.extname(file.name)}`);
    
    try {
      // ファイルを一時ディレクトリに保存
      await writeFile(tempFileName, buffer);
      console.log('一時ファイルを保存しました:', tempFileName);
      
      if (fileType === 'application/pdf') {
        // PDFファイルの処理
        try {
          console.log('PDFファイルの処理を開始');
          
          // 1. 最初に pdf-parse を試す
          try {
            const { exec } = require('child_process');
            const util = require('util');
            const execPromise = util.promisify(exec);
            
            console.log('pdf-parseでPDFを処理中...');
            
            const scriptPath = path.join(TEMP_DIR, `${crypto.randomUUID()}.js`);
            const scriptContent = `
              const fs = require('fs');
              const pdfParse = require('pdf-parse');
              
              const dataBuffer = fs.readFileSync('${tempFileName.replace(/\\/g, '\\\\')}');
              
              pdfParse(dataBuffer).then(data => {
                console.log(JSON.stringify({ text: data.text }));
              }).catch(err => {
                console.error(JSON.stringify({ error: err.message }));
                process.exit(1);
              });
            `;
            
            await writeFile(scriptPath, scriptContent);
            
            const { stdout, stderr } = await execPromise(`node "${scriptPath}"`);
            
            // スクリプトを削除
            await unlink(scriptPath).catch(console.error);
            
            if (stderr && stderr.includes('error')) {
              console.error('pdf-parseでのエラー:', stderr);
              throw new Error(stderr);
            }
            
            try {
              const result = JSON.parse(stdout);
              if (result.text) {
                extractedText = result.text;
                console.log('pdf-parseによるPDFからのテキスト抽出完了、長さ:', extractedText.length);
                // 成功したので、次の処理へ
              } else if (result.error) {
                throw new Error(result.error);
              }
            } catch (parseErr) {
              console.error('pdf-parseの出力のパースエラー:', parseErr);
              throw new Error('PDF抽出結果の解析に失敗しました');
            }
          } catch (pdfParseError) {
            // 2. pdf-parse 失敗時は pdf.js-extract を試す
            console.log('pdf-parseが失敗したため、pdf.js-extractを試みます...');
            
            const { exec } = require('child_process');
            const util = require('util');
            const execPromise = util.promisify(exec);
            
            const scriptPath = path.join(TEMP_DIR, `${crypto.randomUUID()}.js`);
            const scriptContent = `
              const PDFExtract = require('pdf.js-extract').PDFExtract;
              const pdfExtract = new PDFExtract();
              
              pdfExtract.extractRawText({ path: '${tempFileName.replace(/\\/g, '\\\\')}' })
                .then(data => {
                  // ページごとのテキストを連結
                  let allText = '';
                  if (data && data.pages) {
                    data.pages.forEach(page => {
                      if (page.content) {
                        page.content.forEach(item => {
                          if (item.str) {
                            allText += item.str + ' ';
                          }
                        });
                        allText += '\\n\\n'; // ページの区切り
                      }
                    });
                  }
                  console.log(JSON.stringify({ text: allText }));
                })
                .catch(err => {
                  console.error(JSON.stringify({ error: err.message }));
                  process.exit(1);
                });
            `;
            
            await writeFile(scriptPath, scriptContent);
            
            const { stdout, stderr } = await execPromise(`node "${scriptPath}"`);
            
            // スクリプトを削除
            await unlink(scriptPath).catch(console.error);
            
            if (stderr && stderr.includes('error')) {
              console.error('pdf.js-extractでのエラー:', stderr);
              throw new Error(`pdf.js-extractでもエラー: ${stderr}`);
            }
            
            try {
              const result = JSON.parse(stdout);
              if (result.text) {
                extractedText = result.text;
                console.log('pdf.js-extractによるPDFからのテキスト抽出完了、長さ:', extractedText.length);
              } else if (result.error) {
                throw new Error(result.error);
              }
            } catch (parseErr) {
              console.error('pdf.js-extractの出力のパースエラー:', parseErr);
              throw new Error('PDF抽出結果の解析に失敗しました（両方のライブラリが失敗）');
            }
          }
          
        } catch (error: any) {
          console.error('PDF解析の全試行が失敗しました:', error);
          return NextResponse.json(
            { error: { message: `PDFファイルの解析に失敗しました: ${error?.message || 'Unknown error'}` } },
            { status: 500 }
          );
        }
      } else if (
        fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        fileType === 'application/msword'
      ) {
        // Wordドキュメントの処理
        try {
          console.log('Word文書の処理を開始');
          
          // 別プロセスでmammothを実行
          const { exec } = require('child_process');
          const util = require('util');
          const execPromise = util.promisify(exec);
          
          // Node.jsスクリプトを作成して実行
          const scriptPath = path.join(TEMP_DIR, `${crypto.randomUUID()}.js`);
          const scriptContent = `
            const mammoth = require('mammoth');
            
            mammoth.extractRawText({ path: '${tempFileName.replace(/\\/g, '\\\\')}' })
              .then(result => {
                console.log(JSON.stringify({ text: result.value }));
              })
              .catch(err => {
                console.error(JSON.stringify({ error: err.message }));
                process.exit(1);
              });
          `;
          
          await writeFile(scriptPath, scriptContent);
          
          const { stdout, stderr } = await execPromise(`node "${scriptPath}"`);
          
          // 一時スクリプトを削除
          await unlink(scriptPath).catch(console.error);
          
          if (stderr && stderr.includes('error')) {
            console.error('Word解析中のエラー:', stderr);
            throw new Error(stderr);
          }
          
          try {
            const result = JSON.parse(stdout);
            if (result.text) {
              extractedText = result.text;
              console.log('Word文書からテキスト抽出完了、長さ:', extractedText.length);
            } else if (result.error) {
              throw new Error(result.error);
            }
          } catch (parseErr) {
            console.error('スクリプト出力のパースエラー:', parseErr);
            throw new Error('Word抽出結果の解析に失敗しました');
          }
          
        } catch (error: any) {
          console.error('Word文書解析エラー:', error);
          return NextResponse.json(
            { error: { message: `Word文書の解析に失敗しました: ${error?.message || 'Unknown error'}` } },
            { status: 500 }
          );
        }
      } else if (
        fileType.startsWith('audio/') || 
        fileType === 'video/mp4' || 
        fileType === 'video/webm' ||
        fileType === 'application/octet-stream' // 一部の音声ファイルの場合
      ) {
        // 音声ファイルの処理
        try {
          console.log('音声ファイルの処理を開始');
          
          // Gemini APIを使用して音声をテキストに変換
          const { exec } = require('child_process');
          const util = require('util');
          const execPromise = util.promisify(exec);
          
          // Node.jsスクリプトを作成して実行
          const scriptPath = path.join(TEMP_DIR, `${crypto.randomUUID()}.js`);
          const scriptContent = `
            const fs = require('fs');
            const { GoogleGenerativeAI } = require('@google/generative-ai');
            const path = require('path');
            
            async function main() {
              try {
                // 環境変数にAPIキーがない場合はエラーを返す
                if (!process.env.GOOGLE_API_KEY) {
                  console.error(JSON.stringify({
                    error: 'Google API Keyが設定されていません。環境変数GOOGLE_API_KEYを設定してください。'
                  }));
                  process.exit(1);
                }
                
                // Google Generative AI APIの初期化
                const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
                
                // ファイルの読み込み
                const filePath = '${tempFileName.replace(/\\/g, '\\\\')}';
                const fileBuffer = fs.readFileSync(filePath);
                
                // ファイルをBase64エンコード
                const base64Audio = fileBuffer.toString('base64');
                
                // Geminiモデルの初期化（正しいモデル名に修正）
                const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
                
                // Gemini APIの機能を使って音声を文字起こし
                const transcriptionPart = {
                  inlineData: {
                    data: base64Audio,
                    mimeType: "${fileType}"
                  }
                };
                
                const result = await model.generateContent([
                  "以下の音声ファイルを文字起こししてください。できるだけ正確に文字起こしを行い、話者の区別や句読点などを適切に入れてください。", 
                  transcriptionPart
                ]);
                
                const response = await result.response;
                const transcription = response.text();
                
                console.log(JSON.stringify({ text: transcription }));
              } catch (error) {
                console.error(JSON.stringify({ error: error.message }));
                process.exit(1);
              }
            }
            
            main();
          `;
          
          await writeFile(scriptPath, scriptContent);
          
          // GOOGLE_API_KEYを環境変数として渡す
          const { stdout, stderr } = await execPromise(`node "${scriptPath}"`, {
            env: { ...process.env },
            timeout: 60000, // 60秒のタイムアウト
          });
          
          // 一時スクリプトを削除
          await unlink(scriptPath).catch(console.error);
          
          if (stderr && stderr.includes('error')) {
            console.error('音声処理中のエラー:', stderr);
            throw new Error(stderr);
          }
          
          try {
            const result = JSON.parse(stdout);
            if (result.text) {
              extractedText = result.text;
              console.log('音声からテキスト抽出完了、長さ:', extractedText.length);
            } else if (result.error) {
              throw new Error(result.error);
            }
          } catch (parseErr) {
            console.error('スクリプト出力のパースエラー:', parseErr, 'stdout:', stdout);
            throw new Error('音声変換結果の解析に失敗しました');
          }
          
        } catch (error: any) {
          console.error('音声処理エラー:', error);
          return NextResponse.json(
            { error: { message: `音声ファイルの処理に失敗しました: ${error?.message || 'Unknown error'}` } },
            { status: 500 }
          );
        }
      } else if (
        fileType.startsWith('image/') // 画像ファイルの処理を追加
      ) {
        // 画像ファイルの処理
        try {
          console.log('画像ファイルの処理を開始');
          
          // Gemini APIを使用して画像からテキストを抽出
          const { exec } = require('child_process');
          const util = require('util');
          const execPromise = util.promisify(exec);
          
          // Node.jsスクリプトを作成して実行
          const scriptPath = path.join(TEMP_DIR, `${crypto.randomUUID()}.js`);
          const scriptContent = `
            const fs = require('fs');
            const { GoogleGenerativeAI } = require('@google/generative-ai');
            const path = require('path');
            
            async function main() {
              try {
                // 環境変数にAPIキーがない場合はエラーを返す
                if (!process.env.GOOGLE_API_KEY) {
                  console.error(JSON.stringify({
                    error: 'Google API Keyが設定されていません。環境変数GOOGLE_API_KEYを設定してください。'
                  }));
                  process.exit(1);
                }
                
                // Google Generative AI APIの初期化
                const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
                
                // ファイルの読み込み
                const filePath = '${tempFileName.replace(/\\/g, '\\\\')}';
                const fileBuffer = fs.readFileSync(filePath);
                
                // ファイルをBase64エンコード
                const base64Image = fileBuffer.toString('base64');
                
                // Geminiモデルの初期化
                const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
                
                // Gemini APIの機能を使って画像からテキストを抽出
                const imagePart = {
                  inlineData: {
                    data: base64Image,
                    mimeType: "${fileType}"
                  }
                };
                
                const result = await model.generateContent([
                  "この画像内のテキストをすべて抽出してください。画像に日本語と英語が混在している場合は、原文のまま抽出してください。表や図形内のテキストも含めて、レイアウトを保ちながら可能な限り正確に抽出してください。",
                  imagePart
                ]);
                
                const response = await result.response;
                const extractedText = response.text();
                
                console.log(JSON.stringify({ text: extractedText }));
              } catch (error) {
                console.error(JSON.stringify({ error: error.message }));
                process.exit(1);
              }
            }
            
            main();
          `;
          
          await writeFile(scriptPath, scriptContent);
          
          // GOOGLE_API_KEYを環境変数として渡す
          const { stdout, stderr } = await execPromise(`node "${scriptPath}"`, {
            env: { ...process.env },
            timeout: 60000, // 60秒のタイムアウト
          });
          
          // 一時スクリプトを削除
          await unlink(scriptPath).catch(console.error);
          
          if (stderr && stderr.includes('error')) {
            console.error('画像処理中のエラー:', stderr);
            throw new Error(stderr);
          }
          
          try {
            const result = JSON.parse(stdout);
            if (result.text) {
              extractedText = result.text;
              console.log('画像からテキスト抽出完了、長さ:', extractedText.length);
            } else if (result.error) {
              throw new Error(result.error);
            }
          } catch (parseErr) {
            console.error('スクリプト出力のパースエラー:', parseErr, 'stdout:', stdout);
            throw new Error('画像変換結果の解析に失敗しました');
          }
          
        } catch (error: any) {
          console.error('画像処理エラー:', error);
          return NextResponse.json(
            { error: { message: `画像ファイルの処理に失敗しました: ${error?.message || 'Unknown error'}` } },
            { status: 500 }
          );
        }
      } else {
        console.log('サポートされていないファイル形式:', fileType);
        return NextResponse.json(
          { error: { message: 'サポートされていないファイル形式です。PDF、Word文書、音声ファイル、または画像ファイル（JPG、PNG、GIF、WEBP）をアップロードしてください。' } },
          { status: 400 }
        );
      }
      
      // 一時ファイルを削除
      await unlink(tempFileName).catch(console.error);
      
    } catch (fileError: any) {
      console.error('ファイル処理エラー:', fileError);
      return NextResponse.json(
        { error: { message: `ファイル処理中にエラーが発生しました: ${fileError?.message || 'Unknown error'}` } },
        { status: 500 }
      );
    }

    // 抽出されたテキストが空でないことを確認
    if (!extractedText.trim()) {
      console.log('抽出されたテキストが空です');
      return NextResponse.json(
        { error: { message: 'ファイルからテキストを抽出できませんでした' } },
        { status: 400 }
      );
    }

    console.log('テキスト抽出成功、長さ:', extractedText.length);
    // 成功レスポンスを返す
    return NextResponse.json({ text: extractedText }, { status: 200 });
  } catch (error: any) {
    console.error('ファイル処理エラー:', error);
    return NextResponse.json(
      { error: { message: `ファイル処理中にエラーが発生しました: ${error?.message || 'Unknown error'}` } },
      { status: 500 }
    );
  }
}