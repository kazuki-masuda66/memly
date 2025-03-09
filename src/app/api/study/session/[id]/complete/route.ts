import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-admin';

export async function POST(
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
    
    // 現在時刻を取得
    const now = new Date().toISOString();
    
    // セッションを完了状態に更新
    const { error: updateError } = await supabase
      .from('study_sessions')
      .update({
        status: 'completed',
        end_time: now,
        updated_at: now,
      })
      .eq('id', sessionId);
    
    if (updateError) {
      console.error('セッション更新エラー:', updateError);
      return NextResponse.json(
        { success: false, message: 'セッションの更新に失敗しました' },
        { status: 500 }
      );
    }
    
    // ユーザーの連続学習日数を更新（オプション）
    try {
      // 最後の学習日を取得
      const { data: streakData, error: streakError } = await supabase
        .from('user_streaks')
        .select('*')
        .eq('user_id', sessionData.user_id)
        .single();
      
      if (streakError && streakError.code !== 'PGRST116') { // PGRST116: 結果が見つからない
        console.error('連続学習日数取得エラー:', streakError);
      }
      
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD形式
      
      if (streakData) {
        // 最後の学習日が昨日かどうかを確認
        const lastStudyDate = new Date(streakData.last_study_date);
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        const isConsecutive = 
          lastStudyDate.toISOString().split('T')[0] === yesterday.toISOString().split('T')[0] ||
          lastStudyDate.toISOString().split('T')[0] === today;
        
        // 連続学習日数を更新
        const { error: updateStreakError } = await supabase
          .from('user_streaks')
          .update({
            streak_count: isConsecutive ? streakData.streak_count + 1 : 1,
            last_study_date: today,
          })
          .eq('user_id', sessionData.user_id);
        
        if (updateStreakError) {
          console.error('連続学習日数更新エラー:', updateStreakError);
        }
      } else {
        // 新規の連続学習日数レコードを作成
        const { error: insertStreakError } = await supabase
          .from('user_streaks')
          .insert({
            user_id: sessionData.user_id,
            streak_count: 1,
            last_study_date: today,
          });
        
        if (insertStreakError) {
          console.error('連続学習日数作成エラー:', insertStreakError);
        }
      }
    } catch (streakError) {
      console.error('連続学習日数処理エラー:', streakError);
      // 連続学習日数の更新に失敗しても、セッション自体は完了しているので処理を続行
    }
    
    // 成功レスポンスを返す
    return NextResponse.json({
      success: true,
      message: '学習セッションを完了しました',
    });
  } catch (error) {
    console.error('セッション完了エラー:', error);
    return NextResponse.json(
      { success: false, message: 'セッションの完了に失敗しました' },
      { status: 500 }
    );
  }
} 