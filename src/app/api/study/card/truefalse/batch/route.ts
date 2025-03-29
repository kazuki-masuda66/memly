import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createTrueFalseBatchPrompt } from '../../../../../../prompts/study/truefalse/batch';

// Google Generative AI APIクライアントの初期化
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

export async function POST(request: NextRequest) {
  try {
    const { cards } = await request.json();

    if (!cards || !Array.isArray(cards) || cards.length === 0) {
      return NextResponse.json({ 
        success: false, 
        message: '有効なカードデータが提供されていません' 
      }, { status: 400 });
    }

    // カードごとに正誤問題を生成
    const trueFalseQuestions = await generateTrueFalseQuestions(cards);

    return NextResponse.json({ 
      success: true, 
      trueFalseMap: trueFalseQuestions 
    });

  } catch (error) {
    console.error('正誤問題生成エラー:', error);
    return NextResponse.json({ 
      success: false, 
      message: `正誤問題の生成中にエラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}` 
    }, { status: 500 });
  }
}

// 正誤問題を生成する関数
async function generateTrueFalseQuestions(cards: any[]) {
  const trueFalseMap: { [key: string]: any[] } = {};
  
  try {
    // プロンプトファイルからプロンプトを取得
    const { systemPrompt, userPrompt } = createTrueFalseBatchPrompt(cards);

    // Gemini APIを使用して正誤問題を生成
    const result = await model.generateContent({
      contents: [
        { role: "user", parts: [{ text: systemPrompt + "\n\n" + userPrompt }] }
      ],
      generationConfig: {
        temperature: 0.7,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 8192,
      }
    });

    const response = result.response;
    const text = response.text();
    
    // JSONの部分を抽出する
    let jsonString = text;
    // テキストからJSON部分を抽出するために ```json と ``` で囲まれた部分を探す
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```\n([\s\S]*?)\n```/);
    if (jsonMatch && jsonMatch[1]) {
      jsonString = jsonMatch[1];
    }
    
    try {
      // レスポンスのパース
      const parsedResponse = JSON.parse(jsonString);
      
      // 新しいレスポンス形式を処理
      if (Array.isArray(parsedResponse)) {
        parsedResponse.forEach(item => {
          if (item.cardId && Array.isArray(item.questions)) {
            trueFalseMap[item.cardId] = item.questions.map((q: { text: string; isTrue: boolean }) => ({
              statement: q.text,
              isTrue: q.isTrue,
              explanation: q.isTrue 
                ? `これは正しい文です。` 
                : `これは誤った文です。`
            }));
          }
        });
      } 
      // 旧レスポンス形式との互換性維持
      else if (parsedResponse.questions) {
        Object.keys(parsedResponse.questions).forEach(cardId => {
          trueFalseMap[cardId] = parsedResponse.questions[cardId];
        });
      } else {
        // 代替フォーマット（AIの応答形式が異なる場合）
        cards.forEach(card => {
          const cardQuestions = parsedResponse[card.id] || [];
          if (cardQuestions.length > 0) {
            trueFalseMap[card.id] = cardQuestions;
          } else {
            // デフォルトの正誤問題を生成（APIレスポンスが期待通りでない場合）
            trueFalseMap[card.id] = generateDefaultTrueFalse(card);
          }
        });
      }
    } catch (parseError) {
      console.error('JSON解析エラー:', parseError, 'レスポンステキスト:', jsonString);
      // JSONパースエラー時はデフォルトの正誤問題を生成
      cards.forEach(card => {
        trueFalseMap[card.id] = generateDefaultTrueFalse(card);
      });
    }

    return trueFalseMap;
  } catch (error) {
    console.error('正誤問題生成中のエラー:', error);
    
    // エラー時はデフォルトの正誤問題を生成
    cards.forEach(card => {
      trueFalseMap[card.id] = generateDefaultTrueFalse(card);
    });
    
    return trueFalseMap;
  }
}

// デフォルトの正誤問題を生成する関数
function generateDefaultTrueFalse(card: any) {
  return [
    {
      statement: `${card.front}は${card.back}である。`,
      isTrue: true,
      explanation: `これは正しい文です。${card.front}は実際に${card.back}です。`
    },
    {
      statement: `${card.front}は${card.back}ではない。`,
      isTrue: false,
      explanation: `これは誤った文です。${card.front}は実際に${card.back}です。`
    }
  ];
}
