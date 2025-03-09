import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import { unlink } from 'fs/promises';
import { mkdir } from 'fs/promises';

// NodeJSランタイムを明示的に指定
export const runtime = 'nodejs';

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
    const tempFileName = path.join(TEMP_DIR, `${randomUUID()}${path.extname(file.name)}`);
    
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
            
            const scriptPath = path.join(TEMP_DIR, `${randomUUID()}.js`);
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
            
            const scriptPath = path.join(TEMP_DIR, `${randomUUID()}.js`);
            const scriptContent = `
              const PDFExtract = require('pdf.js-extract').PDFExtract;
              const pdfExtract = new PDFExtract();
              
              pdfExtract.extract('${tempFileName.replace(/\\/g, '\\\\')}', {})
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
          const scriptPath = path.join(TEMP_DIR, `${randomUUID()}.js`);
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
      } else {
        console.log('サポートされていないファイル形式:', fileType);
        return NextResponse.json(
          { error: { message: 'サポートされていないファイル形式です。PDFまたはWord文書をアップロードしてください。' } },
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