'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// グローバルなAPIリクエスト追跡用の変数
// これはモジュールレベルの変数なので、コンポーネントの再レンダリングに影響されない
const apiRequestTracker = {
  batchApiCalled: false,
  currentBatchRequestId: null as string | null,
  cardIdsProcessed: new Set<string>(),
};

// フラッシュカードの型定義
interface Flashcard {
  id: string;
  front: string;
  back: string;
  deckId: number;
  lastReviewed?: string;
  nextReview?: string;
  easeFactor?: number;
  interval?: number;
  repetitions?: number;
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
  const [isGeneratingChoices, setIsGeneratingChoices] = useState(false); // 選択肢生成中フラグ
  const [allChoicesMap, setAllChoicesMap] = useState<{[key: string]: any[]}>({});  // すべてのカードIDに対応する選択肢を保存
  const [isChoicesGenerated, setIsChoicesGenerated] = useState(false); // 全選択肢生成完了フラグ
  const [choicesFetchAttempted, setChoicesFetchAttempted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const batchApiFetchedRef = useRef(false); // useRefを使用して重複呼び出しを防止
  const batchApiRequestIdRef = useRef<string | null>(null); // バッチAPIリクエストの識別子

  // セッション情報とカードを取得
  useEffect(() => {
    const fetchSessionInfo = async () => {
      if (!sessionId) return;
      
      try {
        console.log(`学習開始: セッションID=${sessionId}`);
        
        // セッション情報を取得
        const response = await fetch(`/api/study/session/${sessionId}`);
        if (!response.ok) {
          throw new Error('セッション情報の取得に失敗しました');
        }
        
        const data = await response.json();
        if (data.success) {
          setSessionInfo(data.session);
        } else {
          console.error('セッション情報取得エラー:', data.message);
        }
      } catch (error) {
        console.error('セッション情報取得例外:', error);
      }
    };
    
    fetchSessionInfo();
  }, [sessionId]);

  // カードを取得
  useEffect(() => {
    const fetchCards = async () => {
      if (!sessionInfo || !sessionInfo.deckIds || sessionInfo.deckIds.length === 0) return;
      
      try {
        console.log('カード取得: デッキID=' + sessionInfo.deckIds);
        
        // カードを取得
        const response = await fetch(`/api/study/session/${sessionId}/cards?deckId=${sessionInfo.deckIds.join(',')}`);
        if (!response.ok) {
          throw new Error('カードの取得に失敗しました');
        }
        
        const data = await response.json();
        if (data.success) {
          // カードをシャッフル
          const shuffledCards = data.cards.sort(() => Math.random() - 0.5);
          setCards(shuffledCards);
          
          console.log(`${shuffledCards.length}枚のカードを読み込みました`);
          
          // クイズモードの場合のみ、ここで全カードの選択肢を一括生成
          if (sessionInfo.mode === 'quiz' && !apiRequestTracker.batchApiCalled) {
            console.log('クイズモードのため、ここですべての選択肢を一括生成します');
            
            // グローバル変数でAPIが呼び出されたことを記録
            apiRequestTracker.batchApiCalled = true;
            
            // 一意のリクエストIDを生成（タイムスタンプ + ランダム文字列）
            const requestId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
            apiRequestTracker.currentBatchRequestId = requestId;
            batchApiRequestIdRef.current = requestId;
            
            // バッチAPIを呼び出す前にフラグを設定
            batchApiFetchedRef.current = true;
            setChoicesFetchAttempted(true);
            
            // カードIDを記録
            shuffledCards.forEach((card: Flashcard) => apiRequestTracker.cardIdsProcessed.add(card.id));
            
            fetchAllChoices(shuffledCards, requestId);
          } else if (sessionInfo.mode !== 'quiz') {
            // 一問一答モードの場合は選択肢生成をスキップ
            console.log('一問一答モードのため、選択肢生成をスキップします');
            setIsChoicesGenerated(true); // 選択肢生成完了フラグを立てる（スキップしたので完了とみなす）
          }
        } else {
          console.error('カード取得エラー:', data.message);
          setCards([]);
        }
      } catch (error) {
        console.error('カード取得例外:', error);
        setCards([]);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchCards();
  }, [sessionInfo, sessionId]);

  // 進捗状況を更新
  useEffect(() => {
    if (cards.length > 0) {
      setProgress(Math.round(((currentCardIndex + 1) / cards.length) * 100));
    }
  }, [currentCardIndex, cards.length]);

  // カードが読み込まれたときの処理
  useEffect(() => {
    console.log(`カード読み込み完了: cards.length=${cards.length}, mode=${sessionInfo?.mode}`);
    
    // 一問一答モードの場合は選択肢生成をスキップ
    if (sessionInfo?.mode === 'flashcard') {
      console.log('一問一答モードのため、選択肢生成をスキップします');
      setIsChoicesGenerated(true); // 選択肢生成完了フラグを立てる
      return;
    }
    
    // グローバル変数でAPIが既に呼び出されている場合はスキップ
    if (apiRequestTracker.batchApiCalled) {
      console.log('バッチAPIは既に呼び出されているためスキップします');
      return;
    }
    
    // セッション情報からモードが取得できない場合はURLをチェック
    const urlParams = new URLSearchParams(window.location.search);
    const modeParam = urlParams.get('mode');
    
    let isQuizMode = sessionInfo?.mode === 'quiz';
    if (!isQuizMode && modeParam === 'quiz') {
      isQuizMode = true;
      console.log('URLからクイズモードを検出しました');
    }
    
    // 一問一答モードの場合は選択肢生成をスキップ
    if (modeParam === 'flashcard' || (!isQuizMode && modeParam !== 'quiz')) {
      console.log('一問一答モードのため、選択肢生成をスキップします');
      setIsChoicesGenerated(true); // 選択肢生成完了フラグを立てる
      return;
    }
    
    // カードが読み込まれ、クイズモードで、まだバッチAPIを呼び出していない場合のみ実行
    if (cards.length > 0 && isQuizMode && !apiRequestTracker.batchApiCalled) {
      console.log('クイズモードのため全カードの選択肢を一括取得します');
      
      // グローバル変数でAPIが呼び出されたことを記録
      apiRequestTracker.batchApiCalled = true;
      
      // 一意のリクエストIDを生成（タイムスタンプ + ランダム文字列）
      const requestId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      apiRequestTracker.currentBatchRequestId = requestId;
      batchApiRequestIdRef.current = requestId;
      
      // バッチAPIを呼び出す前にフラグを設定
      batchApiFetchedRef.current = true;
      setChoicesFetchAttempted(true);
      
      // カードIDを記録
      cards.forEach((card: Flashcard) => apiRequestTracker.cardIdsProcessed.add(card.id));
      
      fetchAllChoices(cards, requestId);
    }
  }, [cards, sessionInfo?.mode]);

  // すべてのカードの選択肢を一括取得する関数
  const fetchAllChoices = async (cardsToFetch: Flashcard[], requestId: string) => {
    // 一問一答モードの場合は選択肢生成をスキップ
    if (sessionInfo?.mode === 'flashcard' || new URLSearchParams(window.location.search).get('mode') === 'flashcard') {
      console.log('一問一答モードのため、選択肢生成をスキップします');
      setIsChoicesGenerated(true); // 選択肢生成完了フラグを立てる
      return;
    }
    
    if (cardsToFetch.length === 0) {
      setIsChoicesGenerated(true);
      return;
    }
    
    // 既に処理中なら重複実行しない
    if (isGeneratingChoices) {
      console.log('選択肢生成中のため、重複呼び出しをスキップします');
      return;
    }
    
    // グローバル変数のリクエストIDと一致しない場合は中止
    if (apiRequestTracker.currentBatchRequestId !== requestId) {
      console.log('新しいリクエストが開始されたため、古いリクエストをキャンセルします');
      return;
    }
    
    // 既に処理済みのカードIDと完全に一致する場合はスキップ
    const cardIds = cardsToFetch.map((card: Flashcard) => card.id);
    const allCardsAlreadyProcessed = cardIds.every(id => apiRequestTracker.cardIdsProcessed.has(id));
    
    if (allCardsAlreadyProcessed && Object.keys(allChoicesMap).length > 0) {
      console.log('すべてのカードは既に処理済みです');
      return;
    }
    
    try {
      setIsGeneratingChoices(true); // 選択肢生成開始
      console.log(`全カードの選択肢取得開始: カード数=${cardsToFetch.length}`);
      
      // すべてのカードのIDを抽出
      const cardIds = cardsToFetch.map((card: Flashcard) => card.id);
      
      // バッチAPIを呼び出して一括で選択肢を取得
      console.log('バッチAPIを呼び出して一括で選択肢を取得します', cardIds);
      
      const response = await fetch('/api/study/card/multiplechoice/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cardIds }),
      });
      
      if (!response.ok) {
        console.error('バッチAPIの呼び出しに失敗:', response.status, response.statusText);
        throw new Error(`バッチAPI呼び出しエラー: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        // 応答から選択肢マップを作成
        const choicesMap: {[key: string]: any[]} = {};
        
        // レスポンスから各カードの選択肢をマップに格納（並び替えてから保存）
        data.data.cards.forEach((card: any) => {
          // 選択肢を並び替え
          const shuffledChoices = shuffleChoices(card.choices);
          choicesMap[card.id] = shuffledChoices;
        });
        
        // すべての選択肢をステートに保存
        setAllChoicesMap(choicesMap);
        console.log('バッチAPIで全カードの選択肢取得完了:', Object.keys(choicesMap).length);
        
        // 現在のカードの選択肢を設定（最初のカード）
        if (cardsToFetch.length > 0) {
          const firstCardId = cardsToFetch[0].id;
          if (choicesMap[firstCardId]) {
            setChoices(choicesMap[firstCardId]);
          }
        }
      } else {
        console.error('バッチAPI呼び出しエラー:', data.message);
        throw new Error(`バッチAPI呼び出しエラー: ${data.message}`);
      }
      
    } catch (error) {
      console.error('全カードの選択肢取得エラー:', error);
    } finally {
      setIsGeneratingChoices(false); // 選択肢生成完了
      setIsChoicesGenerated(true); // 学習開始可能に設定
    }
  };

  // 4択問題の選択肢を取得（単一カード用）
  const fetchChoices = async (cardId: string) => {
    // すでに取得済みの選択肢があればそれを使用
    if (allChoicesMap[cardId]) {
      console.log(`カード${cardId}の選択肢はすでに取得済みです`);
      setChoices(allChoicesMap[cardId]);
      return;
    }
    
    try {
      setIsGeneratingChoices(true); // 選択肢生成開始
      console.log(`選択肢取得開始: cardId=${cardId}`);
      
      // APIを呼び出して選択肢を取得
      const response = await fetch(`/api/study/card/multiplechoice/${cardId}`);
      if (!response.ok) {
        console.error('選択肢取得に失敗しました:', response.status, response.statusText);
        throw new Error('選択肢の取得に失敗しました');
      }
      
      const data = await response.json();
      console.log('選択肢取得結果:', data);
      
      if (data.success && data.data && data.data.choices) {
        // 選択肢を並び替え
        const shuffledChoices = shuffleChoices(data.data.choices);
        
        // 選択肢をステートに設定
        setChoices(shuffledChoices);
        
        // 選択肢マップにも追加（キャッシュ）
        setAllChoicesMap(prev => ({
          ...prev,
          [cardId]: shuffledChoices
        }));
      } else {
        console.error('選択肢取得エラー:', data.message || '不明なエラー');
        setChoices([]);
      }
    } catch (error) {
      console.error('選択肢取得例外:', error);
      setChoices([]);
    } finally {
      setIsGeneratingChoices(false);
    }
  };

  // 選択肢をランダムに並び替える関数
  const shuffleChoices = (choices: any[]) => {
    if (!choices || choices.length === 0) return [];
    
    // 配列のコピーを作成
    const shuffled = [...choices];
    
    // 正解の選択肢を特定
    const correctChoice = shuffled.find(choice => choice.isCorrect);
    const incorrectChoices = shuffled.filter(choice => !choice.isCorrect);
    
    // 不正解の選択肢だけをシャッフル
    for (let i = incorrectChoices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [incorrectChoices[i], incorrectChoices[j]] = [incorrectChoices[j], incorrectChoices[i]];
    }
    
    // 正解と不正解をランダムな位置に配置
    const result = [];
    const correctPosition = Math.floor(Math.random() * 4); // 0-3のランダムな位置
    
    for (let i = 0; i < 4; i++) {
      if (i === correctPosition) {
        result.push(correctChoice);
      } else {
        result.push(incorrectChoices.pop());
      }
    }
    
    // ラベル（A, B, C, D）を順番に割り当て
    const labels = ['A', 'B', 'C', 'D'];
    return result.map((choice, index) => ({
      ...choice,
      id: labels[index]
    }));
  };

  // カードが変更されたときに選択肢を更新
  useEffect(() => {
    // リセット
    console.log(`カード/モード更新: currentCardIndex=${currentCardIndex}, mode=${sessionInfo?.mode}`);
    setSelectedChoice(null);
    setIsAnswered(false);
    setIsCorrect(null);
    setIsFlipped(false);
    
    // 一問一答モードの場合は選択肢を設定しない
    if (sessionInfo?.mode === 'flashcard' || new URLSearchParams(window.location.search).get('mode') === 'flashcard') {
      return;
    }
    
    // 現在のカードIDに対応する選択肢がすでに取得済みなら設定
    if (cards.length > 0 && currentCardIndex < cards.length) {
      const currentCardId = cards[currentCardIndex].id;
      
      if (allChoicesMap[currentCardId]) {
        console.log(`カードID ${currentCardId} の選択肢をマップから取得:`, allChoicesMap[currentCardId]);
        setChoices(allChoicesMap[currentCardId]);
      } else {
        console.log(`カードID ${currentCardId} の選択肢がマップにないため空に設定`);
        setChoices([]);
      }
    }
  }, [currentCardIndex, cards, sessionInfo?.mode, allChoicesMap]);

  // デフォルトの選択肢を取得する関数
  const getDefaultChoices = () => {
    const backText = cards[currentCardIndex]?.back || '正解';
    return [
      { id: 'a', text: backText, isCorrect: true },
      { id: 'b', text: `不正解の選択肢1（${backText}とは異なる答え）`, isCorrect: false },
      { id: 'c', text: `不正解の選択肢2（${backText}とは異なる答え）`, isCorrect: false },
      { id: 'd', text: `不正解の選択肢3（${backText}とは異なる答え）`, isCorrect: false },
    ];
  };

  // カードをめくる
  const flipCard = () => {
    // フラッシュカードモードならカードをめくる、クイズモードなら回答を表示する
    if (sessionInfo?.mode === 'flashcard') {
      setIsFlipped(!isFlipped);
    } else if (sessionInfo?.mode === 'quiz' && !isFlipped) {
      setIsFlipped(true);
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
      
      // 回答をめくって表示する
      setIsFlipped(true);
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
      setSelectedChoice(null);
      setIsAnswered(false);
      setIsCorrect(null);
    } else {
      // 最後のカードが終わったら結果を表示
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

  // 回答をサーバーに送信（理解度追加）
  const submitAnswer = async (correct: boolean, difficulty: string = '') => {
    if (!sessionInfo || !cards[currentCardIndex]) return;
    
    try {
      console.log('送信するリクエストデータ:', {
        sessionId,
        cardId: cards[currentCardIndex].id,
        correct,
        difficulty,
        timeTaken: 0
      });
      
      // 非同期でAPIを呼び出すが、結果を待たずに次に進む（エラーハンドリングのみ行う）
      fetch('/api/study/submitAnswer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          cardId: cards[currentCardIndex].id,
          correct,
          difficulty,
          timeTaken: 0,
        }),
      }).then(response => {
        if (!response.ok) {
          console.error('回答の送信に失敗しました', {
            status: response.status,
            statusText: response.statusText
          });
        }
      }).catch(err => {
        console.error('回答送信エラー:', err);
      });
      
      // APIの結果を待たずに処理を続行
      return true;
    } catch (err) {
      console.error('回答送信エラー (クライアント側):', err);
      // エラーが発生しても処理を続行
      return false;
    }
  };

  // 理解度に応じた記録と次のカードへの移動
  const markAsUltraEasy = () => {
    if (isSubmitting) return; // 処理中の場合は何もしない
    setIsSubmitting(true);
    
    setResults(prev => ({ ...prev, correct: prev.correct + 1 }));
    submitAnswer(true, 'ultra_easy');
    
    // 最後のカードかどうかをチェック
    if (currentCardIndex < cards.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1);
      setIsFlipped(false);
      setSelectedChoice(null);
      setIsAnswered(false);
      setIsCorrect(null);
    } else {
      // 最後のカードが終わったら結果を表示
      setShowResultPopup(true);
    }
    
    // 少し遅延させてボタンを再有効化
    setTimeout(() => setIsSubmitting(false), 500);
  };

  const markAsEasy = () => {
    if (isSubmitting) return; // 処理中の場合は何もしない
    setIsSubmitting(true);
    
    setResults(prev => ({ ...prev, correct: prev.correct + 1 }));
    submitAnswer(true, 'easy');
    
    // 最後のカードかどうかをチェック
    if (currentCardIndex < cards.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1);
      setIsFlipped(false);
      setSelectedChoice(null);
      setIsAnswered(false);
      setIsCorrect(null);
    } else {
      // 最後のカードが終わったら結果を表示
      setShowResultPopup(true);
    }
    
    // 少し遅延させてボタンを再有効化
    setTimeout(() => setIsSubmitting(false), 500);
  };

  const markAsHard = () => {
    if (isSubmitting) return; // 処理中の場合は何もしない
    setIsSubmitting(true);
    
    setResults(prev => ({ ...prev, incorrect: prev.incorrect + 1 }));
    submitAnswer(false, 'hard');
    
    // 最後のカードかどうかをチェック
    if (currentCardIndex < cards.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1);
      setIsFlipped(false);
      setSelectedChoice(null);
      setIsAnswered(false);
      setIsCorrect(null);
    } else {
      // 最後のカードが終わったら結果を表示
      setShowResultPopup(true);
    }
    
    // 少し遅延させてボタンを再有効化
    setTimeout(() => setIsSubmitting(false), 500);
  };

  const markAsForgot = () => {
    if (isSubmitting) return; // 処理中の場合は何もしない
    setIsSubmitting(true);
    
    setResults(prev => ({ ...prev, incorrect: prev.incorrect + 1 }));
    submitAnswer(false, 'forgot');
    
    // 最後のカードかどうかをチェック
    if (currentCardIndex < cards.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1);
      setIsFlipped(false);
      setSelectedChoice(null);
      setIsAnswered(false);
      setIsCorrect(null);
    } else {
      // 最後のカードが終わったら結果を表示
      setShowResultPopup(true);
    }
    
    // 少し遅延させてボタンを再有効化
    setTimeout(() => setIsSubmitting(false), 500);
  };

  // セッションを完了
  const completeSession = async () => {
    // ここでセッション完了のAPIを呼び出す（実装されていない場合はスキップ）
    router.push('/decks');
  };

  // 現在のカードを取得
  const currentCard = cards.length > 0 && currentCardIndex < cards.length ? cards[currentCardIndex] : null;

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

  // 全選択肢生成完了まで待機
  if (!isChoicesGenerated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent mb-4"></div>
        <p className="text-lg">選択肢を生成中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="text-blue-600 hover:text-blue-800 flex items-center">
            <span className="mr-2">←</span> 戻る
          </Link>
          <h1 className="text-lg font-semibold">学習セッション</h1>
          <div className="w-20"></div> {/* スペーサー */}
        </div>
      </header>
      
      {/* ローディング表示 - カード情報読み込み中 */}
      {isLoading && (
        <div className="flex-grow flex flex-col items-center justify-center">
          <div className="animate-spin h-12 w-12 border-4 border-blue-500 rounded-full border-t-transparent"></div>
          <p className="mt-4 text-lg">カード情報を読み込み中...</p>
        </div>
      )}

      {/* 選択肢生成中の表示 - クイズモードでの初期生成時 */}
      {!isLoading && isGeneratingChoices && (
        <div className="flex-grow flex flex-col items-center justify-center">
          <div className="animate-spin h-12 w-12 border-4 border-blue-500 rounded-full border-t-transparent"></div>
          <p className="mt-4 text-lg">AIがすべての問題の選択肢を生成中...</p>
          <p className="mt-2 text-sm text-gray-500">この処理は少し時間がかかります</p>
        </div>
      )}

      {/* カードがない場合の表示 */}
      {!isLoading && !isGeneratingChoices && cards.length === 0 && (
        <div className="flex-grow flex flex-col items-center justify-center">
          <div className="text-center">
            <p className="text-lg">カードが見つかりませんでした</p>
            <Link href="/" className="mt-4 inline-block px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
              ホームに戻る
            </Link>
          </div>
        </div>
      )}

      {/* 学習コンテンツ - カード読み込み完了、かつ選択肢生成完了（または一問一答モード）の場合のみ表示 */}
      {!isLoading && !isGeneratingChoices && cards.length > 0 && (sessionInfo?.mode !== 'quiz' || isChoicesGenerated) && (
        <>
          {/* 学習状況 */}
          <div className="flex justify-between items-center mb-6 container mx-auto px-4 pt-6">
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
          <div className="flex justify-between items-center mb-6 container mx-auto px-4">
            <Link href="/study" className="px-3 py-1 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center">
              <span className="mr-1">←</span>
              戻る
            </Link>
            <div className="text-sm text-gray-500">
              {currentCardIndex + 1} / {cards.length}
            </div>
          </div>

          {/* 進捗バー */}
          <div className="w-full bg-gray-200 h-2 rounded-full mb-8 container mx-auto px-4">
            <div 
              className="bg-blue-500 h-2 rounded-full" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>

          {/* カード */}
          <div className="flex-grow flex flex-col items-center justify-center mb-8 container mx-auto px-4">
            {sessionInfo?.mode === 'quiz' || new URLSearchParams(window.location.search).get('forceQuiz') === 'true' ? (
              // 選択肢(4択)モード
              <div className="w-full max-w-2xl">
                <div className="mb-4 text-center">
                  <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                    選択肢(4択)モード
                  </span>
                </div>
                {/* 問題表示 */}
                <div className="p-6 md:p-8 bg-white border rounded-lg shadow-md mb-4">
                  <div className="min-h-[100px] flex items-center justify-center">
                    <div>
                      {currentCard && currentCard.front_rich ? (
                        <div dangerouslySetInnerHTML={{ __html: currentCard.front_rich }} />
                      ) : (
                        <p className="text-lg text-center">{currentCard?.front}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* 選択肢表示 */}
                {!isAnswered && !isFlipped ? (
                  // 回答前の選択肢表示
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                    {choices.map((choice) => (
                      <button
                        key={choice.id}
                        onClick={() => handleChoiceSelect(choice.id)}
                        disabled={isAnswered}
                        className={`p-4 border rounded-lg text-left transition-colors ${
                          selectedChoice === choice.id
                            ? isAnswered
                              ? (choice.isCorrect
                                  ? 'bg-green-100 border-green-500'
                                  : 'bg-red-100 border-red-500'
                                )
                              : 'bg-blue-100 border-blue-500'
                            : ''
                        }`}
                      >
                        <span className="font-semibold">{choice.id.toUpperCase()}.</span> {choice.text}
                      </button>
                    ))}
                  </div>
                ) : (
                  // 回答後または解答表示時
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                    {choices.map((choice) => {
                      let className = 'p-4 border rounded-lg text-left ';
                      if (choice.isCorrect) {
                        className += 'border-green-500 bg-green-50';
                      } else if (selectedChoice === choice.id && !choice.isCorrect) {
                        className += 'border-red-500 bg-red-50';
                      } else {
                        className += 'border-gray-200 opacity-70';
                      }
                      return (
                        <div key={choice.id} className={className}>
                          <span className="font-semibold mr-2">{choice.id.toUpperCase()}.</span>
                          {choice.text}
                          {choice.isCorrect && (
                            <span className="ml-2 text-green-500">✓</span>
                          )}
                          {selectedChoice === choice.id && !choice.isCorrect && (
                            <span className="ml-2 text-red-500">✕</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 解説表示 */}
                {isFlipped && currentCard && (
                  <div className="p-6 md:p-8 bg-blue-50 border border-blue-200 rounded-lg shadow-md mb-4">
                    <h3 className="font-bold mb-2 text-blue-800">解説</h3>
                    <div>
                      {currentCard.back_rich ? (
                        <div dangerouslySetInnerHTML={{ __html: currentCard.back_rich }} />
                      ) : (
                        <p>{currentCard.back}</p>
                      )}
                    </div>

                    {/* 回答後の理解度評価ボタン */}
                    {isAnswered && (
                      <div className="flex flex-row gap-2 w-full max-w-2xl justify-center mt-6">
                        <button
                          className="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center justify-center text-sm flex-1"
                          onClick={markAsUltraEasy}
                          disabled={isSubmitting}
                        >
                          <span className="mr-1">⭐10点</span>
                          超簡単
                        </button>
                        <button
                          className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center justify-center text-sm flex-1"
                          onClick={markAsEasy}
                          disabled={isSubmitting}
                        >
                          <span className="mr-1">✓4点</span>
                          容易
                        </button>
                        <button
                          className="px-3 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 flex items-center justify-center text-sm flex-1"
                          onClick={markAsHard}
                          disabled={isSubmitting}
                        >
                          <span className="mr-1">▲4日</span>
                          難しい
                        </button>
                        <button
                          className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center justify-center text-sm flex-1"
                          onClick={markAsForgot}
                          disabled={isSubmitting}
                        >
                          <span className="mr-1">✕10分</span>
                          忘却
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              // 一問一答モード（フラッシュカード）
              <div
                className={`w-full max-w-2xl p-6 md:p-8 cursor-pointer transition-all duration-300 border rounded-lg shadow-md ${
                  isFlipped ? 'bg-blue-50' : 'bg-white'
                }`}
                onClick={!isFlipped ? flipCard : undefined}
              >
                <div className="min-h-[200px] flex items-center justify-center">
                  {isFlipped ? (
                    <div>
                      {currentCard && currentCard.back_rich ? (
                        <div dangerouslySetInnerHTML={{ __html: currentCard.back_rich }} />
                      ) : (
                        <p className="text-lg text-center">{currentCard?.back}</p>
                      )}
                    </div>
                  ) : (
                    <div>
                      {currentCard && currentCard.front_rich ? (
                        <div dangerouslySetInnerHTML={{ __html: currentCard.front_rich }} />
                      ) : (
                        <p className="text-lg text-center">{currentCard?.front}</p>
                      )}
                    </div>
                  )}
                </div>
                <div className="text-center mt-4 text-sm text-gray-500">
                  {isFlipped ? '答え' : '問題 (タップでめくる)'}
                </div>
                
                {/* フラッシュカードモードで裏面表示時の評価ボタン */}
                {isFlipped && sessionInfo?.mode === 'flashcard' && (
                  <div className="flex flex-row gap-2 w-full max-w-2xl justify-center mt-6">
                    <button
                      className="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center justify-center text-sm flex-1"
                      onClick={markAsUltraEasy}
                      disabled={isSubmitting}
                    >
                      <span className="mr-1">⭐10点</span>
                      超簡単
                    </button>
                    <button
                      className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center justify-center text-sm flex-1"
                      onClick={markAsEasy}
                      disabled={isSubmitting}
                    >
                      <span className="mr-1">✓4点</span>
                      容易
                    </button>
                    <button
                      className="px-3 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 flex items-center justify-center text-sm flex-1"
                      onClick={markAsHard}
                      disabled={isSubmitting}
                    >
                      <span className="mr-1">▲4日</span>
                      難しい
                    </button>
                    <button
                      className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center justify-center text-sm flex-1"
                      onClick={markAsForgot}
                      disabled={isSubmitting}
                    >
                      <span className="mr-1">✕10分</span>
                      忘却
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* コントロールボタン */}
          <div className="flex flex-col md:flex-row justify-center gap-4 mb-8 container mx-auto px-4">
            {/* 表面表示時のコントロール */}
            {!isFlipped && sessionInfo?.mode === 'flashcard' && (
              <button 
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center"
                onClick={flipCard}
              >
                <span className="mr-2">↻</span>
                答えを見る
              </button>
            )}
          </div>

          {/* ナビゲーションボタン */}
          <div className="flex justify-between max-w-md mx-auto w-full container px-4">
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
        </>
      )}
      {showResultPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-fade-in">
            <h2 className="text-2xl font-bold text-center mb-6">
              {sessionInfo?.mode === 'quiz' ? 'クイズ結果' : '学習結果'}
            </h2>
            
            <div className="bg-blue-50 rounded-lg p-4 mb-6">
              {sessionInfo?.mode === 'quiz' ? (
                <>
                  <div className="text-center">
                    <div className="text-4xl font-bold text-blue-600 mb-2">
                      {Math.round((results.correct / (results.correct + results.incorrect)) * 100)}%
                    </div>
                    <p className="text-gray-700">正答率</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="bg-green-100 p-3 rounded text-center">
                      <div className="font-semibold text-green-700">{results.correct}</div>
                      <div className="text-sm text-green-600">正解</div>
                    </div>
                    <div className="bg-red-100 p-3 rounded text-center">
                      <div className="font-semibold text-red-700">{results.incorrect}</div>
                      <div className="text-sm text-red-600">不正解</div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-center">
                    <div className="text-4xl font-bold text-blue-600 mb-2">
                      {cards.length}
                    </div>
                    <p className="text-gray-700">学習したカード</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="bg-green-100 p-3 rounded text-center">
                      <div className="font-semibold text-green-700">{results.correct}</div>
                      <div className="text-sm text-green-600">簡単</div>
                    </div>
                    <div className="bg-red-100 p-3 rounded text-center">
                      <div className="font-semibold text-red-700">{results.incorrect}</div>
                      <div className="text-sm text-red-600">難しい</div>
                    </div>
                  </div>
                </>
              )}
            </div>
            
            <div className="flex flex-col space-y-3">
              <button 
                onClick={() => {
                  // 最初のカードに戻ってやり直す
                  setCurrentCardIndex(0);
                  setIsFlipped(false);
                  setSelectedChoice(null);
                  setIsAnswered(false);
                  setIsCorrect(null);
                  setShowResultPopup(false);
                  // 結果をリセット
                  setResults({ correct: 0, incorrect: 0 });
                }}
                className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                もう一度挑戦する
              </button>
              
              <button 
                onClick={() => router.push('/decks')}
                className="py-2 px-4 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors"
              >
                デッキ一覧に戻る
              </button>
              
              <button 
                onClick={() => router.push('/')}
                className="py-2 px-4 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors"
              >
                ホーム画面に戻る
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}