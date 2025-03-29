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
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [isAnswered, setIsAnswered] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [results, setResults] = useState({ correct: 0, incorrect: 0 });
  const [showResultPopup, setShowResultPopup] = useState(false);
  const [choices, setChoices] = useState<any[]>([]);
  const [allChoicesMap, setAllChoicesMap] = useState<{[key: string]: any[]}>({});
  const [isGeneratingChoices, setIsGeneratingChoices] = useState(false);
  const [isChoicesGenerated, setIsChoicesGenerated] = useState(false);
  const [choicesFetchAttempted, setChoicesFetchAttempted] = useState(false);
  const [showApiErrorPopup, setShowApiErrorPopup] = useState(false);
  const [apiErrorMessage, setApiErrorMessage] = useState('');

  // 正誤問題用の状態変数
  const [trueFalseMap, setTrueFalseMap] = useState<{[key: string]: any[]}>({});
  const [trueFalseQuestions, setTrueFalseQuestions] = useState<any[]>([]);
  const [currentTrueFalseIndex, setCurrentTrueFalseIndex] = useState(0);
  const [isTrueFalseMode, setIsTrueFalseMode] = useState(false);
  const [isTrueFalseAnswered, setIsTrueFalseAnswered] = useState(false);
  const [selectedTrueFalseAnswer, setSelectedTrueFalseAnswer] = useState<boolean | null>(null);
  const [isTrueFalseCorrect, setIsTrueFalseCorrect] = useState<boolean | null>(null);
  const [isTrueFalseGenerated, setIsTrueFalseGenerated] = useState(false);
  const [isFetchingTrueFalse, setIsFetchingTrueFalse] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // 参照変数
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
          
          // 選択されたカードを設定
          setCards(data.cards);
          
          // URLからモードを取得
          const urlParams = new URLSearchParams(window.location.search);
          const modeParam = urlParams.get('mode');
          
          // 正誤判定モードが指定されていれば自動的に切り替える
          if (modeParam === 'truefalse') {
            setIsTrueFalseMode(true);
            setInitialLoading(true);
            
            // カードが設定された後に正誤問題を生成
            if (data.cards && data.cards.length > 0) {
              fetchAllTrueFalseQuestions(data.cards, true);
            }
          } else {
            setInitialLoading(false);
            // 4択モードの場合は選択肢を取得
            if (data.session && data.session.mode === 'quiz') {
              fetchAllChoices(data.cards, sessionId);
            }
          }
        } else {
          console.error('Failed to get session info:', data.message);
        }
      } catch (error) {
        console.error('Error fetching session info:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (sessionId) {
      fetchSessionInfo();
    }
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
    if (cards && cards.length > 0) {
      setProgress(Math.round(((currentCardIndex + 1) / (cards?.length || 1)) * 100));
    }
  }, [currentCardIndex, cards]);

  // カードが読み込まれたときの処理
  useEffect(() => {
    console.log(`カード読み込み完了: cards.length=${cards ? cards.length : 0}, mode=${sessionInfo?.mode}`);
    
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
    if (cards && cards.length > 0 && isQuizMode && !apiRequestTracker.batchApiCalled) {
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
  const fetchAllChoices = async (cardsToFetch: Flashcard[] | undefined, requestId: string) => {
    // 一問一答モードの場合は選択肢生成をスキップ
    if (sessionInfo?.mode === 'flashcard' || new URLSearchParams(window.location.search).get('mode') === 'flashcard') {
      console.log('一問一答モードのため、選択肢生成をスキップします');
      setIsChoicesGenerated(true); // 選択肢生成完了フラグを立てる
      return;
    }
    
    // cardsToFetchが存在しないか、空の配列の場合は処理をスキップ
    if (!cardsToFetch || cardsToFetch.length === 0) {
      console.log('カードが0枚または未定義のため、選択肢生成をスキップします');
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
      setIsChoicesGenerated(true); // 選択肢生成完了フラグを立てる
      return;
    }
    
    try {
      setIsGeneratingChoices(true); // 選択肢生成開始
      setInitialLoading(true); // 4択問題生成中のローディング表示を有効化
      console.log(`全カードの選択肢取得開始: カード数=${cardsToFetch.length}, カードIDs=${JSON.stringify(cardIds)}`);
      
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
        // エラー時はデフォルトの選択肢を設定
        const defaultChoicesMap: {[key: string]: any[]} = {};
        cardsToFetch.forEach((card: Flashcard) => {
          defaultChoicesMap[card.id] = getDefaultChoicesForCard(card);
        });
        setAllChoicesMap(defaultChoicesMap);
        
        if (cardsToFetch.length > 0) {
          const firstCardId = cardsToFetch[0].id;
          setChoices(defaultChoicesMap[firstCardId]);
        }
        
        // エラーポップアップを表示
        const errorMessage = `選択肢生成APIの呼び出しに失敗しました。(${response.status}: ${response.statusText})`;
        setApiErrorMessage(errorMessage);
        setShowApiErrorPopup(true);
        
        throw new Error(`バッチAPI呼び出しエラー: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('バッチAPI応答:', data);
      
      if (data.success) {
        // 応答から選択肢マップを作成
        const choicesMap: {[key: string]: any[]} = {};
        
        // レスポンスから各カードの選択肢をマップに格納（並び替えてから保存）
        if (data.data && data.data.cards && Array.isArray(data.data.cards)) {
          data.data.cards.forEach((card: any) => {
            if (card && card.id && card.choices && Array.isArray(card.choices)) {
              // 選択肢を並び替え
              const shuffledChoices = shuffleChoices(card.choices);
              choicesMap[card.id] = shuffledChoices;
              console.log(`カードID ${card.id} の選択肢を設定:`, shuffledChoices);
            } else {
              console.warn(`カードデータが不完全です:`, card);
              
              // 不完全なデータの場合はポップアップを表示
              if (card && card.id) {
                const errorMessage = `カードID ${card.id} のデータが不完全です。デフォルトの選択肢を使用します。`;
                setApiErrorMessage(errorMessage);
                setShowApiErrorPopup(true);
              }
            }
          });
        } else {
          console.error('バッチAPIのレスポンス形式が不正:', data);
          
          // レスポンス形式が不正な場合はポップアップを表示
          const errorMessage = 'APIのレスポンス形式が不正です。デフォルトの選択肢を使用します。';
          setApiErrorMessage(errorMessage);
          setShowApiErrorPopup(true);
        }
        
        // すべての選択肢をステートに保存
        console.log('選択肢マップを設定:', choicesMap);
        setAllChoicesMap(choicesMap);
        console.log('バッチAPIで全カードの選択肢取得完了:', Object.keys(choicesMap).length);
        
        // 現在のカードの選択肢を設定（最初のカード）
        if (cardsToFetch.length > 0) {
          const firstCardId = cardsToFetch[0].id;
          if (choicesMap[firstCardId]) {
            setChoices(choicesMap[firstCardId]);
          } else {
            console.warn(`最初のカード ${firstCardId} の選択肢がマップにありません`);
            // デフォルトの選択肢を設定
            const defaultChoices = getDefaultChoicesForCard(cardsToFetch[0]);
            setChoices(defaultChoices);
            
            // 選択肢がない場合はポップアップを表示
            const errorMessage = `カードID ${firstCardId} の選択肢が見つかりません。デフォルトの選択肢を使用します。`;
            setApiErrorMessage(errorMessage);
            setShowApiErrorPopup(true);
          }
        }
      } else {
        console.error('バッチAPI呼び出しエラー:', data.message);
        // エラー時はデフォルトの選択肢を設定
        const defaultChoicesMap: {[key: string]: any[]} = {};
        cardsToFetch.forEach((card: Flashcard) => {
          defaultChoicesMap[card.id] = getDefaultChoicesForCard(card);
        });
        setAllChoicesMap(defaultChoicesMap);
        
        if (cardsToFetch.length > 0) {
          const firstCardId = cardsToFetch[0].id;
          setChoices(defaultChoicesMap[firstCardId]);
        }
        
        // APIエラーの場合はポップアップを表示
        const errorMessage = `選択肢生成APIでエラーが発生しました: ${data.message}`;
        setApiErrorMessage(errorMessage);
        setShowApiErrorPopup(true);
        
        throw new Error(`バッチAPI呼び出しエラー: ${data.message}`);
      }
      
    } catch (error) {
      console.error('全カードの選択肢取得エラー:', error);
      
      // 例外発生時もポップアップを表示
      if (!showApiErrorPopup) {  // 既に表示されていない場合のみ
        const errorMessage = `選択肢生成中にエラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`;
        setApiErrorMessage(errorMessage);
        setShowApiErrorPopup(true);
      }
    } finally {
      setIsGeneratingChoices(false); // 選択肢生成完了
      setIsChoicesGenerated(true); // 学習開始可能に設定
      setInitialLoading(false); // 4択問題生成中のローディング表示を無効化
    }
  };

  // すべてのカードの正誤問題を一括取得する関数
  const fetchAllTrueFalseQuestions = async (cardsToFetch: Flashcard[] | undefined, forceReload = false) => {
    if (isFetchingTrueFalse) return;
    if (isTrueFalseGenerated && !forceReload) return;
    
    // cardsToFetchが存在しないか、空の配列の場合は処理をスキップ
    if (!cardsToFetch || cardsToFetch.length === 0) {
      console.log('カードが0枚または未定義のため、正誤問題生成をスキップします');
      setIsTrueFalseGenerated(true);
      setIsFetchingTrueFalse(false);
      setInitialLoading(false);
      return;
    }
    
    try {
      setIsFetchingTrueFalse(true);
      
      // APIリクエスト
      const response = await fetch('/api/study/card/truefalse/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cards: cardsToFetch }),
      });
      
      if (!response.ok) {
        throw new Error(`API エラー: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        // 正誤問題データを設定
        setTrueFalseMap(data.trueFalseMap);
        setIsTrueFalseGenerated(true);
        
        // 全ての正誤問題を配列に変換
        const allQuestions: any[] = [];
        if (data.trueFalseMap) {
          Object.keys(data.trueFalseMap).forEach(cardId => {
            if (data.trueFalseMap[cardId]) {
              data.trueFalseMap[cardId].forEach((question: any) => {
                allQuestions.push({
                  ...question,
                  cardId
                });
              });
            }
          });
        }
        
        // 問題をシャッフル
        const shuffledQuestions = shuffleArray([...allQuestions]);
        setTrueFalseQuestions(shuffledQuestions);
        
        // 確実に正誤問題モードになるようにフラグを設定
        setIsTrueFalseMode(true);
      } else {
        setApiErrorMessage(data.message || 'エラーが発生しました');
        setShowApiErrorPopup(true);
      }
    } catch (error) {
      console.error('正誤問題取得エラー:', error);
      setApiErrorMessage(`正誤問題の取得中にエラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
      setShowApiErrorPopup(true);
    } finally {
      setIsFetchingTrueFalse(false);
      setInitialLoading(false);
    }
  };

  // 配列をシャッフルする関数
  const shuffleArray = (array: any[]) => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  // デフォルトの選択肢を取得する関数
  const getDefaultChoices = () => {
    if (!cards || currentCardIndex >= cards.length) {
      console.warn('カードが存在しないため、デフォルト選択肢を返します');
      return [
        { id: 'A', text: '正解', isCorrect: true },
        { id: 'B', text: '不正解の選択肢1', isCorrect: false },
        { id: 'C', text: '不正解の選択肢2', isCorrect: false },
        { id: 'D', text: '不正解の選択肢3', isCorrect: false },
      ];
    }
    
    const backText = cards[currentCardIndex]?.back || '正解';
    return [
      { id: 'A', text: backText, isCorrect: true },
      { id: 'B', text: `不正解の選択肢1（${backText}とは異なる答え）`, isCorrect: false },
      { id: 'C', text: `不正解の選択肢2（${backText}とは異なる答え）`, isCorrect: false },
      { id: 'D', text: `不正解の選択肢3（${backText}とは異なる答え）`, isCorrect: false },
    ];
  };
  
  // 特定のカード用のデフォルト選択肢を生成する関数
  const getDefaultChoicesForCard = (card: Flashcard) => {
    const backText = card?.back || '正解';
    return [
      { id: 'A', text: backText, isCorrect: true },
      { id: 'B', text: `不正解の選択肢1（${backText}とは異なる答え）`, isCorrect: false },
      { id: 'C', text: `不正解の選択肢2（${backText}とは異なる答え）`, isCorrect: false },
      { id: 'D', text: `不正解の選択肢3（${backText}とは異なる答え）`, isCorrect: false },
    ];
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

  // 選択肢を選択した時の処理
  const handleChoiceSelect = (choiceId: string) => {
    if (isAnswered) return; // 既に回答済みの場合は何もしない
    
    setSelectedChoice(choiceId);
    setIsAnswered(true);
    
    // 選択した選択肢が正解かどうかをチェック
    if (choices && choices.length > 0) {
      const selected = choices.find(choice => choice.id === choiceId);
      const isCorrect = selected?.isCorrect || false;
      
      // 結果を更新
      setIsCorrect(isCorrect);
      setResults(prev => ({
        correct: isCorrect ? prev.correct + 1 : prev.correct,
        incorrect: !isCorrect ? prev.incorrect + 1 : prev.incorrect
      }));
    }
  };

  // カードをめくる処理
  const handleFlip = () => {
    if (isAnswered) return; // 既に回答済みの場合は何もしない
    setIsFlipped(true);
  };

  // 評価タイプの定義
  type EvaluationType = 'veryEasy' | 'easy' | 'difficult' | 'forgotten';

  // 一問一答モードでの回答処理
  const handleAnswer = (evaluationType: EvaluationType) => {
    // 評価タイプに基づいて正誤を判定
    const correct = evaluationType === 'veryEasy' || evaluationType === 'easy';
    
    // 結果を更新
    setResults(prev => ({
      correct: correct ? prev.correct + 1 : prev.correct,
      incorrect: !correct ? prev.incorrect + 1 : prev.incorrect
    }));
    
    setIsAnswered(true);
    setIsCorrect(correct);
    
    // 少し待ってから次のカードへ
    setTimeout(() => {
      handleNextCard();
    }, 500);
  };

  // 前のカードへ移動
  const handlePrevCard = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex(currentCardIndex - 1);
      setIsFlipped(false);
      setIsAnswered(false);
      setSelectedChoice(null);
      setIsCorrect(null);
      
      // 現在のカードの選択肢を設定
      if (sessionInfo?.mode === 'quiz' && cards && cards.length > 0) {
        const prevCardId = cards[currentCardIndex - 1].id;
        if (allChoicesMap[prevCardId]) {
          setChoices(allChoicesMap[prevCardId]);
        } else {
          // 選択肢がない場合はデフォルトを使用
          setChoices(getDefaultChoicesForCard(cards[currentCardIndex - 1]));
        }
      }
    }
  };

  // 次のカードへ移動
  const handleNextCard = () => {
    if (cards && currentCardIndex < cards.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1);
      setIsFlipped(false);
      setIsAnswered(false);
      setSelectedChoice(null);
      setIsCorrect(null);
      
      // 現在のカードの選択肢を設定
      if (sessionInfo?.mode === 'quiz' && cards && cards.length > 0) {
        const nextCardId = cards[currentCardIndex + 1].id;
        if (allChoicesMap[nextCardId]) {
          setChoices(allChoicesMap[nextCardId]);
        } else {
          // 選択肢がない場合はデフォルトを使用
          setChoices(getDefaultChoicesForCard(cards[currentCardIndex + 1]));
        }
      }
    } else {
      // 最後のカードの場合は学習完了を実行
      handleStudyComplete();
    }
  };

  // 正誤問題に回答する処理
  const handleTrueFalseAnswer = (answer: boolean) => {
    if (!trueFalseQuestions || trueFalseQuestions.length === 0 || currentTrueFalseIndex >= trueFalseQuestions.length) {
      return;
    }
    
    const currentQuestion = trueFalseQuestions[currentTrueFalseIndex];
    if (!currentQuestion) return;
    
    // 回答済みの場合は何もしない
    if (isTrueFalseAnswered) return;
    
    setSelectedTrueFalseAnswer(answer);
    setIsTrueFalseAnswered(true);
    
    // 正誤判定
    const isCorrect = answer === currentQuestion.isTrue;
    setIsTrueFalseCorrect(isCorrect);
    
    // 結果を記録
    setResults(prev => ({
      correct: isCorrect ? prev.correct + 1 : prev.correct,
      incorrect: !isCorrect ? prev.incorrect + 1 : prev.incorrect
    }));
  };

  // 次の正誤問題に進む関数
  const handleNextTrueFalseQuestion = () => {
    if (!trueFalseQuestions || trueFalseQuestions.length === 0) {
      return;
    }
    
    // 最後の問題だった場合は結果表示
    if (currentTrueFalseIndex >= trueFalseQuestions.length - 1) {
      handleStudyComplete();
      return;
    }
    
    // 次の問題に進む
    setCurrentTrueFalseIndex(currentTrueFalseIndex + 1);
    setIsTrueFalseAnswered(false);
    setSelectedTrueFalseAnswer(null);
    setIsTrueFalseCorrect(null);
  };
  
  // URLパラメータからモードを取得する
  useEffect(() => {
    if (cards && cards.length > 0 && !isLoading) {
      const urlParams = new URLSearchParams(window.location.search);
      const modeParam = urlParams.get('mode');
      
      // URLパラメータにtruefalseモードが指定されていれば自動的に切り替える
      if (modeParam === 'truefalse') {
        // 直接APIを呼び出して正誤問題を生成
        fetchAllTrueFalseQuestions(cards);
      }
    }
  }, [cards, isLoading]);

  // URLパラメータからモードを取得する
  useEffect(() => {
    if (cards && cards.length > 0 && !isLoading) {
      const urlParams = new URLSearchParams(window.location.search);
      const modeParam = urlParams.get('mode');
      
      // URLパラメータにtruefalseモードが指定されていれば自動的に切り替える
      if (modeParam === 'truefalse') {
        // 直接APIを呼び出して正誤問題を生成
        fetchAllTrueFalseQuestions(cards);
      }
    }
  }, [cards, isLoading]);

  // 学習終了時の共通処理
  const handleStudyComplete = () => {
    // 結果ポップアップを表示
    setShowResultPopup(true);
  };

  // APIエラーポップアップコンポーネント
  const ApiErrorPopup = () => {
    if (!showApiErrorPopup) return null;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full">
          <h3 className="text-xl font-bold mb-4 text-red-600">エラーが発生しました</h3>
          <p className="mb-6">{apiErrorMessage}</p>
          <p className="mb-6 text-gray-600">デフォルトの選択肢を使用して学習を続行します。</p>
          <div className="flex justify-end">
            <button
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
              onClick={() => setShowApiErrorPopup(false)}
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    );
  };

  // モードを切り替える関数
  const toggleTrueFalseMode = () => {
    // 正誤問題モードに切り替える場合
    if (!isTrueFalseMode) {
      // モード切り替え（先にフラグを変更）
      setIsTrueFalseMode(true);
      setInitialLoading(true);
      
      // まだ正誤問題が生成されていない場合は生成
      if (!isTrueFalseGenerated && cards && cards.length > 0) {
        fetchAllTrueFalseQuestions(cards);
      } else {
        // すでに生成済みの場合はローディングを終了
        setInitialLoading(false);
      }
    } else {
      // 一問一答/4択モードに戻す
      setIsTrueFalseMode(false);
    }
    
    // 状態をリセット
    setIsTrueFalseAnswered(false);
    setSelectedTrueFalseAnswer(null);
    setIsTrueFalseCorrect(null);
    setCurrentTrueFalseIndex(0);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* ヘッダー */}
      <div className="bg-white shadow-md p-4">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">学習セッション</h1>
          <div className="flex space-x-4">
            <button 
              className={`px-4 py-2 rounded-md ${!isTrueFalseMode ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
              onClick={() => {
                if (isTrueFalseMode) toggleTrueFalseMode();
              }}
            >
              {sessionInfo?.mode === 'quiz' ? '4択問題' : '一問一答'}
            </button>
            <button 
              className={`px-4 py-2 rounded-md ${isTrueFalseMode ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
              onClick={() => {
                if (!isTrueFalseMode) {
                  // 正誤問題モードへの切り替え
                  toggleTrueFalseMode();
                }
              }}
              disabled={isFetchingTrueFalse}
            >
              正誤問題
            </button>
          </div>
        </div>
      </div>

      {/* ローディング中の表示 */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin h-10 w-10 border-4 border-blue-500 rounded-full border-t-transparent mx-auto mb-4"></div>
            <p className="text-lg">学習セッション情報を読み込み中...</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 py-6">
          {/* 進捗バー */}
          <div className="bg-white shadow-sm mb-6">
            <div className="container mx-auto">
              <div className="w-full bg-gray-200 h-2">
                <div 
                  className="bg-blue-500 h-2" 
                  style={{ 
                    width: `${isTrueFalseMode 
                      ? (trueFalseQuestions && trueFalseQuestions.length > 0 
                          ? Math.round(((currentTrueFalseIndex + 1) / trueFalseQuestions.length) * 100) 
                          : 0)
                      : progress}%` 
                  }}
                ></div>
              </div>
            </div>
          </div>

          {/* 正誤問題の読み込み中モーダル */}
          {initialLoading && (
            <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4">
              <div className="bg-white rounded-lg p-8 max-w-md w-full text-center">
                <div className="animate-spin h-12 w-12 border-4 border-blue-500 rounded-full border-t-transparent mx-auto mb-4"></div>
                <h3 className="text-xl font-bold mb-2">
                  {isTrueFalseMode ? '正誤問題を生成中です' : '4択問題を生成中です'}
                </h3>
                <p className="text-gray-600 mb-4">
                  {isTrueFalseMode 
                    ? 'AIが正誤問題を作成しています。少々お待ちください...'
                    : 'AIが4択問題の選択肢を作成しています。少々お待ちください...'}
                </p>
              </div>
            </div>
          )}

          {/* メインコンテンツ */}
          <div className="container mx-auto p-4">
            {(!cards || cards.length === 0) && !initialLoading ? (
              <div className="text-center py-12">
                <p className="text-xl text-gray-600">カードが見つかりませんでした。</p>
                <button 
                  className="mt-4 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
                  onClick={() => router.push('/study')}
                >
                  学習モード選択に戻る
                </button>
              </div>
            ) : !isChoicesGenerated && sessionInfo?.mode === 'quiz' && !isTrueFalseMode ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <h3 className="text-xl font-bold mb-2">4択問題を生成中</h3>
                <p className="text-gray-600">AIが問題の選択肢を作成しています。少々お待ちください...</p>
              </div>
            ) : isTrueFalseMode ? (
              // 正誤問題モード
              <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6">
                {trueFalseQuestions && trueFalseQuestions.length > 0 ? (
                  <>
                    <div className="mb-6">
                      <h2 className="text-xl font-bold mb-2">問題 {currentTrueFalseIndex + 1}/{trueFalseQuestions.length}</h2>
                      <p 
                        className="text-lg"
                        dangerouslySetInnerHTML={{ __html: trueFalseQuestions[currentTrueFalseIndex]?.statement || '' }}
                      ></p>
                    </div>
                    
                    <div className="mb-6 flex justify-center space-x-6">
                      <button
                        className={`py-3 px-8 rounded-lg text-lg font-bold ${
                          isTrueFalseAnswered && selectedTrueFalseAnswer === true
                            ? selectedTrueFalseAnswer === trueFalseQuestions[currentTrueFalseIndex]?.isTrue
                              ? 'bg-green-500 text-white'
                              : 'bg-red-500 text-white'
                            : 'bg-blue-500 text-white hover:bg-blue-600'
                        }`}
                        onClick={() => handleTrueFalseAnswer(true)}
                        disabled={isTrueFalseAnswered}
                      >
                        ○ (正しい)
                      </button>
                      <button
                        className={`py-3 px-8 rounded-lg text-lg font-bold ${
                          isTrueFalseAnswered && selectedTrueFalseAnswer === false
                            ? selectedTrueFalseAnswer === trueFalseQuestions[currentTrueFalseIndex]?.isTrue
                              ? 'bg-green-500 text-white'
                              : 'bg-red-500 text-white'
                            : 'bg-blue-500 text-white hover:bg-blue-600'
                        }`}
                        onClick={() => handleTrueFalseAnswer(false)}
                        disabled={isTrueFalseAnswered}
                      >
                        × (誤り)
                      </button>
                    </div>
                    
                    {isTrueFalseAnswered && (
                      <div className={`p-4 rounded-lg mb-6 ${isTrueFalseCorrect ? 'bg-green-100' : 'bg-red-100'}`}>
                        <p className="font-bold mb-2">
                          {isTrueFalseCorrect ? '正解！' : '不正解...'}
                        </p>
                        <p dangerouslySetInnerHTML={{ __html: trueFalseQuestions[currentTrueFalseIndex]?.explanation || '' }}></p>
                      </div>
                    )}
                    
                    <div className="flex justify-between mt-6">
                      <div></div> {/* 左側の空白スペース */}
                      {isTrueFalseAnswered && (
                        <button
                          className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-6 rounded-lg"
                          onClick={handleNextTrueFalseQuestion}
                        >
                          {currentTrueFalseIndex < trueFalseQuestions.length - 1 ? '次の問題へ' : '結果を見る'}
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-xl text-gray-600">正誤問題の生成に失敗しました。</p>
                    <button 
                      className="mt-4 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
                      onClick={() => toggleTrueFalseMode()}
                    >
                      4択問題に戻る
                    </button>
                  </div>
                )}
              </div>
            ) : isChoicesGenerated ? (
              // 4択問題または一問一答モード
              <div className="max-w-2xl mx-auto">
                {/* カード番号と進捗 */}
                <div className="mb-4 text-center">
                  <p className="text-gray-600">カード {currentCardIndex + 1} / {cards?.length || 0}</p>
                </div>
                
                {/* カード */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                  {sessionInfo?.mode === 'quiz' ? (
                    // クイズモード
                    <>
                      <div className="mb-6">
                        <h2 className="text-xl font-bold mb-2">問題</h2>
                        <p className="text-lg">{cards[currentCardIndex]?.front}</p>
                      </div>
                      
                      <div className="space-y-3">
                        {choices && choices.length > 0 && choices.map((choice) => (
                          <button
                            key={choice.id}
                            className={`w-full text-left p-3 rounded-lg border ${
                              isAnswered && selectedChoice === choice.id
                                ? choice.isCorrect
                                  ? 'bg-green-100 border-green-500'
                                  : 'bg-red-100 border-red-500'
                                : isAnswered && choice.isCorrect
                                ? 'bg-green-100 border-green-500'
                                : 'bg-white border-gray-300 hover:bg-gray-50'
                            }`}
                            onClick={() => handleChoiceSelect(choice.id)}
                            disabled={isAnswered}
                          >
                            <span className="font-bold mr-2">{choice.id}.</span>
                            {choice.text}
                          </button>
                        ))}
                      </div>
                      
                      {isAnswered && (
                        <div className={`mt-6 p-4 rounded-lg mb-6 ${isCorrect ? 'bg-green-100' : 'bg-red-100'}`}>
                          <p className="font-bold mb-2">
                            {isCorrect ? '正解！' : '不正解...'}
                          </p>
                          <p dangerouslySetInnerHTML={{ __html: cards[currentCardIndex]?.back || '' }}></p>
                        </div>
                      )}
                    </>
                  ) : (
                    // 一問一答モード
                    <div 
                      className={`min-h-[200px] flex items-center justify-center cursor-pointer ${
                        isFlipped ? 'bg-blue-50' : 'bg-white'
                      }`}
                      onClick={handleFlip}
                    >
                      <div className="text-center p-4">
                        <p className="text-xl font-bold mb-2">
                          {isFlipped ? '答え' : '問題'}
                        </p>
                        <p className="text-lg">
                          {isFlipped ? cards[currentCardIndex]?.back : cards[currentCardIndex]?.front}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* 操作ボタン */}
                <div className="flex justify-between">
                  <button
                    className={`bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded ${
                      currentCardIndex === 0 ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-400"
                    }`}
                    onClick={handlePrevCard}
                    disabled={currentCardIndex === 0}
                  >
                    前へ
                  </button>
                  
                  {sessionInfo?.mode === 'flashcard' && isFlipped && !isAnswered && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                        onClick={() => handleAnswer('veryEasy')}
                      >
                        超簡単
                      </button>
                      <button
                        className="bg-green-400 hover:bg-green-500 text-white font-bold py-2 px-4 rounded"
                        onClick={() => handleAnswer('easy')}
                      >
                        容易
                      </button>
                      <button
                        className="bg-orange-400 hover:bg-orange-500 text-white font-bold py-2 px-4 rounded"
                        onClick={() => handleAnswer('difficult')}
                      >
                        難しい
                      </button>
                      <button
                        className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded"
                        onClick={() => handleAnswer('forgotten')}
                      >
                        忘却
                      </button>
                    </div>
                  )}
                  
                  {(isAnswered || sessionInfo?.mode === 'flashcard') && (
                    <button
                      className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
                      onClick={handleNextCard}
                    >
                      {currentCardIndex < (cards?.length ?? 0) - 1 ? '次へ' : '終了'}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <h3 className="text-xl font-bold mb-2">4択問題を生成中</h3>
                <p className="text-gray-600">AIが問題の選択肢を作成しています。少々お待ちください...</p>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* 結果ポップアップ */}
      {showResultPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-fade-in">
            <h2 className="text-2xl font-bold mb-4 text-center">
              {sessionInfo?.mode === 'quiz' ? 'クイズ完了！' : '学習完了！'}
            </h2>
            <div className="bg-blue-50 rounded-lg p-4 mb-6">
              {sessionInfo?.mode === 'quiz' ? (
                <>
                  <div className="text-center">
                    <div className="text-4xl font-bold text-blue-600 mb-2">
                      {Math.round((results.correct / (results.correct + results.incorrect)) * 100) || 0}%
                    </div>
                    <p>正答率</p>
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
                      {Math.round((results.correct / (results.correct + results.incorrect)) * 100) || 0}%
                    </div>
                    <p>正答率</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="bg-green-100 p-3 rounded text-center">
                      <div className="font-semibold text-green-700">{results.correct}</div>
                      <div className="text-sm text-green-600">覚えている</div>
                    </div>
                    <div className="bg-red-100 p-3 rounded text-center">
                      <div className="font-semibold text-red-700">{results.incorrect}</div>
                      <div className="text-sm text-red-600">復習が必要</div>
                    </div>
                  </div>
                </>
              )}
            </div>
            
            <div className="flex flex-col space-y-3">
              <button
                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded"
                onClick={() => {
                  setShowResultPopup(false);
                  router.push('/flashcards');
                }}
              >
                デッキ一覧に戻る
              </button>
              <button
                className="bg-white hover:bg-gray-100 text-blue-500 font-bold py-3 px-4 rounded border border-blue-500"
                onClick={() => {
                  setShowResultPopup(false);
                  setCurrentCardIndex(0);
                  setIsFlipped(false);
                  setIsAnswered(false);
                  setSelectedChoice(null);
                  setResults({ correct: 0, incorrect: 0 });
                  setProgress(0);
                }}
              >
                もう一度学習する
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* APIエラーポップアップ */}
      <ApiErrorPopup />
    </div>
  );
};