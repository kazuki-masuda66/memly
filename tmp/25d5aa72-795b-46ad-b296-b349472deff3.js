
            const fs = require('fs');
            const { pipeline } = require('stream');
            const { promisify } = require('util');
            const path = require('path');
            
            async function main() {
              try {
                // OpenAI Whisper APIを使用する場合
                const OpenAI = require('openai');
                
                // 環境変数にAPIキーがない場合はエラーを返す
                if (!process.env.OPENAI_API_KEY) {
                  console.error(JSON.stringify({
                    error: 'OpenAI API Keyが設定されていません。環境変数OPENAI_API_KEYを設定してください。'
                  }));
                  process.exit(1);
                }
                
                const openai = new OpenAI({
                  apiKey: process.env.OPENAI_API_KEY,
                });
                
                const filePath = 'tmp\\da17b637-b43d-4b68-a736-d6a6dd52c55f.mp3';
                
                // 音声ファイルの読み込み
                const transcription = await openai.audio.transcriptions.create({
                  file: fs.createReadStream(filePath),
                  model: 'whisper-1',
                  language: 'ja', // 日本語を指定（自動検出も可能）
                  response_format: 'text',
                });
                
                console.log(JSON.stringify({ text: transcription }));
              } catch (error) {
                console.error(JSON.stringify({ error: error.message }));
                process.exit(1);
              }
            }
            
            main();
          