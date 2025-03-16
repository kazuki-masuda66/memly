import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-admin';

// リクエストの型定義
interface SubmitAnswerRequest {
  sessionId: string;
  cardId: string;
  correct: boolean;
  timeTaken: number; // 秒単位
  difficulty?: string; // 理解度の情報（ultra_easy, easy, hard, forgot など）
}

export async function POST(request: Request) {
  try {
    // リクエストボディを取得
    const body: SubmitAnswerRequest = await request.json();
    
    // デバッグ用：受信したリクエストボディをログに出力
    console.log('受信したリクエストボディ:', JSON.stringify(body, null, 2));
    
    // バリデーション
    if (!body.sessionId) {
      return NextResponse.json(
        { success: false, message: 'セッションIDが指定されていません' },
        { status: 400 }
      );
    }
    
    if (!body.cardId) {
      return NextResponse.json(
        { success: false, message: 'カードIDが指定されていません' },
        { status: 400 }
      );
    }
    
    if (typeof body.correct !== 'boolean') {
      return NextResponse.json(
        { success: false, message: '正誤情報が指定されていません' },
        { status: 400 }
      );
    }
    
    // セッションの検証 (エラーが発生しても処理を継続)
    try {
      const { data: sessionData, error: sessionError } = await supabase
        .from('study_sessions')
        .select('*')
        .eq('id', body.sessionId)
        .single();
      
      if (sessionError) {
        console.warn(`セッション取得エラー: ${sessionError}`);
      }
      
      if (!sessionData) {
        console.warn(`セッションが見つかりません: ${body.sessionId}`);
        // セッションが存在しなくても、処理を続行
      }
    } catch (error) {
      console.warn(`セッション取得エラー: ${error}`);
      // エラーが発生しても、処理を続行
    }
    
    // 現在時刻を取得
    const now = new Date().toISOString();
    
    // データベースに保存
    try {
      await supabase
        .from('study_logs')
        .insert({
          session_id: body.sessionId,
          card_id: body.cardId,
          correct: body.correct,
          answered_at: now,
          time_taken: body.timeTaken || 0,
          difficulty: body.difficulty || null, // 難易度情報
        });

      // ユーザーのカード統計情報を更新（オプション）
      try {
        // 既存の統計情報を取得
        const { data: statData, error: statFetchError } = await supabase
          .from('user_card_stats')
          .select('*')
          .eq('card_id', body.cardId)
          .single();
        
        if (statFetchError && statFetchError.code !== 'PGRST116') { // PGRST116: 結果が見つからない
          console.error('カード統計取得エラー:', statFetchError);
        }
        
        if (statData) {
          // 既存の統計情報を更新
          const { error: statUpdateError } = await supabase
            .from('user_card_stats')
            .update({
              correct_count: statData.correct_count + (body.correct ? 1 : 0),
              wrong_count: statData.wrong_count + (body.correct ? 0 : 1),
              last_study_time: now,
              // 忘却曲線に基づく次回学習日の計算（実装例）
              due_date: new Date(Date.now() + (body.correct ? 3 : 1) * 24 * 60 * 60 * 1000).toISOString(),
              // 難易度の更新（実装例）
              difficulty: body.correct 
                ? Math.max(0, statData.difficulty - 0.1) 
                : Math.min(1, statData.difficulty + 0.1),
              updated_at: now,
            })
            .eq('id', statData.id);
          
          if (statUpdateError) {
            console.error('カード統計更新エラー:', statUpdateError);
          }
        } else {
          // 新規の統計情報を作成
          const { error: statInsertError } = await supabase
            .from('user_card_stats')
            .insert({
              card_id: body.cardId,
              correct_count: body.correct ? 1 : 0,
              wrong_count: body.correct ? 0 : 1,
              last_study_time: now,
              due_date: new Date(Date.now() + (body.correct ? 3 : 1) * 24 * 60 * 60 * 1000).toISOString(),
              difficulty: body.correct ? 0.3 : 0.7, // 初期難易度
              updated_at: now,
            });
          
          if (statInsertError) {
            console.error('カード統計作成エラー:', statInsertError);
          }
        }
      } catch (statError) {
        console.error('カード統計処理エラー:', statError);
        // 統計情報の更新に失敗しても、回答自体は記録されているので処理を続行
      }

      return NextResponse.json({
        success: true,
        message: '回答を記録しました',
      });
    } catch (error) {
      console.error('学習ログ保存エラー:', error);
      return NextResponse.json(
        { success: false, message: '学習ログの保存中にエラーが発生しました' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('回答記録エラー:', error);
    return NextResponse.json(
      { success: false, message: '回答の記録に失敗しました', error: error },
      { status: 500 }
    );
  }
} 