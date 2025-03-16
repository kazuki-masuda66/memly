'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// フラッシュカードの型定義
interface Flashcard {
  id: string;
  front: string;
  back: string;
  front_rich?: string | null;
  back_rich?: string | null;
}

// 選択肢の型定義（4択問題用）
interface Choice {
  id: string;
  text: string;
  isCorrect: boolean;
}

// 学習セッションの型定義
interface StudySession {
  id: string;
  mode: 'flashcard' | 'quiz' | 'truefalse';
  deckIds: number[];
  totalCards: number;
}

// セッション情報の型定義
interface SessionInfo {
  id: string;
  mode: string;
  status: string;
  deckIds: number[];
  totalCards: number;
}

export default function StudySessionPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const sessionId = params.id;

  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{ correct: number; incorrect: number }>({
    correct: 0,
    incorrect: 0,
  });
  const [showResultPopup, setShowResultPopup] = useState(false);

  // セッション情報とカードを取得
  useEffect(() => {
    const fetchData = async () => {
      try {
        // URLからデッキIDを取得
        const url = new URL(window.location.href);
        const deckIdParam = url.searchParams.get('deckId');
        let deckIds: number[] = [];
        
        if (deckIdParam) {
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
        
        // デッキIDが取得できた場合は、直接カードを取得
        if (deckIds.length > 0) {
          // セッション情報を取得
          const sessionResponse = await fetch(`/api/study/session/${sessionId}`);
          if (sessionResponse.ok) {
            const sessionData = await sessionResponse.json();
            if (sessionData.success) {
              setSessionInfo(sessionData.session);
            }
          }
          
          // デッキIDを使ってカードを直接取得
          await fetchCards(deckIds);
        } else {
          // デッキIDが取得できなかった場合は、セッション情報から取得
          const response = await fetch(`/api/study/session/${sessionId}`);
          if (!response.ok) {
            throw new Error('セッション情報の取得に失敗しました');
          }
          const data = await response.json();
          if (data.success) {
            setSessionInfo(data.session);
            
            // セッション情報を取得したら、カードを取得
            if (data.session.deckIds && data.session.deckIds.length > 0) {
              await fetchCards(data.session.deckIds);
            } else {
              setError('学習するデッキが指定されていません');
              setIsLoading(false);
            }
          } else {
            setError(data.message || 'セッション情報の取得に失敗しました');
            setIsLoading(false);
          }
        }
      } catch (error) {
        console.error('データ取得エラー:', error);
        setError('データの取得中にエラーが発生しました');
        setIsLoading(false);
      }
    };

    // カードを取得する関数
    const fetchCards = async (deckIds: number[]) => {
      try {
        // deckIdsをクエリパラメータとして渡す
        const deckIdParam = deckIds.join(',');
        console.log(`カード取得: デッキID=${deckIdParam}`);
        const response = await fetch(`/api/study/session/${sessionId}/cards?deckId=${deckIdParam}`);
        if (!response.ok) {
          throw new Error('カードの取得に失敗しました');
        }
        const data = await response.json();
        if (data.success && data.cards && data.cards.length > 0) {
          setCards(data.cards);
          setIsLoading(false);
        } else {
          setError('カードが見つかりませんでした');
          setIsLoading(false);
        }
      } catch (error) {
        console.error('カード取得エラー:', error);
        setError('カードの取得中にエラーが発生しました');
        setIsLoading(false);
      }
    };

    if (sessionId) {
      fetchData();
    } else {
      setError('セッションIDが指定されていません');
      setIsLoading(false);
    }
  }, [sessionId]);

  // 進捗状況を更新
  useEffect(() => {
    if (cards.length > 0) {
      setProgress(Math.round(((currentCardIndex + 1) / cards.length) * 100));
    }
  }, [currentCardIndex, cards.length]);

  // 4択問題の選択肢を取得
  const fetchChoices = async (cardId: string) => {
    try {
      const response = await fetch(`/api/study/card/${cardId}/choices`);
      
      if (!response.ok) {
        throw new Error('選択肢の取得に失敗しました');
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || '選択肢の取得に失敗しました');
      }
      
      setChoices(data.choices);
    } catch (err) {
      console.error('選択肢取得エラー:', err);
      // デフォルトの選択肢を設定（実際のAPIが実装されるまでのダミーデータ）
      setChoices([
        { id: '1', text: cards[currentCardIndex]?.back || '正解', isCorrect: true },
        { id: '2', text: '不正解の選択肢1', isCorrect: false },
        { id: '3', text: '不正解の選択肢2', isCorrect: false },
        { id: '4', text: '不正解の選択肢3', isCorrect: false },
      ]);
    }
  };

  // カードをめくる
  const flipCard = () => {
    if (sessionInfo?.mode === 'flashcard') {
      setIsFlipped(!isFlipped);
    }
  };

  // 選択肢を選ぶ（4択問題用）
  const handleChoiceSelect = (choiceId: string) => {
    if (isAnswered) return;
    
    setSelectedChoice(choiceId);
    const selected = choices.find(choice => choice.id === choiceId);
    
    if (selected) {
      setIsCorrect(selected.isCorrect);
      setIsAnswered(true);
      
      // 統計を更新
      setResults(prev => ({
        ...prev,
        correct: prev.correct + (selected.isCorrect ? 1 : 0),
        incorrect: prev.incorrect + (selected.isCorrect ? 0 : 1),
      }));
      
      // 回答をサーバーに送信
      submitAnswer(selected.isCorrect);
    }
  };

  // 正誤を自己申告（一問一答用）
  const handleSelfAssessment = (correct: boolean) => {
    setIsCorrect(correct);
    setIsAnswered(true);
    
    // 統計を更新
    setResults(prev => ({
      ...prev,
      correct: prev.correct + (correct ? 1 : 0),
      incorrect: prev.incorrect + (correct ? 0 : 1),
    }));
    
    // 回答をサーバーに送信
    submitAnswer(correct);
  };

  // 次のカードへ進む
  const nextCard = () => {
    if (currentCardIndex < cards.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1);
      setIsFlipped(false);
    } else {
      // 全てのカードを学習し終えた場合
      setShowResultPopup(true);
    }
  };

  // 前のカードへ
  const prevCard = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex(currentCardIndex - 1);
      setIsFlipped(false);
    }
  };

  // 理解度に応じた記録と次のカードへの移動
  const markAsUltraEasy = () => {
    setResults(prev => ({ ...prev, correct: prev.correct + 1 }));
    submitAnswer(true, 'ultra_easy');
    nextCard();
  };

  const markAsEasy = () => {
    setResults(prev => ({ ...prev, correct: prev.correct + 1 }));
    submitAnswer(true, 'easy');
    nextCard();
  };

  const markAsHard = () => {
    setResults(prev => ({ ...prev, incorrect: prev.incorrect + 1 }));
    submitAnswer(false, 'hard');
    nextCard();
  };

  const markAsForgot = () => {
    setResults(prev => ({ ...prev, incorrect: prev.incorrect + 1 }));
    submitAnswer(false, 'forgot');
    nextCard();
  };

  // 回答をサーバーに送信（理解度追加）
  const submitAnswer = async (correct: boolean, difficulty: string = '') => {
    if (!sessionInfo || !cards[currentCardIndex]) return;
    
    try {
      const response = await fetch('/api/study/submitAnswer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          cardId: cards[currentCardIndex].id,
          correct,
          difficulty, // 理解度を追加
          timeTaken: 0, // 実際には経過時間を計測して送信
        }),
      });
      
      if (!response.ok) {
        console.error('回答の送信に失敗しました');
      }
    } catch (err) {
      console.error('回答送信エラー:', err);
    }
  };

  // セッションを完了
  const completeSession = async () => {
    // ここでセッション完了のAPIを呼び出す（実装されていない場合はスキップ）
    router.push('/decks');
  };

  // 現在のカードを取得
  const currentCard = cards[currentCardIndex];

  // ローディング中の表示
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent mb-4"></div>
        <p className="text-lg">学習セッションを読み込み中...</p>
      </div>
    );
  }

  // エラー時の表示
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md w-full">
          <h2 className="text-xl font-semibold text-red-700 mb-2">エラーが発生しました</h2>
          <p className="text-red-600 mb-4">{error}</p>
          <div className="flex justify-center">
            <Link href="/study" className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              学習モード選択に戻る
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // カードがない場合の表示
  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 max-w-md w-full">
          <h2 className="text-xl font-semibold text-yellow-700 mb-2">カードが見つかりません</h2>
          <p className="text-yellow-600 mb-4">選択したデッキにカードが登録されていないか、エラーが発生しました。</p>
          <div className="flex justify-center">
            <Link href="/study" className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              学習モード選択に戻る
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen p-4">
      {/* 結果ポップアップ */}
      {showResultPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
            <h2 className="text-2xl font-bold text-center mb-4">学習完了！</h2>
            
            <div className="flex justify-center mb-6">
              <div className="w-32 h-32 rounded-full bg-blue-50 flex items-center justify-center">
                <span className="text-3xl font-bold text-blue-600">
                  {Math.round((results.correct / cards.length) * 100)}%
                </span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-green-50 p-3 rounded-lg text-center">
                <div className="text-green-600 font-bold text-xl">{results.correct}</div>
                <div className="text-green-600">正解</div>
              </div>
              <div className="bg-red-50 p-3 rounded-lg text-center">
                <div className="text-red-600 font-bold text-xl">{results.incorrect}</div>
                <div className="text-red-600">不正解</div>
              </div>
            </div>
            
            <div className="text-center mb-6">
              <p className="text-gray-600">
                {cards.length}問中{results.correct}問正解しました！
              </p>
              {results.correct === cards.length ? (
                <p className="text-green-600 font-bold mt-2">完璧です！おめでとうございます！</p>
              ) : results.correct >= cards.length * 0.8 ? (
                <p className="text-blue-600 font-bold mt-2">素晴らしい成績です！</p>
              ) : results.correct >= cards.length * 0.6 ? (
                <p className="text-blue-600 mt-2">良い成績です。もう少し頑張りましょう！</p>
              ) : (
                <p className="text-gray-600 mt-2">もう一度復習すると良いでしょう。</p>
              )}
            </div>
            
            <div className="flex justify-center">
              <button
                onClick={completeSession}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                デッキ管理に戻る
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 学習状況 */}
      <div className="flex justify-between items-center mb-6">
        <div className="text-sm text-gray-600">
          {currentCardIndex + 1} / {cards.length}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center text-green-600">
            <span className="mr-1">✓</span>
            <span>{results.correct}</span>
          </div>
          <div className="flex items-center text-red-600">
            <span className="mr-1">✕</span>
            <span>{results.incorrect}</span>
          </div>
        </div>
      </div>

      {/* ヘッダー */}
      <div className="flex justify-between items-center mb-6">
        <Link href="/study" className="px-3 py-1 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center">
          <span className="mr-1">←</span>
          戻る
        </Link>
        <div className="text-sm text-gray-500">
          {currentCardIndex + 1} / {cards.length}
        </div>
      </div>

      {/* 進捗バー */}
      <div className="w-full bg-gray-200 h-2 rounded-full mb-8">
        <div 
          className="bg-blue-500 h-2 rounded-full" 
          style={{ width: `${progress}%` }}
        ></div>
      </div>

      {/* カード */}
      <div className="flex-grow flex flex-col items-center justify-center mb-8">
        <div
          className={`w-full max-w-2xl p-6 md:p-8 cursor-pointer transition-all duration-300 border rounded-lg shadow-md ${
            isFlipped ? 'bg-blue-50' : 'bg-white'
          }`}
          onClick={!isFlipped ? flipCard : undefined}
        >
          <div className="min-h-[200px] flex items-center justify-center">
            {isFlipped ? (
              <div>
                {currentCard.back_rich ? (
                  <div dangerouslySetInnerHTML={{ __html: currentCard.back_rich }} />
                ) : (
                  <p className="text-lg text-center">{currentCard.back}</p>
                )}
              </div>
            ) : (
              <div>
                {currentCard.front_rich ? (
                  <div dangerouslySetInnerHTML={{ __html: currentCard.front_rich }} />
                ) : (
                  <p className="text-lg text-center">{currentCard.front}</p>
                )}
              </div>
            )}
          </div>
          <div className="text-center mt-4 text-sm text-gray-500">
            {isFlipped ? '答え' : '問題 (タップでめくる)'}
          </div>
        </div>
      </div>

      {/* コントロールボタン */}
      <div className="flex flex-col md:flex-row justify-center gap-4 mb-8">
        {/* 表面表示時のコントロール */}
        {!isFlipped && (
          <button 
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center justify-center"
            onClick={flipCard}
          >
            <span className="mr-2">↻</span>
            答えを見る
          </button>
        )}

        {/* 裏面表示時のコントロール */}
        {isFlipped && (
          <div className="flex flex-row gap-2 w-full max-w-2xl justify-center">
            <button
              className="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center justify-center text-sm flex-1"
              onClick={markAsUltraEasy}
            >
              <span className="mr-1">⭐10点</span>
              超簡単
            </button>
            <button
              className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center justify-center text-sm flex-1"
              onClick={markAsEasy}
            >
              <span className="mr-1">✓4点</span>
              容易
            </button>
            <button
              className="px-3 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 flex items-center justify-center text-sm flex-1"
              onClick={markAsHard}
            >
              <span className="mr-1">▲4日</span>
              難しい
            </button>
            <button
              className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center justify-center text-sm flex-1"
              onClick={markAsForgot}
            >
              <span className="mr-1">✕10分</span>
              忘却
            </button>
          </div>
        )}
      </div>

      {/* ナビゲーションボタン */}
      <div className="flex justify-between max-w-md mx-auto w-full">
        <button
          className="px-3 py-1 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={prevCard}
          disabled={currentCardIndex === 0}
        >
          <span className="mr-1">←</span>
          前へ
        </button>
        <button
          className="px-3 py-1 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center"
          onClick={nextCard}
        >
          {currentCardIndex < cards.length - 1 ? (
            <>
              次へ
              <span className="ml-1">→</span>
            </>
          ) : (
            '完了'
          )}
        </button>
      </div>
    </div>
  );
} 