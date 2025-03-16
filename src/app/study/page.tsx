'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

// デッキの型定義
interface Deck {
  id: number;
  title: string;
  description?: string;
  card_count?: number;
  status: string;
  created_at: string;
  updated_at: string;
}

// SearchParamsを取得するコンポーネント
function StudyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deckIdFromUrl = searchParams.get('deckId');
  
  // 状態管理
  const [decks, setDecks] = useState<Deck[]>([]);
  const [selectedDeckIds, setSelectedDeckIds] = useState<number[]>([]);
  const [studyMode, setStudyMode] = useState<'flashcard' | 'quiz' | 'truefalse'>('flashcard');
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // デッキ一覧を取得
  useEffect(() => {
    const fetchDecks = async () => {
      try {
        const response = await fetch('/api/decks');
        if (!response.ok) {
          throw new Error('デッキの取得に失敗しました');
        }
        const data = await response.json();
        if (data.success) {
          // カード数を含むデッキ情報を設定
          setDecks(data.decks);
          
          // URLからデッキIDが指定されていれば、それを選択状態にする
          if (deckIdFromUrl) {
            const deckId = parseInt(deckIdFromUrl, 10);
            if (!isNaN(deckId)) {
              setSelectedDeckIds([deckId]);
            }
          }
        } else {
          setError(data.message || 'デッキの取得に失敗しました');
        }
      } catch (error) {
        console.error('デッキ取得エラー:', error);
        setError('デッキの取得中にエラーが発生しました');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDecks();
  }, [deckIdFromUrl]);

  // デッキの選択状態を切り替える
  const toggleDeckSelection = (deckId: number) => {
    setSelectedDeckIds(prev => {
      if (prev.includes(deckId)) {
        return prev.filter(id => id !== deckId);
      } else {
        return [...prev, deckId];
      }
    });
  };

  // 学習モードを変更する
  const handleModeChange = (value: string) => {
    setStudyMode(value as 'flashcard' | 'quiz' | 'truefalse');
  };

  // 学習を開始する
  const startStudy = async () => {
    if (selectedDeckIds.length === 0) {
      setError('学習するデッキを選択してください');
      return;
    }

    setIsStarting(true);
    setError(null);

    try {
      const response = await fetch('/api/study/startSession', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deckIds: selectedDeckIds,
          mode: studyMode,
        }),
      });

      if (!response.ok) {
        throw new Error('学習セッションの開始に失敗しました');
      }

      const data = await response.json();
      if (data.success) {
        // セッションIDを取得して学習画面に遷移
        const sessionId = data.sessionId;
        // デッキIDとモードを明示的にURLパラメータとして渡す
        const deckIdParam = selectedDeckIds.join(',');
        console.log(`学習開始: セッションID=${sessionId}, デッキID=${deckIdParam}, モード=${studyMode}`);
        router.push(`/study/session/${sessionId}?deckId=${deckIdParam}&mode=${studyMode}&forceQuiz=${studyMode === 'quiz' ? 'true' : 'false'}`);
      } else {
        setError(data.message || '学習セッションの開始に失敗しました');
        setIsStarting(false);
      }
    } catch (error) {
      console.error('学習開始エラー:', error);
      setError('学習セッションの開始中にエラーが発生しました');
      setIsStarting(false);
    }
  };

  // ローディング中の表示
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent mb-4"></div>
        <p className="text-lg">デッキ情報を読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">学習モード選択</h1>
      
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-600">
          {error}
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* 学習モード選択 */}
        <div>
          <h2 className="text-xl font-semibold mb-4">学習モード</h2>
          <div className="border rounded-lg p-6 shadow-sm">
            <div className="space-y-4">
              <div className="flex items-start space-x-2 mb-4">
                <input 
                  type="radio" 
                  id="flashcard" 
                  name="studyMode" 
                  value="flashcard"
                  checked={studyMode === 'flashcard'}
                  onChange={() => handleModeChange('flashcard')}
                  className="mt-1"
                />
                <div>
                  <label htmlFor="flashcard" className="font-medium block">一問一答</label>
                  <p className="text-sm text-gray-500">
                    問題と答えのカードを順番に表示し、理解度に応じて「超簡単」「容易」「難しい」「忘却」の4段階で評価しながら学習します。
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-2 mb-4">
                <input 
                  type="radio" 
                  id="quiz" 
                  name="studyMode" 
                  value="quiz"
                  checked={studyMode === 'quiz'}
                  onChange={() => handleModeChange('quiz')}
                  className="mt-1"
                />
                <div>
                  <label htmlFor="quiz" className="font-medium block">選択肢(4択)</label>
                  <p className="text-sm text-gray-500">
                    問題に対する4つの選択肢から正解を選ぶクイズ形式です。知識の定着度を客観的に測れます。
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-2">
                <input 
                  type="radio" 
                  id="truefalse" 
                  name="studyMode" 
                  value="truefalse"
                  checked={studyMode === 'truefalse'}
                  onChange={() => handleModeChange('truefalse')}
                  className="mt-1"
                />
                <div>
                  <label htmlFor="truefalse" className="font-medium block">正誤判定</label>
                  <p className="text-sm text-gray-500">
                    問題に対して「正」か「誤」かを判断する形式です。素早く多くの問題を解くのに適しています。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* デッキ選択 */}
        <div>
          <h2 className="text-xl font-semibold mb-4">学習するデッキ</h2>
          <div className="border rounded-lg p-6 shadow-sm">
            {decks.length === 0 ? (
              <p className="text-gray-500">デッキがありません。先にデッキを作成してください。</p>
            ) : (
              <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
                {decks.map(deck => (
                  <div key={deck.id} className="flex items-start space-x-2">
                    <input
                      type="checkbox"
                      id={`deck-${deck.id}`}
                      checked={selectedDeckIds.includes(deck.id)}
                      onChange={() => toggleDeckSelection(deck.id)}
                      className="mt-1"
                    />
                    <div>
                      <label htmlFor={`deck-${deck.id}`} className="font-medium block">
                        {deck.title}
                        {deck.card_count !== undefined && (
                          <span className="ml-2 text-sm text-gray-500">
                            ({deck.card_count}枚)
                          </span>
                        )}
                      </label>
                      {deck.description && (
                        <p className="text-sm text-gray-500">{deck.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* 学習開始ボタン */}
      <div className="flex justify-center mt-8">
        <button
          className={`px-6 py-3 rounded-lg text-white font-medium ${
            isStarting || selectedDeckIds.length === 0
              ? 'bg-blue-300 cursor-not-allowed'
              : 'bg-blue-500 hover:bg-blue-600'
          }`}
          onClick={startStudy}
          disabled={isStarting || selectedDeckIds.length === 0}
        >
          {isStarting ? (
            <>
              <span className="inline-block animate-spin mr-2">⟳</span>
              学習を開始中...
            </>
          ) : (
            '学習を開始する'
          )}
        </button>
      </div>
      
      {/* 戻るリンク */}
      <div className="text-center mt-4">
        <Link href="/decks" className="text-blue-500 hover:underline">
          デッキ管理に戻る
        </Link>
      </div>
    </div>
  );
}

// メインコンポーネント
export default function StudyPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent mb-4"></div>
        <p className="text-lg">読み込み中...</p>
      </div>
    }>
      <StudyContent />
    </Suspense>
  );
} 