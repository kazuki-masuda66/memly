import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-admin';
import { GoogleGenerativeAI } from '@google/generative-ai';

// 選択肢の型定義
interface Choice {
  id: string;
  text: string;
  isCorrect: boolean;
}

// 4択問題の型定義
interface MultipleChoiceQuestion {
  question: string;
  choices: Choice[];
}

// カード情報の型定義
interface CardWithChoices {
  id: string;
  choices: Choice[];
}

export async function POST(request: Request) {
  console.log('バッチ4択問題生成APIが呼び出されました');
  
  try {
    // リクエストから処理するカードIDリストを取得
    const requestData = await request.json();
    const { cardIds } = requestData;
    
    if (!cardIds || !Array.isArray(cardIds) || cardIds.length === 0) {
      console.error('有効なカードIDリストが指定されていません');
      return NextResponse.json(
        { success: false, message: '有効なカードIDリストが指定されていません' },
        { status: 400 }
      );
    }
    
    console.log(`処理するカード数: ${cardIds.length}`);
    console.log('カードIDs:', cardIds);
    
    // Google API Keyが設定されているか確認
    const googleApiKey = process.env.GOOGLE_API_KEY;
    if (!googleApiKey) {
      console.error('GOOGLE_API_KEYが環境変数に設定されていません');
      
      // デフォルトの選択肢を返す（APIキーがない場合のフォールバック）
      return NextResponse.json(
        {
          success: false,
          message: 'GOOGLE_API_KEYが設定されていません',
        },
        { status: 500 }
      );
    }
    
    // カード情報をバッチで取得
    const { data: cardsData, error: cardsError } = await supabase
      .from('flashcards')
      .select('id, front, back, deck_id, decks:deck_id(title)')
      .in('id', cardIds);
    
    if (cardsError) {
      console.error('カード取得エラー:', cardsError);
      return NextResponse.json(
        { success: false, message: 'カード情報の取得に失敗しました', error: cardsError },
        { status: 500 }
      );
    }
    
    if (!cardsData || cardsData.length === 0) {
      console.error('カードが見つかりませんでした');
      return NextResponse.json(
        { success: false, message: '指定されたカードが見つかりません' },
        { status: 404 }
      );
    }
    
    console.log('カード情報を取得しました:', cardsData.length);
    
    // Gemini APIクライアントを初期化
    const genAI = new GoogleGenerativeAI(googleApiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    
    // すべてのカード情報を一括処理するプロンプトを作成
    let prompt = `
# 課題
複数のフラッシュカードの情報から、それぞれに関連する4択クイズを一括で生成してください。

# フラッシュカードのリスト
`;

    // 各カード情報をプロンプトに追加
    cardsData.forEach((card: any, index) => {
      prompt += `
## カード ${index + 1}
- ID: ${card.id}
- 問題 (表面): ${card.front}
- 解答 (裏面): ${card.back}
- デッキ名: ${card.decks && card.decks.title ? card.decks.title : '不明'}
`;
    });
    
    // 出力形式の指定
    prompt += `
# 出力形式
以下のJSON形式で出力してください。各カードごとに1つの4択問題を生成し、IDと選択肢を指定してください：

\`\`\`json
{
  "cards": [
    {
      "id": "カード1のID",
      "choices": [
        {
          "id": "a",
          "text": "正解の選択肢",
          "isCorrect": true
        },
        {
          "id": "b",
          "text": "不正解の選択肢1",
          "isCorrect": false
        },
        {
          "id": "c",
          "text": "不正解の選択肢2",
          "isCorrect": false
        },
        {
          "id": "d",
          "text": "不正解の選択肢3",
          "isCorrect": false
        }
      ]
    },
    // 残りのカードも同様に
  ]
}
\`\`\`

# 要件
- 各カードごとに4つの選択肢を生成してください
- 正解の選択肢は必ず1つだけにしてください
- 不正解の選択肢は、正解に似ているが明らかに異なるものにしてください
- 不正解の選択肢は、正解の内容に関連しているが誤った情報を含むものにしてください
- 選択肢はどの選択肢が正解でも構いません（a, b, c, dのどれか一つが正解）
- JSONのみを出力し、余計な説明や補足は不要です
- 必ずすべてのカードに対して問題を生成してください
`;

    console.log('バッチ処理プロンプトを作成しました');
    
    // Gemini APIを呼び出して4択問題を一括生成
    console.log('Gemini APIを呼び出し中...');
    try {
      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      
      console.log('Gemini APIからの応答を受信しました');
      
      // 結果からJSONを抽出
      let jsonResponse;
      try {
        // JSONのみを抽出するために、テキスト内にあるJSONを探す
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonResponse = JSON.parse(jsonMatch[0]);
          console.log('有効なJSONを抽出しました');
        } else {
          console.error('JSONが見つかりません。Geminiの出力:', text);
          throw new Error('JSONが見つかりません');
        }
        
        // 応答を検証
        if (!jsonResponse || !jsonResponse.cards || !Array.isArray(jsonResponse.cards)) {
          console.error('JSON形式が不正です:', jsonResponse);
          throw new Error('JSON形式が不正です');
        }
        
        // 各カードの選択肢をシャッフル
        const processedCards = jsonResponse.cards.map((card: any) => {
          if (!card.choices || !Array.isArray(card.choices)) {
            return card;
          }
          
          // 選択肢をシャッフル（正解がランダムな位置になるように）
          const choices = [...card.choices];
          // Fisher-Yatesアルゴリズムでシャッフル
          for (let i = choices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [choices[i], choices[j]] = [choices[j], choices[i]];
          }
          
          // 選択肢のIDを再割り当て (a, b, c, d)
          const ids = ['a', 'b', 'c', 'd'];
          choices.forEach((choice: Choice, index: number) => {
            choice.id = ids[index];
          });
          
          return {
            id: card.id,
            choices: choices
          };
        });
        
        // 4択問題のJSONを返す
        return NextResponse.json({
          success: true,
          message: '複数の4択問題を生成しました',
          data: {
            cards: processedCards
          }
        });
        
      } catch (jsonError) {
        console.error('JSON解析エラー:', jsonError);
        console.error('受信したテキスト:', text);
        
        return NextResponse.json(
          { success: false, message: 'JSON解析エラー', error: String(jsonError) },
          { status: 500 }
        );
      }
      
    } catch (aiError) {
      console.error('Gemini API呼び出しエラー:', aiError);
      
      return NextResponse.json(
        { success: false, message: 'AI処理エラー', error: String(aiError) },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('4択問題生成バッチAPI全体エラー:', error);
    
    return NextResponse.json(
      { success: false, message: '予期しないエラーが発生しました', error: String(error) },
      { status: 500 }
    );
  }
}
