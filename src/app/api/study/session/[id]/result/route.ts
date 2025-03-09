import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-admin';

// 学習ログの型定義
interface StudyLog {
  id: string;
  card_id: string;
  correct: boolean;
  answered_at: string;
  time_taken: number;
  flashcards: {
    id: string;
    front: string;
    back: string;
  };
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = params.id;
    
    if (!sessionId) {
      return NextResponse.json(
        { success: false, message: 'セッションIDが指定されていません' },
        { status: 400 }
      );
    }
    
    // セッション情報を取得
    const { data: sessionData, error: sessionError } = await supabase
      .from('study_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();
    
    if (sessionError) {
      console.error('セッション取得エラー:', sessionError);
      return NextResponse.json(
        { success: false, message: 'セッションの取得に失敗しました' },
        { status: 500 }
      );
    }
    
    if (!sessionData) {
      return NextResponse.json(
        { success: false, message: '指定されたセッションが見つかりません' },
        { status: 404 }
      );
    }
    
    // 学習ログを取得
    const { data: logsData, error: logsError } = await supabase
      .from('study_logs')
      .select(`
        id,
        card_id,
        correct,
        answered_at,
        time_taken,
        flashcards:card_id (
          id,
          front,
          back
        )
      `)
      .eq('session_id', sessionId)
      .order('answered_at');
    
    if (logsError) {
      console.error('学習ログ取得エラー:', logsError);
      return NextResponse.json(
        { success: false, message: '学習ログの取得に失敗しました' },
        { status: 500 }
      );
    }
    
    // 結果を集計
    const correctCount = logsData.filter(log => log.correct).length;
    const incorrectCount = logsData.length - correctCount;
    
    // 総学習時間を計算（秒単位）
    let totalTime = 0;
    
    if (sessionData.start_time && sessionData.end_time) {
      const startTime = new Date(sessionData.start_time).getTime();
      const endTime = new Date(sessionData.end_time).getTime();
      totalTime = Math.round((endTime - startTime) / 1000);
    } else {
      // 各カードの回答時間を合計
      totalTime = logsData.reduce((sum, log) => sum + (log.time_taken || 0), 0);
    }
    
    // 正答率を計算
    const accuracy = logsData.length > 0 ? correctCount / logsData.length : 0;
    
    // カード別の結果を整形
    const cardStats = logsData.map(log => ({
      cardId: log.card_id,
      question: log.flashcards ? log.flashcards.front : '',
      answer: log.flashcards ? log.flashcards.back : '',
      isCorrect: log.correct,
      timeTaken: log.time_taken || 0,
    }));
    
    // 結果オブジェクトを作成
    const result = {
      correctCount,
      incorrectCount,
      totalTime,
      accuracy,
      cardStats,
    };
    
    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error('結果取得エラー:', error);
    return NextResponse.json(
      { success: false, message: '結果の取得に失敗しました' },
      { status: 500 }
    );
  }
} 