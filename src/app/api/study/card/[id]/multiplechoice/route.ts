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
  try {
    const cardId = params.id;
    
    if (!cardId) {
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
        { success: false, message: 'カードの取得に失敗しました' },
        { status: 500 }
      );
    }
    
    if (!cardData) {
      return NextResponse.json(
        { success: false, message: '指定されたカードが見つかりません' },
        { status: 404 }
      );
    }

    // 同じデッキの他のカードを取得（AIへのコンテキスト情報として）
    const { data: deckCardsData, error: deckCardsError } = await supabase
      .from('flashcards')
      .select('front, back')
      .eq('deck_id', cardData.deck_id)
      .limit(10); // コンテキスト用に最大10枚まで取得
    
    if (deckCardsError) {
      console.error('デッキ内カード取得エラー:', deckCardsError);
      // エラーが発生しても処理は続行（コンテキスト情報がなくても生成は可能）
    }

    // Google API Keyが設定されているか確認
    const googleApiKey = process.env.GOOGLE_API_KEY;
    if (!googleApiKey) {
      console.error('GOOGLE_API_KEYが環境変数に設定されていません');
      return NextResponse.json(
        { 
          success: false, 
          message: 'Google API Keyが設定されていません。環境変数GOOGLE_API_KEYを設定してください。',
          error: 'GOOGLE_API_KEY_NOT_FOUND'
        },
        { status: 500 }
      );
    }

    console.log('Google API Keyが見つかりました、Gemini APIを初期化します');

    // Gemini APIクライアントを初期化
    const genAI = new GoogleGenerativeAI(googleApiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-pro',
      systemInstruction: '日本語で出力します。学習者のためのフラッシュカードの内容から4択問題を生成します。問題は明確で、選択肢は1つだけが正解で、他の3つは妥当な誤答である必要があります。'
    });

    // デッキのタイトルとカードの表裏の内容を取得
    const deckTitle = cardData.decks.title;
    const cardFront = cardData.front;
    const cardBack = cardData.back;
    
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
        if (card.front !== cardFront) { // 現在のカードと異なるものだけ追加
          prompt += `カード${index + 1}:\n- 表面: ${card.front}\n- 裏面: ${card.back}\n\n`;
        }
      });
    }

    prompt += `
# 出力形式
以下のJSON形式で出力してください:
{
  "question": "問題文をここに記述",
  "choices": [
    {
      "id": "a",
      "text": "選択肢1のテキスト",
      "isCorrect": true
    },
    {
      "id": "b",
      "text": "選択肢2のテキスト",
      "isCorrect": false
    },
    {
      "id": "c",
      "text": "選択肢3のテキスト",
      "isCorrect": false
    },
    {
      "id": "d",
      "text": "選択肢4のテキスト",
      "isCorrect": false
    }
  ]
}

# 要件
- 問題文は「${cardFront}」に関する問題にしてください
- 選択肢の中に必ず「${cardBack}」に関連する正解を1つ含めてください
- 他の選択肢は紛らわしいが明らかに間違っているものにしてください
- 選択肢はシャッフルして、正解がランダムな位置になるようにしてください
- 出力はJSON形式のみにしてください
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
          console.log('有効なJSONを抽出しました', jsonResponse);
        } else {
          console.error('JSONが見つかりません。Geminiの出力:', text);
          throw new Error('JSONが見つかりません');
        }
        
        // 4択問題の形式を検証
        if (!jsonResponse.question || !jsonResponse.choices || jsonResponse.choices.length !== 4) {
          throw new Error('生成された4択問題のフォーマットが不正です');
        }

        // 正解が1つだけあることを確認
        const correctChoices = jsonResponse.choices.filter((choice: Choice) => choice.isCorrect);
        if (correctChoices.length !== 1) {
          throw new Error('正解が1つだけ含まれていることを確認できません');
        }

        return NextResponse.json({
          success: true,
          data: jsonResponse
        });
      } catch (jsonError) {
        console.error('JSON解析エラー:', jsonError, 'Geminiの出力:', text);
        return NextResponse.json(
          { 
            success: false, 
            message: 'AIからの応答の解析に失敗しました', 
            error: (jsonError as Error).message,
            rawOutput: text
          },
          { status: 500 }
        );
      }
    } catch (geminiError: any) {
      console.error('Gemini API呼び出しエラー:', geminiError);
      return NextResponse.json(
        { 
          success: false, 
          message: '4択問題の生成に失敗しました', 
          error: geminiError?.message || 'Unknown error' 
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('4択問題生成エラー:', error);
    return NextResponse.json(
      { success: false, message: '4択問題の生成中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
