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
    
    // セッション情報を取得
    try {
      const { data: sessionData, error: sessionError } = await supabase
        .from('study_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();
      
      if (sessionError) {
        console.error('セッション取得エラー:', sessionError);
        
        // セッションが見つからない場合でも、deckIdsが指定されていれば、ダミーセッションを返す
        if (deckIds.length > 0) {
          console.log('セッションが見つからないため、ダミーデータを返します');
          return NextResponse.json({
            success: true,
            session: {
              id: sessionId,
              mode: 'flashcard',
              status: 'in_progress',
              deckIds: deckIds,
              totalCards: 0, // カード数は後で取得
              start_time: new Date().toISOString(),
              mockMode: true
            }
          });
        }
        
        return NextResponse.json({
          success: true,
          session: {
            id: sessionId,
            mode: 'flashcard',
            status: 'in_progress',
            deckIds: [],
            totalCards: 5,
            start_time: new Date().toISOString(),
            mockMode: true
          }
        });
      }
      
      if (!sessionData) {
        console.log('セッションが見つからないため、ダミーデータを返します');
        return NextResponse.json({
          success: true,
          session: {
            id: sessionId,
            mode: 'flashcard',
            status: 'in_progress',
            deckIds: deckIds.length > 0 ? deckIds : [],
            totalCards: 5,
            start_time: new Date().toISOString(),
            mockMode: true
          }
        });
      }
      
      // セッションに関連するデッキIDを取得
      let sessionDeckIds: number[] = [];
      
      if (sessionData.deck_id) {
        // 単一デッキの場合
        sessionDeckIds = [sessionData.deck_id];
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
            sessionDeckIds = deckSessionData.map(item => item.deck_id);
          }
        } catch (error) {
          console.error('セッションデッキ取得例外:', error);
        }
      }
      
      // URLから取得したデッキIDがある場合は、それを優先
      const finalDeckIds = deckIds.length > 0 ? deckIds : sessionDeckIds;
      
      // カード数を取得
      let totalCards = 0;
      try {
        const { data: cardsData, error: cardsError } = await supabase
          .from('flashcards')
          .select('id')
          .in('deck_id', finalDeckIds)
          .eq('deleted_flag', false);
        
        if (cardsError) {
          console.error('カード数取得エラー:', cardsError);
        } else {
          totalCards = cardsData?.length || 0;
        }
      } catch (error) {
        console.error('カード数取得例外:', error);
      }
      
      // レスポンスを返す
      return NextResponse.json({
        success: true,
        session: {
          id: sessionData.id,
          mode: sessionData.mode,
          status: sessionData.status,
          deckIds: finalDeckIds,
          totalCards: totalCards,
          start_time: sessionData.start_time,
          end_time: sessionData.end_time,
          mockMode: false
        }
      });
    } catch (error) {
      console.error('セッション取得例外:', error);
      
      // エラーが発生した場合はダミーのセッションデータを返す（開発用）
      return NextResponse.json({
        success: true,
        session: {
          id: sessionId,
          mode: 'flashcard',
          status: 'in_progress',
          deckIds: deckIds.length > 0 ? deckIds : [],
          totalCards: 5,
          start_time: new Date().toISOString(),
          mockMode: true
        }
      });
    }
  } catch (error) {
    console.error('セッション取得エラー:', error);
    
    return NextResponse.json(
      { success: false, message: 'セッションの取得に失敗しました' },
      { status: 500 }
    );
  }
} 