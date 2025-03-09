import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-admin';

// 選択肢の型定義
interface Choice {
  id: string;
  text: string;
  isCorrect: boolean;
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
      .select('*')
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
    
    // 同じデッキの他のカードを取得（不正解の選択肢候補として）
    const { data: otherCardsData, error: otherCardsError } = await supabase
      .from('flashcards')
      .select('id, back')
      .eq('deck_id', cardData.deck_id)
      .neq('id', cardId)
      .eq('deleted_flag', false)
      .limit(10);
    
    if (otherCardsError) {
      console.error('他のカード取得エラー:', otherCardsError);
      return NextResponse.json(
        { success: false, message: '選択肢の生成に失敗しました' },
        { status: 500 }
      );
    }
    
    // 正解の選択肢
    const correctChoice: Choice = {
      id: '1',
      text: cardData.back,
      isCorrect: true,
    };
    
    // 不正解の選択肢（他のカードから最大3つ）
    let incorrectChoices: Choice[] = [];
    
    if (otherCardsData && otherCardsData.length > 0) {
      // 他のカードからランダムに選択
      const shuffledCards = [...otherCardsData].sort(() => Math.random() - 0.5);
      incorrectChoices = shuffledCards.slice(0, 3).map((card, index) => ({
        id: (index + 2).toString(), // id: 2, 3, 4
        text: card.back,
        isCorrect: false,
      }));
    }
    
    // 不正解の選択肢が足りない場合はダミーデータで補完
    while (incorrectChoices.length < 3) {
      incorrectChoices.push({
        id: (incorrectChoices.length + 2).toString(),
        text: `不正解の選択肢${incorrectChoices.length + 1}`,
        isCorrect: false,
      });
    }
    
    // 選択肢をシャッフル
    const choices: Choice[] = [correctChoice, ...incorrectChoices].sort(() => Math.random() - 0.5);
    
    return NextResponse.json({
      success: true,
      choices,
    });
  } catch (error) {
    console.error('選択肢生成エラー:', error);
    return NextResponse.json(
      { success: false, message: '選択肢の生成に失敗しました' },
      { status: 500 }
    );
  }
} 