
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
                const filePath = 'tmp\\50a24d6d-e276-4893-9d03-86bd32d740fc.mp3';
                const fileBuffer = fs.readFileSync(filePath);
                
                // ファイルをBase64エンコード
                const base64Audio = fileBuffer.toString('base64');
                
                // Gemini Flash 2.0モデルの初期化
                const model = genAI.getGenerativeModel({ model: "gemini-flash-2.0" });
                
                // Gemini Flash 2.0の機能を使って音声を文字起こし
                const transcriptionPart = {
                  inlineData: {
                    data: base64Audio,
                    mimeType: "audio/mpeg"
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
          