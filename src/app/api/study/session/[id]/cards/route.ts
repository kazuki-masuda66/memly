import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-admin';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = params.id;
    const url = new URL(request.url);
    // URLからデッキIDを取得（クエリパラメータとして渡す）
    const deckIdParam = url.searchParams.get('deckId');
    let deckIds: number[] = [];
    
    if (deckIdParam) {
      // URLからデッキIDを取得できた場合は、それを使用
      try {
        if (deckIdParam.includes(',')) {
          // カンマ区切りの複数デッキID
          deckIds = deckIdParam.split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id));
        } else {
          // 単一デッキID
          const deckId = parseInt(deckIdParam, 10);
          if (!isNaN(deckId)) {
            deckIds = [deckId];
          }
        }
        console.log('URLから取得したデッキID:', deckIds);
      } catch (error) {
        console.error('デッキID解析エラー:', error);
      }
    }
    
    if (!sessionId) {
      return NextResponse.json(
        { success: false, message: 'セッションIDが指定されていません' },
        { status: 400 }
      );
    }
    
    // デッキIDが指定されている場合は、そのデッキからカードを取得
    if (deckIds.length > 0) {
      console.log('指定されたデッキからカードを取得します:', deckIds);
      return await getCardsFromDecks(deckIds);
    }
    
    // デッキIDが指定されていない場合は、セッション情報を取得
    try {
      const { data: sessionData, error: sessionError } = await supabase
        .from('study_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();
      
      if (sessionError) {
        console.error('セッション取得エラー:', sessionError);
        
        // セッションが見つからない場合でも、deckIdsが指定されていれば、そのデッキのカードを取得
        if (deckIds.length === 0) {
          console.log('セッションが見つからず、デッキIDも指定されていないため、ダミーカードデータを返します');
          return NextResponse.json({
            success: true,
            cards: generateDummyCards(5),
          });
        }
      } else if (sessionData) {
        // セッションが見つかった場合は、そのセッションのデッキIDを使用
        if (sessionData.deck_id) {
          deckIds = [sessionData.deck_id];
        } else {
          try {
            // 複数デッキの場合は中間テーブルから取得
            const { data: deckSessionData, error: deckSessionError } = await supabase
              .from('session_decks')
              .select('deck_id')
              .eq('session_id', sessionId);
            
            if (deckSessionError) {
              console.error('セッションデッキ取得エラー:', deckSessionError);
            } else if (deckSessionData && deckSessionData.length > 0) {
              deckIds = deckSessionData.map(item => item.deck_id);
            }
          } catch (error) {
            console.error('セッションデッキ取得例外:', error);
          }
        }
      }
    } catch (error) {
      console.error('セッション取得例外:', error);
      // エラーが発生しても、deckIdsが指定されていれば処理を続行
    }
    
    // デッキIDが取得できなかった場合はダミーデータを返す
    if (deckIds.length === 0) {
      console.log('デッキIDが取得できなかったため、ダミーカードデータを返します');
      return NextResponse.json({
        success: true,
        cards: generateDummyCards(5),
      });
    }
    
    return await getCardsFromDecks(deckIds);
  } catch (error) {
    console.error('カード取得エラー:', error);
    
    // エラーが発生した場合はダミーのカードデータを返す（開発用）
    return NextResponse.json({
      success: true,
      cards: generateDummyCards(5),
    });
  }
}

// 指定されたデッキからカードを取得する関数
async function getCardsFromDecks(deckIds: number[]) {
  try {
    console.log('以下のデッキからカードを取得します:', deckIds);
    
    // カード情報を取得
    const { data: cardsData, error: cardsError } = await supabase
      .from('flashcards')
      .select('id, front, back, front_rich, back_rich')
      .in('deck_id', deckIds)
      .eq('deleted_flag', false)
      .order('id');
    
    if (cardsError) {
      console.error('カード取得エラー:', cardsError);
      return NextResponse.json({
        success: true,
        cards: generateDummyCards(5),
      });
    }
    
    // カードが見つからない場合はダミーデータを返す
    if (!cardsData || cardsData.length === 0) {
      console.log('カードが見つからないため、ダミーカードデータを返します');
      return NextResponse.json({
        success: true,
        cards: generateDummyCards(5),
      });
    }
    
    console.log(`${cardsData.length}枚のカードを取得しました`);
    
    // カードをシャッフル
    const shuffledCards = [...cardsData].sort(() => Math.random() - 0.5);
    
    return NextResponse.json({
      success: true,
      cards: shuffledCards,
    });
  } catch (error) {
    console.error('カード取得例外:', error);
    return NextResponse.json({
      success: true,
      cards: generateDummyCards(5),
    });
  }
}

// ダミーのカードデータを生成する関数
function generateDummyCards(count: number) {
  const dummyCards = [];
  
  for (let i = 1; i <= count; i++) {
    dummyCards.push({
      id: `dummy-${i}`,
      front: `サンプル問題 ${i}`,
      back: `サンプル解答 ${i}`,
      front_rich: `<p>サンプル問題 ${i}</p>`,
      back_rich: `<p>サンプル解答 ${i}</p>`,
    });
  }
  
  return dummyCards;
} 