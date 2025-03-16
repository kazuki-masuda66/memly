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

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  console.log('4択問題生成APIが呼び出されました');
  console.log('Request URL:', request.url);
  console.log('Params:', params);
  
  try {
    const cardId = params.id;
    
    console.log(`カードID: ${cardId}`);
    
    if (!cardId) {
      console.error('カードIDが指定されていません');
      return NextResponse.json(
        { success: false, message: 'カードIDが指定されていません' },
        { status: 400 }
      );
    }
    
    // カード情報を取得
    const { data: cardData, error: cardError } = await supabase
      .from('flashcards')
      .select('*, decks(title)')
      .eq('id', cardId)
      .single();
    
    if (cardError) {
      console.error('カード取得エラー:', cardError);
      return NextResponse.json(
        { success: false, message: 'カード情報の取得に失敗しました', error: cardError },
        { status: 500 }
      );
    }
    
    if (!cardData) {
      console.error('カードが見つかりませんでした');
      return NextResponse.json(
        { success: false, message: 'カードが見つかりません' },
        { status: 404 }
      );
    }
    
    console.log('カード情報を取得しました');
    
    // カードと関連するデッキの情報を抽出
    const cardFront = cardData.front || '';
    const cardBack = cardData.back || '';
    const deckId = cardData.deck_id;
    const deckTitle = cardData.decks?.title || '';
    
    // 同じデッキの他のカードを取得（5枚まで）
    const { data: deckCardsData, error: deckCardsError } = await supabase
      .from('flashcards')
      .select('front, back')
      .eq('deck_id', deckId)
      .neq('id', cardId)
      .limit(5);
    
    if (deckCardsError) {
      console.error('デッキのカード取得エラー:', deckCardsError);
    }
    
    // Google API Keyが設定されているか確認
    const googleApiKey = process.env.GOOGLE_API_KEY;
    if (!googleApiKey) {
      console.error('GOOGLE_API_KEYが環境変数に設定されていません');
      
      // デフォルトの選択肢を返す（APIキーがない場合のフォールバック）
      const defaultChoices: Choice[] = [
        { id: 'a', text: cardBack, isCorrect: true },
        { id: 'b', text: `別の選択肢1 (${cardBack}とは異なる)`, isCorrect: false },
        { id: 'c', text: `別の選択肢2 (${cardBack}とは異なる)`, isCorrect: false },
        { id: 'd', text: `別の選択肢3 (${cardBack}とは異なる)`, isCorrect: false },
      ];
      
      console.log('デフォルトの選択肢を返します (APIキーなし)');
      
      return NextResponse.json(
        {
          success: true,
          message: 'デフォルトの選択肢を生成しました（API KEYなし）',
          data: {
            question: cardFront,
            choices: defaultChoices
          }
        }
      );
    }

    console.log('Google API Keyが見つかりました、Gemini APIを初期化します');

    // Gemini APIクライアントを初期化
    const genAI = new GoogleGenerativeAI(googleApiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    // プロンプトの作成
    let prompt = `
# 課題
フラッシュカードの情報から、内容に関連する4択クイズを生成してください。

# フラッシュカードの情報
- デッキ名: ${deckTitle}
- 問題 (表面): ${cardFront}
- 解答 (裏面): ${cardBack}

`;

    console.log('4択問題生成プロンプトを作成しました');

    // 同じデッキの他のカード情報があれば、コンテキストとして追加
    if (deckCardsData && deckCardsData.length > 0) {
      prompt += "\n# 同じデッキの他のカード情報（コンテキスト）\n";
      deckCardsData.forEach((card, index) => {
        prompt += `${index + 1}. 問題: ${card.front}, 答え: ${card.back}\n`;
      });
    }

    // 出力形式の指定
    prompt += `
# 出力形式
以下のJSON形式で出力してください:

\`\`\`json
{
  "question": "ここに問題文を入れる（フラッシュカードの表面の内容を問題文に変換）",
  "choices": [
    {
      "id": "a",
      "text": "ここに正解を入れる（フラッシュカードの裏面の内容を基に）",
      "isCorrect": true
    },
    {
      "id": "b",
      "text": "ここに不正解の選択肢1を入れる",
      "isCorrect": false
    },
    {
      "id": "c",
      "text": "ここに不正解の選択肢2を入れる",
      "isCorrect": false
    },
    {
      "id": "d",
      "text": "ここに不正解の選択肢3を入れる",
      "isCorrect": false
    }
  ]
}
\`\`\`

# 要件
- 正解の選択肢は必ず1つだけにしてください
- 不正解の選択肢は、正解に似ているが明らかに異なるものにしてください
- 不正解の選択肢は、正解の内容に関連しているが誤った情報を含むものにしてください
- 選択肢はどの選択肢が正解でも構いません（a, b, c, dのどれか一つが正解）
- JSONのみを出力し、余計な説明や補足は不要です
`;

    console.log('Gemini APIを呼び出し中...');
    
    // Gemini APIを呼び出して4択問題を生成
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
        if (!jsonResponse || !jsonResponse.choices || !Array.isArray(jsonResponse.choices) || jsonResponse.choices.length !== 4) {
          console.error('JSON形式が不正です:', jsonResponse);
          throw new Error('JSON形式が不正です');
        }
        
        // 選択肢をシャッフル（正解がランダムな位置になるように）
        const choices = jsonResponse.choices;
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
        
        jsonResponse.choices = choices;
        
        // 4択問題のJSONを返す
        return NextResponse.json({
          success: true,
          message: '4択問題の生成に成功しました',
          data: jsonResponse
        });
      } catch (jsonError) {
        console.error('JSON解析エラー:', jsonError);
        
        // APIからの応答が不正な場合のフォールバック
        const fallbackChoices: Choice[] = [
          { id: 'a', text: cardBack, isCorrect: true },
          { id: 'b', text: '不正解の選択肢1', isCorrect: false },
          { id: 'c', text: '不正解の選択肢2', isCorrect: false },
          { id: 'd', text: '不正解の選択肢3', isCorrect: false },
        ];
        
        return NextResponse.json({
          success: true,
          message: 'デフォルトの選択肢を生成しました（JSON解析エラー）',
          data: {
            question: cardFront,
            choices: fallbackChoices
          }
        });
      }
    } catch (apiError) {
      console.error('Gemini API呼び出しエラー:', apiError);
      
      // API呼び出しエラー時のフォールバック
      const errorFallbackChoices: Choice[] = [
        { id: 'a', text: cardBack, isCorrect: true },
        { id: 'b', text: '別の答え1', isCorrect: false },
        { id: 'c', text: '別の答え2', isCorrect: false },
        { id: 'd', text: '別の答え3', isCorrect: false },
      ];
      
      return NextResponse.json({
        success: true,
        message: 'デフォルトの選択肢を生成しました（API呼び出しエラー）',
        data: {
          question: cardFront,
          choices: errorFallbackChoices
        }
      });
    }
  } catch (error) {
    console.error('4択問題生成エラー:', error);
    return NextResponse.json(
      { success: false, message: '4択問題の生成に失敗しました', error },
      { status: 500 }
    );
  }
}
