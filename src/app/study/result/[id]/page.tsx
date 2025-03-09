'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// 学習セッションの型定義
interface StudySession {
  id: string;
  mode: 'flashcard' | 'quiz' | 'truefalse';
  deckIds: number[];
  totalCards: number;
  startTime: string;
  endTime: string;
  status: 'completed' | 'canceled' | 'in_progress';
}

// 学習結果の型定義
interface StudyResult {
  correctCount: number;
  incorrectCount: number;
  totalTime: number; // 秒単位
  accuracy: number; // 0-1の範囲
  cardStats: {
    cardId: string;
    question: string;
    answer: string;
    isCorrect: boolean;
    timeTaken: number; // 秒単位
  }[];
}

export default function StudyResultPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const sessionId = params.id;

  const [session, setSession] = useState<StudySession | null>(null);
  const [result, setResult] = useState<StudyResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // セッション情報と結果を取得
  useEffect(() => {
    const fetchSessionAndResult = async () => {
      try {
        setLoading(true);
        
        // セッション情報を取得
        const sessionResponse = await fetch(`/api/study/session/${sessionId}`);
        
        if (!sessionResponse.ok) {
          throw new Error('学習セッションの取得に失敗しました');
        }
        
        const sessionData = await sessionResponse.json();
        
        if (!sessionData.success) {
          throw new Error(sessionData.message || '学習セッションの取得に失敗しました');
        }
        
        setSession(sessionData.session);
        
        // 結果情報を取得
        const resultResponse = await fetch(`/api/study/session/${sessionId}/result`);
        
        if (!resultResponse.ok) {
          throw new Error('学習結果の取得に失敗しました');
        }
        
        const resultData = await resultResponse.json();
        
        if (!resultData.success) {
          throw new Error(resultData.message || '学習結果の取得に失敗しました');
        }
        
        setResult(resultData.result);
      } catch (err) {
        setError(err instanceof Error ? err.message : '不明なエラーが発生しました');
        console.error('学習結果取得エラー:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSessionAndResult();
  }, [sessionId]);

  // 時間を「分:秒」形式に変換
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // 日付をフォーマット
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 flex flex-col items-center justify-center min-h-screen">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        <p className="mt-4 text-lg">学習結果を読み込み中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
        <div className="text-center">
          <Link href="/study" className="text-blue-500 hover:underline">
            学習モード選択に戻る
          </Link>
        </div>
      </div>
    );
  }

  if (!session || !result) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="mb-4">学習結果が見つかりません</p>
          <Link href="/study" className="text-blue-500 hover:underline">
            学習モード選択に戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">学習結果</h1>
      
      <div className="bg-white border rounded-xl shadow-lg p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h2 className="text-xl font-semibold mb-4">セッション情報</h2>
            <div className="space-y-2">
              <p>
                <span className="font-medium">学習モード:</span>{' '}
                {session.mode === 'flashcard' ? '一問一答' : 
                 session.mode === 'quiz' ? '4択問題' : '正誤問題'}
              </p>
              <p>
                <span className="font-medium">開始時間:</span>{' '}
                {formatDate(session.startTime)}
              </p>
              <p>
                <span className="font-medium">終了時間:</span>{' '}
                {formatDate(session.endTime)}
              </p>
              <p>
                <span className="font-medium">学習時間:</span>{' '}
                {formatTime(result.totalTime)}
              </p>
            </div>
          </div>
          
          <div>
            <h2 className="text-xl font-semibold mb-4">学習成績</h2>
            <div className="space-y-2">
              <p>
                <span className="font-medium">正解数:</span>{' '}
                <span className="text-green-500 font-semibold">{result.correctCount}</span>
                {' / '}{session.totalCards}
              </p>
              <p>
                <span className="font-medium">不正解数:</span>{' '}
                <span className="text-red-500 font-semibold">{result.incorrectCount}</span>
                {' / '}{session.totalCards}
              </p>
              <p>
                <span className="font-medium">正答率:</span>{' '}
                <span className={`font-semibold ${
                  result.accuracy >= 0.8 ? 'text-green-500' : 
                  result.accuracy >= 0.6 ? 'text-yellow-500' : 'text-red-500'
                }`}>
                  {Math.round(result.accuracy * 100)}%
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">正答率グラフ</h2>
        <div className="w-full h-8 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-green-500" 
            style={{ width: `${result.accuracy * 100}%` }}
          ></div>
        </div>
        <div className="flex justify-between text-sm mt-1">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">カード別結果</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border rounded-lg">
            <thead>
              <tr className="bg-gray-100">
                <th className="py-3 px-4 text-left">問題</th>
                <th className="py-3 px-4 text-left">解答</th>
                <th className="py-3 px-4 text-center">結果</th>
                <th className="py-3 px-4 text-right">回答時間</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {result.cardStats.map((stat, index) => (
                <tr key={stat.cardId} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="py-3 px-4">{stat.question}</td>
                  <td className="py-3 px-4">{stat.answer}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${
                      stat.isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {stat.isCorrect ? '正解' : '不正解'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">{formatTime(stat.timeTaken)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="flex justify-center gap-4">
        <Link href="/study" className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg">
          新しい学習を始める
        </Link>
        <Link href="/" className="px-6 py-2 border border-gray-300 hover:bg-gray-100 font-semibold rounded-lg">
          トップページへ戻る
        </Link>
      </div>
    </div>
  );
} 