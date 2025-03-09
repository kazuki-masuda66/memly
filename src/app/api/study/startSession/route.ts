import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-admin';
import { v4 as uuidv4 } from 'uuid';

// リクエストの型定義
interface StartSessionRequest {
  deckIds: number[];
  mode: 'flashcard' | 'quiz' | 'truefalse';
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as StartSessionRequest;
    const { deckIds, mode } = body;

    if (!deckIds || !Array.isArray(deckIds) || deckIds.length === 0) {
      return NextResponse.json(
        { success: false, message: 'デッキIDが指定されていません' },
        { status: 400 }
      );
    }

    if (!mode) {
      return NextResponse.json(
        { success: false, message: '学習モードが指定されていません' },
        { status: 400 }
      );
    }

    // セッションID生成
    const sessionId = uuidv4();
    let mockMode = false;

    try {
      // テーブルが存在するか確認
      const { error: tableCheckError } = await supabase
        .from('study_sessions')
        .select('id')
        .limit(1);

      if (tableCheckError) {
        console.error('テーブル情報取得エラー:', tableCheckError);
        console.log('テーブルが存在しないため、モックデータを使用します');
        mockMode = true;
      }

      if (!mockMode) {
        // 実際のデータベース操作
        // 1. セッション作成
        const { error: sessionError } = await supabase
          .from('study_sessions')
          .insert({
            id: sessionId,
            user_id: 'dummy-user-id', // 実際の認証システムと連携する場合は変更
            mode: mode,
            status: 'in_progress',
            start_time: new Date().toISOString(),
          });

        if (sessionError) {
          console.error('セッション作成エラー:', sessionError);
          mockMode = true;
        } else {
          // 2. セッションとデッキの関連付け
          const sessionDecks = deckIds.map(deckId => ({
            session_id: sessionId,
            deck_id: deckId,
          }));

          const { error: deckSessionError } = await supabase
            .from('session_decks')
            .insert(sessionDecks);

          if (deckSessionError) {
            console.error('セッションデッキ関連付けエラー:', deckSessionError);
            // エラーがあっても処理を続行
          }
        }
      }

      // カード数を取得（実際のカード数または推定値）
      let totalCards = 0;
      try {
        const { data: cardsData, error: cardsError } = await supabase
          .from('flashcards')
          .select('id')
          .in('deck_id', deckIds)
          .eq('deleted_flag', false);

        if (cardsError) {
          console.error('カード数取得エラー:', cardsError);
          totalCards = deckIds.length * 5; // 推定値
        } else {
          totalCards = cardsData?.length || 0;
        }
      } catch (error) {
        console.error('カード数取得例外:', error);
        totalCards = deckIds.length * 5; // 推定値
      }

      // 成功レスポンス
      return NextResponse.json({
        success: true,
        sessionId: sessionId,
        deckIds: deckIds, // デッキIDを返す
        mode: mode,
        totalCards: totalCards,
        mockMode: mockMode, // モックモードかどうかを返す
      });
    } catch (error) {
      console.error('セッション作成例外:', error);
      // エラーが発生しても、セッションIDとデッキIDを返す
      return NextResponse.json({
        success: true,
        sessionId: sessionId,
        deckIds: deckIds,
        mode: mode,
        totalCards: deckIds.length * 5, // 推定値
        mockMode: true,
      });
    }
  } catch (error) {
    console.error('リクエスト処理エラー:', error);
    return NextResponse.json(
      { success: false, message: 'リクエストの処理に失敗しました' },
      { status: 500 }
    );
  }
} 