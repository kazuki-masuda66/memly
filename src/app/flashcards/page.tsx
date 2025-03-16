'use client';

import { useState, useRef, useEffect } from 'react';
import { useCompletion } from 'ai/react';
import { useAuth, ExtendedUser } from '@/contexts/AuthContext';

// リッチテキスト表示用のカスタムCSS
const richTextStyles = `
  .flashcard-rich-content {
    text-align: left;
  }
  .flashcard-rich-content p {
    margin-bottom: 0.75rem;
  }
  .flashcard-rich-content mark {
    background-color: #fef3c7;
    padding: 0.1rem 0.2rem;
    border-radius: 0.125rem;
  }
  .flashcard-rich-content ul, .flashcard-rich-content ol {
    margin-left: 1.5rem;
    margin-bottom: 0.75rem;
  }
  .flashcard-rich-content li {
    margin-bottom: 0.25rem;
  }
  .flashcard-rich-content blockquote {
    border-left: 3px solid #d1d5db;
    padding-left: 1rem;
    margin-left: 0.5rem;
    margin-bottom: 0.75rem;
    font-style: italic;
    color: #4b5563;
  }
  .flashcard-rich-content h4 {
    font-weight: 600;
    font-size: 1.1rem;
    margin-top: 1rem;
    margin-bottom: 0.5rem;
  }
  .flashcard-rich-content h5 {
    font-weight: 600;
    font-size: 1rem;
    margin-top: 0.75rem;
    margin-bottom: 0.5rem;
  }
  .flashcard-rich-content code {
    background-color: #f3f4f6;
    padding: 0.1rem 0.2rem;
    border-radius: 0.125rem;
    font-family: monospace;
  }
`;

interface Flashcard {
  front: string;
  back: string;
  frontRich?: string; // HTML形式のリッチテキスト
  backRich?: string;  // HTML形式のリッチテキスト
  response?: string; // 解答時の理解度
}

interface FlashcardResponse {
  flashcards: Flashcard[];
}

// インターフェースを追加
interface YoutubeVideoInfo {
  title: string;
  description: string;
  publishedAt: string;
  videoId: string;
  thumbnailUrl: string;
  captions?: string; // 字幕情報を追加
}

// Webサイト関連の状態を追加
interface WebsiteInfo {
  url: string;
  textLength: number;
  fetchedAt: string;
  fetchTime: number; // 取得にかかった時間（秒）を追加
}

// フラッシュカード保存関連の状態インターフェース
interface SaveResponse {
  success: boolean;
  message: string;
  savedIds?: string[];
  error?: string;
}

// デッキインターフェース
interface Deck {
  id: number;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
  card_count?: number;
}

interface GetDecksResponse {
  success: boolean;
  decks: Deck[];
  count: number;
}

export default function FlashcardsPage() {
  const [text, setText] = useState('');
  const [questionCount, setQuestionCount] = useState<string>('auto');
  const [range, setRange] = useState('');
  const [complexity, setComplexity] = useState('medium');
  const [language, setLanguage] = useState('ja');
  
  const [isLoading, setIsLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [flippedCards, setFlippedCards] = useState<{[key: number]: boolean}>({});
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [streamedResponse, setStreamedResponse] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedFlashcards, setStreamedFlashcards] = useState<Flashcard[]>([]);
  const [saveStatus, setSaveStatus] = useState<{loading: boolean, success?: boolean, message?: string}>({
    loading: false
  });
  const [decks, setDecks] = useState<Deck[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<number | null>(null);
  const [loadingDecks, setLoadingDecks] = useState<boolean>(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [totalDecks, setTotalDecks] = useState<number>(0);
  const [currentCard, setCurrentCard] = useState<{front: string, back: string, status: 'front' | 'back' | 'complete'}>({
    front: '',
    back: '',
    status: 'front'
  });
  
  // 正解/不正解の記録状態を拡張して4択対応に
  const [cardResponses, setCardResponses] = useState<{[key: number]: string}>({});
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // YouTube関連の状態を追加
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [youtubeLoading, setYoutubeLoading] = useState(false);
  const [youtubeInfo, setYoutubeInfo] = useState<YoutubeVideoInfo | null>(null);
  
  // Webサイト関連の状態を追加
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [websiteLoading, setWebsiteLoading] = useState(false);
  const [websiteInfo, setWebsiteInfo] = useState<WebsiteInfo | null>(null);
  
  // useCompletionフックを使用
  const { complete, completion, isLoading: isCompletionLoading, error: completionError } = useCompletion({
    api: '/api/flashcards',
    onResponse: (response) => {
      // ストリーミングが開始したら前の結果をクリア
      console.log('ストリーミング開始:', response.status);
      setStreamedResponse('');
      setStreamedFlashcards([]);
      setIsStreaming(true);
      setCurrentCard({
        front: '',
        back: '',
        status: 'front'
      });
    },
    onFinish: (prompt, completion) => {
      console.log('ストリーミング完了');
      // 最後のカードを完成とマーク
      setCurrentCard(prev => ({...prev, status: 'complete'}));
      // 遅延を入れてから最終解析を行う（レースコンディションを防ぐ）
      setTimeout(() => {
        parseFlashcardsFromCompletion(completion);
        setIsStreaming(false);
      }, 500);
    },
    onError: (error) => {
      console.error('ストリーミングエラー:', error);
      setError(`生成中にエラーが発生しました: ${error.message || '不明なエラー'}`);
      setIsStreaming(false);
    }
  });

  // ストリーミングされたテキストを監視する単一のuseEffect
  useEffect(() => {
    if (!completion) return;
    
    console.log('ストリーミング更新:', completion.length);
    setStreamedResponse(completion);
    
    // バックグラウンドで解析を試みる（UI表示用）
    try {
      // JSON部分を検出
      const jsonMatch = completion.match(/\{[\s\S]*?\}\s*$/);
      if (jsonMatch) {
        const jsonText = jsonMatch[0].replace(/```json|```/g, '').trim();
        
        try {
          const data = JSON.parse(jsonText) as FlashcardResponse;
          if (data.flashcards && Array.isArray(data.flashcards)) {
            // 1. 既存のフラッシュカード（完成したもの）を更新
            if (data.flashcards.length > 0) {
              const completedCards = data.flashcards.slice(0, -1);
              
              // 完成したカードだけを更新
              if (completedCards.length > 0) {
                setStreamedFlashcards(completedCards);
              }
              
              // 2. 現在生成中のカードを取得（最後のカード）
              const currentGeneratingCard = data.flashcards[data.flashcards.length - 1];
              
              // 3. 現在のカード状態を更新
              if (currentGeneratingCard) {
                // frontとbackの両方がある場合は完成に近い
                if (currentGeneratingCard.front && currentGeneratingCard.back) {
                  setCurrentCard({
                    front: currentGeneratingCard.front,
                    back: currentGeneratingCard.back,
                    status: 'complete'
                  });
                } 
                // frontだけある場合はback生成中
                else if (currentGeneratingCard.front) {
                  setCurrentCard({
                    front: currentGeneratingCard.front,
                    back: currentGeneratingCard.back || '',
                    status: 'back'
                  });
                }
                // 新しいカードが始まった場合
                else if (currentCard.status === 'complete' || !currentCard.front) {
                  setCurrentCard({
                    front: '',
                    back: '',
                    status: 'front'
                  });
                }
              }
            }
          }
        } catch (e) {
          // 解析エラーは無視（不完全なJSONの可能性）
          console.log('JSONパース失敗 - ストリーミング中の一時的なエラー');
        }
      } else {
        // JSONが見つからない場合は、テキスト全体から現在生成中のカードを推測
        const frontMatch = completion.match(/["']front["']\s*:\s*["']([^"']*)["']/);
        const backMatch = completion.match(/["']back["']\s*:\s*["']([^"']*)["']/);
        
        if (frontMatch && frontMatch[1]) {
          // frontが見つかった場合
          const frontText = frontMatch[1];
          const backText = backMatch ? backMatch[1] : '';
          
          setCurrentCard(prev => ({
            ...prev,
            front: frontText,
            back: backText,
            status: backMatch ? 'back' : 'front'
          }));
        }
      }
    } catch (err) {
      // エラーは無視（ストリーミング中のため不完全なデータの可能性）
      console.error('ストリーミング解析エラー:', err);
    }
  }, [completion]);

  // completionErrorを監視
  useEffect(() => {
    if (completionError) {
      setError(`ストリーミングエラー: ${completionError.message || '不明なエラー'}`);
      setIsStreaming(false);
    }
  }, [completionError]);

  // ストリーミングされたテキストからフラッシュカードを解析する
  const parseFlashcardsFromCompletion = (completionText: string) => {
    if (!completionText) return;
    
    console.log('フラッシュカード最終解析開始');
    
    try {
      // JSON部分を検出して解析
      const jsonMatch = completionText.match(/\{[\s\S]*?\}\s*$/);
      // バックアップとして全体をJSONと見なす
      const fullJsonMatch = completionText.match(/\{[\s\S]*\}/);
      
      let jsonText = '';
      if (jsonMatch) {
        jsonText = jsonMatch[0];
        console.log('最後の}までのJSONが見つかりました');
      } else if (fullJsonMatch) {
        jsonText = fullJsonMatch[0];
        console.log('部分的なJSONが見つかりました');
      } else {
        console.log('JSONが見つかりませんでした:', completionText);
        throw new Error('JSONフォーマットが見つかりませんでした');
      }
      
      // JSON文字列をクリーニング
      const cleanedJson = jsonText
        .replace(/```json|```/g, '') // マークダウンのコードブロックを削除
        .trim();
      
      let data: FlashcardResponse;
      try {
        data = JSON.parse(cleanedJson) as FlashcardResponse;
      } catch (parseError) {
        console.error('JSON解析エラー1:', parseError);
        
        // JSONの修正を試みる
        try {
          // 不完全なJSONを修正する試み
          const fixedJson = cleanedJson
            .replace(/,\s*\}$/, '}') // 末尾のカンマを削除
            .replace(/,\s*\]$/, ']'); // 末尾のカンマを削除
            
          data = JSON.parse(fixedJson) as FlashcardResponse;
          console.log('修正されたJSONでの解析成功');
        } catch (fixError) {
          console.error('JSON修正解析エラー2:', fixError);
          throw new Error('JSONの解析に失敗しました: ' + (fixError as Error).message);
        }
      }
      
      if (!data.flashcards || !Array.isArray(data.flashcards) || data.flashcards.length === 0) {
        console.error('フラッシュカードデータが不正:', data);
        throw new Error('フラッシュカードが見つかりませんでした');
      }
      
      console.log('フラッシュカード解析成功:', data.flashcards.length, '枚');
      setFlashcards(data.flashcards);
      
      // すべてのカードを初期状態（裏返されていない）にリセット
      const initialFlippedState: {[key: number]: boolean} = {};
      data.flashcards.forEach((_: any, index: number) => {
        initialFlippedState[index] = false;
      });
      setFlippedCards(initialFlippedState);
      setError(null);
    } catch (err) {
      console.error('解析エラー最終:', err);
      setError('フラッシュカードの解析に失敗しました。出力形式が正しくない可能性があります。詳細: ' + 
        (err instanceof Error ? err.message : '不明なエラー'));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFlashcards([]);
    setStreamedFlashcards([]);
    
    // 入力バリデーション
    if (!text.trim()) {
      setError('テキストを入力してください');
      return;
    }
    
    console.log('フラッシュカード生成リクエスト送信');
    try {
      // useCompletionフックを使用してAPIを呼び出す
      await complete(JSON.stringify({
        text,
        questionCount,
        range: range || undefined,
        complexity,
        language,
      }));
    } catch (err) {
      console.error('リクエストエラー:', err);
      setError(err instanceof Error ? err.message : '不明なエラーが発生しました');
      setIsStreaming(false);
    }
  };

  const toggleCard = (index: number) => {
    setFlippedCards(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  // カードの理解度を記録する関数（4択対応）
  const recordCardResponse = (index: number, response: string) => {
    setCardResponses(prev => ({
      ...prev,
      [index]: response
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setSelectedFile(file);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) {
      setError('ファイルが選択されていません');
      return;
    }

    setUploadLoading(true);
    setError(null);

    try {
      // FormDataの作成
      const formData = new FormData();
      formData.append('file', selectedFile);

      // ファイルアップロードAPIを呼び出し
      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const uploadData = await uploadResponse.json();

      if (!uploadResponse.ok) {
        throw new Error(uploadData.error?.message || 'ファイルの処理に失敗しました');
      }

      // 抽出されたテキストをテキストエリアに設定
      setText(uploadData.text);
      setSelectedFile(null);
      
      // ファイル入力をリセット
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : '不明なエラーが発生しました');
    } finally {
      setUploadLoading(false);
    }
  };

  // YouTube URLからコンテンツを取得する関数
  const handleYoutubeProcess = async () => {
    if (!youtubeUrl) {
      setError('YouTubeのURLを入力してください');
      return;
    }

    setYoutubeLoading(true);
    setError(null);
    setYoutubeInfo(null);

    try {
      // YouTube APIを呼び出し
      const response = await fetch('/api/youtube', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ youtubeUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'YouTube情報の取得に失敗しました');
      }

      // 抽出されたテキストをテキストエリアに設定
      setText(data.text);
      setYoutubeInfo(data.videoInfo);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : '不明なエラーが発生しました');
    } finally {
      setYoutubeLoading(false);
    }
  };

  // Webサイトからテキストを取得する関数
  const handleWebsiteProcess = async () => {
    if (!websiteUrl) {
      setError('URLが入力されていません');
      return;
    }

    setWebsiteLoading(true);
    setError(null);
    setWebsiteInfo(null);

    try {
      // Webサイト取得APIを呼び出し
      const response = await fetch('/api/website', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: websiteUrl }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `エラー: ${response.status}`);
      }

      const data = await response.json();
      
      // テキスト欄にWebサイトの内容を設定
      setText(data.text);
      
      // Webサイト情報を保存
      setWebsiteInfo(data.websiteInfo);
      
      console.log('Webサイト取得成功:', data.websiteInfo);
    } catch (err) {
      console.error('Webサイト取得エラー:', err);
      setError(err instanceof Error ? err.message : '不明なエラーが発生しました');
    } finally {
      setWebsiteLoading(false);
    }
  };

  // 認証コンテキストを使用して現在のユーザーを取得
  const { user, refreshSession } = useAuth();

  // デッキを取得する関数
  const fetchDecks = async () => {
    try {
      setLoadingDecks(true);
      setError(null);
      
      // ステータスフィルターを適用
      const statusParam = selectedStatus !== 'all' ? `?status=${selectedStatus}` : '';
      const apiUrl = `/api/decks${statusParam}`;
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        let errorMessage = '不明なエラーが発生しました';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || `エラー: ${response.status}`;
        } catch (e) {
          console.error('APIエラーレスポンスの解析に失敗:', e);
        }
        
        setError(errorMessage);
        setDecks([]);
        return;
      }
      
      const data = await response.json();
      setDecks(data.decks || []);
      setTotalDecks(data.decks?.length || 0);
      
      // デッキがあれば最初のデッキを選択状態にする
      if (data.decks && data.decks.length > 0 && !selectedDeckId) {
        setSelectedDeckId(data.decks[0].id);
      }
    } catch (error) {
      console.error('デッキ取得エラー:', error);
      setError(error instanceof Error ? error.message : '不明なエラーが発生しました');
      setDecks([]);
    } finally {
      setLoadingDecks(false);
    }
  };
  
  // ログイン状態が変わったときにデッキ一覧を取得
  useEffect(() => {
    if (user) {
      fetchDecks();
    } else {
      setDecks([]);
      setSelectedDeckId(null);
    }
  }, [user]);

  // フラッシュカードをSupabaseに保存する関数
  const saveFlashcardsToDatabase = async () => {
    // 保存するフラッシュカードがない場合は何もしない
    if (flashcards.length === 0) {
      setSaveStatus({
        loading: false,
        success: false,
        message: '保存するフラッシュカードがありません'
      });
      return;
    }

    setSaveStatus({
      loading: true,
      message: 'フラッシュカードを保存しています...'
    });

    try {
      // API経由でデータベースに保存
      const response = await fetch('/api/flashcards/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          flashcards: flashcards.map(card => ({
            front: card.front,
            back: card.back,
            frontRich: card.frontRich || null,
            backRich: card.backRich || null,
            category: range || null,
            tags: [],
            response: card.response || null,
          })),
          deckId: selectedDeckId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'データベースへの保存に失敗しました');
      }

      setSaveStatus({
        loading: false,
        success: true,
        message: data.message || `${data.cards?.length || 0}枚のフラッシュカードを保存しました`
      });

      // 成功メッセージを5秒後に消す
      setTimeout(() => {
        setSaveStatus({ loading: false });
      }, 5000);
      
    } catch (err) {
      setSaveStatus({
        loading: false,
        success: false,
        message: err instanceof Error ? err.message : '保存中にエラーが発生しました'
      });
    }
  };
  
  // デッキを作成する関数
  const createNewDeck = async () => {
    // 簡易的な実装として、プロンプトでデッキ名を入力
    const deckName = prompt('新しいデッキ名を入力してください:');
    if (!deckName) return; // キャンセルまたは空の場合
    
    try {
      setSaveStatus({
        loading: true,
        message: '新しいデッキを作成しています...'
      });
      
      const response = await fetch('/api/decks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: deckName }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'デッキの作成に失敗しました');
      }

      // デッキリストを更新
      await fetchDecks();
      
      // 作成したデッキを選択
      setSelectedDeckId(data.deck.id);
      
      setSaveStatus({
        loading: false,
        success: true,
        message: `デッキ「${deckName}」が作成されました`
      });
      
      // 成功メッセージを5秒後に消す
      setTimeout(() => {
        setSaveStatus({ loading: false });
      }, 5000);
      
    } catch (err) {
      setSaveStatus({
        loading: false,
        success: false,
        message: err instanceof Error ? err.message : 'デッキ作成中にエラーが発生しました'
      });
    }
  };

  // タイピングカーソルのアニメーションスタイルを追加
  useEffect(() => {
    // スタイルをヘッドに追加
    const styleSheet = document.createElement("style");
    styleSheet.textContent = `
      .typing-cursor {
        display: inline-block;
        width: 2px;
        height: 1em;
        background-color: #3b82f6;
        margin-left: 2px;
        animation: blink 0.7s infinite;
        vertical-align: middle;
      }
      
      @keyframes blink {
        0% { opacity: 1; }
        50% { opacity: 0; }
        100% { opacity: 1; }
      }
    `;
    document.head.appendChild(styleSheet);
    
    return () => {
      // クリーンアップ関数
      document.head.removeChild(styleSheet);
    };
  }, []);

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <style dangerouslySetInnerHTML={{ __html: richTextStyles }} />
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">フラッシュカード生成</h1>
        
        {/* 保存済みフラッシュカードへのリンク */}
        <a
          href="/flashcards/saved"
          className="inline-block px-4 py-2 bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200 transition-colors"
        >
          保存済みフラッシュカード →
        </a>
      </div>
      
      <form onSubmit={handleSubmit} className="mb-8 space-y-4 max-w-2xl">
        <div>
          <label htmlFor="text" className="block mb-2 font-medium">
            テキスト（必須）
          </label>
          <textarea
            id="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full p-2 border rounded-md min-h-[150px]"
            placeholder="フラッシュカードの元となるテキストを入力してください"
            required
          />
        </div>

        {/* YouTubeリンク入力 */}
        <div className="mb-4 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
          <div className="flex flex-col md:flex-row md:items-center gap-2">
            <div className="flex-grow">
              <label htmlFor="youtubeUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                YouTubeビデオのURL（オプション）
              </label>
              <input
                type="text"
                id="youtubeUrl"
                placeholder="https://www.youtube.com/watch?v=..."
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                className="w-full p-2 border rounded-md text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
            <button
              type="button"
              onClick={handleYoutubeProcess}
              disabled={!youtubeUrl || youtubeLoading}
              className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap mt-2 md:mt-0 ${
                !youtubeUrl || youtubeLoading
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-400'
                  : 'bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700'
              }`}
            >
              {youtubeLoading ? '取得中...' : 'YouTubeを処理'}
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            YouTubeビデオの情報と説明からフラッシュカードを作成します
          </p>
          
          {youtubeInfo && (
            <div className="mt-2 p-4 bg-gray-50 rounded-md border border-gray-200">
              <div className="flex items-start space-x-4">
                <img 
                  src={youtubeInfo.thumbnailUrl} 
                  alt={youtubeInfo.title}
                  className="w-24 h-auto rounded"
                />
                <div className="flex-1">
                  <h4 className="font-bold">{youtubeInfo.title}</h4>
                  <p className="text-sm text-gray-600">
                    {new Date(youtubeInfo.publishedAt).toLocaleDateString()}
                  </p>
                  <p className="text-sm mt-2">
                    内容を取得してテキスト欄に設定しました
                  </p>
                  {youtubeInfo.captions && (
                    <p className="text-xs text-gray-500 mt-2">
                      字幕情報も取得しました（{youtubeInfo.captions.length > 100 
                        ? youtubeInfo.captions.substring(0, 100) + '...' 
                        : youtubeInfo.captions}）
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Webサイトリンク入力 */}
        <div className="mb-4 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
          <div className="flex flex-col md:flex-row md:items-center gap-2">
            <div className="flex-grow">
              <label htmlFor="websiteUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                WebサイトのURL（オプション）
              </label>
              <input
                type="text"
                id="websiteUrl"
                placeholder="https://example.com/article/..."
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                className="w-full p-2 border rounded-md text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
            <button
              type="button"
              onClick={handleWebsiteProcess}
              disabled={!websiteUrl || websiteLoading}
              className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap mt-2 md:mt-0 ${
                !websiteUrl || websiteLoading
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-400'
                  : 'bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700'
              }`}
            >
              {websiteLoading ? '取得中...' : 'Webサイトを処理'}
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Webサイトのコンテンツからフラッシュカードを作成します
          </p>
          
          {websiteInfo && (
            <div className="mt-3 p-3 bg-white dark:bg-gray-700 rounded-md border dark:border-gray-600">
              <div className="text-sm">
                <p className="font-semibold mb-1">Webサイト情報:</p>
                <p className="text-gray-700 dark:text-gray-300 text-xs mb-1">
                  <span className="font-medium">URL:</span> {websiteInfo.url}
                </p>
                <p className="text-gray-700 dark:text-gray-300 text-xs mb-1">
                  <span className="font-medium">テキスト長:</span> {websiteInfo.textLength.toLocaleString()} 文字
                </p>
                <p className="text-gray-700 dark:text-gray-300 text-xs">
                  <span className="font-medium">取得時間:</span> {websiteInfo.fetchTime.toFixed(2)} 秒
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="border-t pt-4 pb-2">
          <h3 className="font-medium mb-3">または、ファイルをアップロード</h3>
          <div className="flex flex-col space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx,.mp3,.wav,.m4a,.mp4,.aac,.ogg,.webm,.flac,.jpg,.jpeg,.png,.gif,.webp"
                className="border p-2 rounded-md flex-1"
              />
              <button
                type="button"
                onClick={handleFileUpload}
                disabled={!selectedFile || uploadLoading}
                className={`px-4 py-2 bg-gray-600 text-white rounded-md ${
                  !selectedFile || uploadLoading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-gray-700'
                }`}
              >
                {uploadLoading ? (
                  <>
                    <span className="inline-block animate-spin mr-2">⟳</span>
                    処理中...
                  </>
                ) : (
                  'アップロード'
                )}
              </button>
            </div>
            
            {selectedFile && (
              <div className="mt-2">
                <span className="text-sm text-gray-600">
                  選択されたファイル: {selectedFile.name}
                </span>
              </div>
            )}
            
            <p className="text-sm text-gray-500 mt-1">
              PDFやWord文書は内容が抽出され、音声ファイルは文字起こし、画像ファイルはテキスト認識されます
            </p>
            
            <div className="mt-2 bg-blue-50 p-3 rounded-md">
              <h3 className="text-sm font-semibold text-blue-800">✨ 新機能：Google Gemini 1.5 Proによる高精度音声・画像認識</h3>
              <p className="text-sm text-blue-600 mt-1">
                音声ファイルや画像ファイルをアップロードすれば、Googleの最新AI技術により高精度でテキスト化されて学習カードが作成できます！
              </p>
              <p className="text-xs text-blue-500 mt-1">
                複数言語対応、正確な句読点配置、表・図形内テキスト認識など高度な機能を備えています。
              </p>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="questionCount" className="block mb-2 font-medium">
              問題数
            </label>
            <select
              id="questionCount"
              value={questionCount}
              onChange={(e) => setQuestionCount(e.target.value)}
              className="w-full p-2 border rounded-md"
            >
              <option value="auto">自動（最適な数）</option>
              <option value="max">自動（可能な限り出力）</option>
              <option value="3">3</option>
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="15">15</option>
            </select>
          </div>
          
          <div>
            <label htmlFor="range" className="block mb-2 font-medium">
              範囲（オプション）
            </label>
            <input
              id="range"
              type="text"
              value={range}
              onChange={(e) => setRange(e.target.value)}
              className="w-full p-2 border rounded-md"
              placeholder="例: 第1章のみ、特定のトピックなど"
            />
          </div>
          
          <div>
            <label htmlFor="complexity" className="block mb-2 font-medium">
              複雑さ
            </label>
            <select
              id="complexity"
              value={complexity}
              onChange={(e) => setComplexity(e.target.value)}
              className="w-full p-2 border rounded-md"
            >
              <option value="simple">シンプル</option>
              <option value="medium">標準</option>
              <option value="detailed">詳細</option>
            </select>
          </div>
          
          <div>
            <label htmlFor="language" className="block mb-2 font-medium">
              言語
            </label>
            <select
              id="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full p-2 border rounded-md"
            >
              <option value="ja">日本語</option>
              <option value="en">英語</option>
              <option value="zh">中国語</option>
              <option value="ko">韓国語</option>
            </select>
          </div>
        </div>
        
        <button
          type="submit"
          disabled={isCompletionLoading}
          className={`px-4 py-2 bg-blue-600 text-white rounded-md ${
            isCompletionLoading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-blue-700'
          }`}
        >
          {isCompletionLoading ? '生成中...' : 'フラッシュカードを生成'}
        </button>
      </form>
      
      {error && (
        <div className="p-4 mb-6 bg-red-100 border-l-4 border-red-500 text-red-700">
          <p>{error}</p>
        </div>
      )}
      
      {/* 保存状態メッセージ */}
      {saveStatus.message && (
        <div className={`p-4 mb-6 border-l-4 ${
          saveStatus.success 
            ? 'bg-green-100 border-green-500 text-green-700' 
            : 'bg-yellow-100 border-yellow-500 text-yellow-700'
        }`}>
          <p>{saveStatus.message}</p>
        </div>
      )}
      
      {isStreaming && (
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">
            フラッシュカード生成中... 
            <span className="text-blue-500">
              {streamedFlashcards.length}枚完成
            </span>
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {/* 完成したカード */}
            {streamedFlashcards.map((card, index) => (
              <div
                key={`complete-${index}`}
                className="p-4 rounded-lg shadow-md min-h-[200px] flex items-center justify-center bg-white border border-green-200 hover:shadow-lg transition-all"
              >
                <div className="text-center w-full">
                  <h3 className="font-bold mb-2">問題</h3>
                  {card.frontRich ? (
                    <div className="text-left flashcard-rich-content" dangerouslySetInnerHTML={{ __html: card.frontRich }} />
                  ) : (
                    <p>{card.front}</p>
                  )}
                  <hr className="my-3 border-dashed border-gray-300" />
                  <h3 className="font-bold mb-2">解答</h3>
                  {card.backRich ? (
                    <div className="text-left flashcard-rich-content" dangerouslySetInnerHTML={{ __html: card.backRich }} />
                  ) : (
                    <p>{card.back}</p>
                  )}
                  
                  {/* 4択の理解度選択ボタン */}
                  <div className="mt-4 flex flex-wrap gap-2 justify-center">
                    <button
                      onClick={() => recordCardResponse(index, 'ultra_easy')}
                      className={`px-3 py-1 rounded-md text-xs font-medium ${
                        cardResponses[index] === 'ultra_easy'
                          ? 'bg-green-500 text-white'
                          : 'bg-green-100 text-green-800 hover:bg-green-200'
                      }`}
                    >
                      <span className="mr-1">10点</span>
                      超簡単
                    </button>
                    <button
                      onClick={() => recordCardResponse(index, 'easy')}
                      className={`px-3 py-1 rounded-md text-xs font-medium ${
                        cardResponses[index] === 'easy'
                          ? 'bg-blue-500 text-white'
                          : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                      }`}
                    >
                      <span className="mr-1">4点</span>
                      容易
                    </button>
                    <button
                      onClick={() => recordCardResponse(index, 'hard')}
                      className={`px-3 py-1 rounded-md text-xs font-medium ${
                        cardResponses[index] === 'hard'
                          ? 'bg-yellow-500 text-white'
                          : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                      }`}
                    >
                      <span className="mr-1">4日</span>
                      難しい
                    </button>
                    <button
                      onClick={() => recordCardResponse(index, 'forgot')}
                      className={`px-3 py-1 rounded-md text-xs font-medium ${
                        cardResponses[index] === 'forgot'
                          ? 'bg-red-500 text-white'
                          : 'bg-red-100 text-red-800 hover:bg-red-200'
                      }`}
                    >
                      <span className="mr-1">10分</span>
                      忘却
                    </button>
                  </div>
                </div>
              </div>
            ))}
            
            {/* 現在生成中のカード */}
            {currentCard.front || currentCard.back ? (
              <div className="p-4 rounded-lg shadow-md min-h-[200px] flex items-center justify-center border-2 border-blue-400 bg-blue-50 relative overflow-hidden">
                <div className={`absolute top-2 right-2 text-xs px-2 py-1 rounded ${
                  currentCard.status === 'front' ? 'bg-yellow-100 text-yellow-800' : 
                  currentCard.status === 'back' ? 'bg-blue-100 text-blue-800' : 
                  'bg-green-100 text-green-800'
                }`}>
                  {currentCard.status === 'front' ? '問題作成中...' : 
                   currentCard.status === 'back' ? '解答作成中...' : '完成!'}
                </div>
                
                <div className="text-center w-full">
                  <h3 className="font-bold mb-2">問題</h3>
                  <div className="min-h-[50px] flex items-center justify-center">
                    <p className="relative">
                      {currentCard.front}
                      {currentCard.status === 'front' && (
                        <span className="typing-cursor">|</span>
                      )}
                    </p>
                  </div>
                  
                  <hr className="my-3 border-dashed border-gray-300" />
                  
                  <h3 className="font-bold mb-2">解答</h3>
                  <div className="min-h-[50px] flex items-center justify-center">
                    <p className="relative">
                      {currentCard.back}
                      {currentCard.status === 'back' && (
                        <span className="typing-cursor">|</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-lg shadow-md min-h-[200px] flex items-center justify-center bg-gray-50 border border-gray-200 animate-pulse">
                <div className="text-center text-gray-400">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700 mx-auto mb-3"></div>
                  <p>次のカードを準備中...</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* フラッシュカード表示 */}
      {flashcards.length > 0 && (
        <div className="mt-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">作成されたフラッシュカード</h2>
            
            {/* デッキ選択と保存ボタン */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <select
                  value={selectedDeckId?.toString() || ''}
                  onChange={(e) => setSelectedDeckId(e.target.value ? Number(e.target.value) : null)}
                  disabled={loadingDecks || saveStatus.loading}
                  className="p-2 pr-8 border rounded-md bg-white text-gray-800"
                >
                  <option value="">デッキを選択...</option>
                  {decks.map(deck => (
                    <option key={deck.id} value={deck.id}>
                      {deck.title}
                    </option>
                  ))}
                </select>
              </div>
              
              <button
                type="button"
                onClick={createNewDeck}
                disabled={saveStatus.loading}
                className="p-2 border rounded-md bg-gray-50 text-gray-700 hover:bg-gray-100"
                title="新しいデッキを作成"
              >
                <span>+ 新規</span>
              </button>
              
              <button
                type="button"
                onClick={saveFlashcardsToDatabase}
                disabled={saveStatus.loading || flashcards.length === 0}
                className={`px-4 py-2 bg-green-600 text-white rounded-md ${
                  saveStatus.loading || flashcards.length === 0 ? 'opacity-70 cursor-not-allowed' : 'hover:bg-green-700'
                }`}
              >
                {saveStatus.loading ? '保存中...' : 'データベースに保存'}
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {flashcards.map((card, index) => (
              <div
                key={index}
                className="p-4 rounded-lg shadow-md min-h-[200px] bg-white hover:shadow-lg transition-all"
              >
                <div className="w-full">
                  <div className="mb-4">
                    <h3 className="font-bold mb-2">問題</h3>
                    {card.frontRich ? (
                      <div className="text-left flashcard-rich-content" dangerouslySetInnerHTML={{ __html: card.frontRich }} />
                    ) : (
                      <p>{card.front}</p>
                    )}
                  </div>
                  
                  <hr className="my-3 border-dashed border-gray-300" />
                  
                  <div className="mb-4">
                    <h3 className="font-bold mb-2">解答</h3>
                    {card.backRich ? (
                      <div className="text-left flashcard-rich-content" dangerouslySetInnerHTML={{ __html: card.backRich }} />
                    ) : (
                      <p>{card.back}</p>
                    )}
                  </div>
                  
                  {/* 4択の理解度選択ボタン */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => recordCardResponse(index, 'ultra_easy')}
                      className={`px-3 py-2 rounded-md text-sm font-medium ${
                        cardResponses[index] === 'ultra_easy'
                          ? 'bg-green-500 text-white'
                          : 'bg-green-100 text-green-800 hover:bg-green-200'
                      }`}
                    >
                      <span className="mr-1">10点</span>
                      超簡単
                    </button>
                    <button
                      onClick={() => recordCardResponse(index, 'easy')}
                      className={`px-3 py-2 rounded-md text-sm font-medium ${
                        cardResponses[index] === 'easy'
                          ? 'bg-blue-500 text-white'
                          : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                      }`}
                    >
                      <span className="mr-1">4点</span>
                      容易
                    </button>
                    <button
                      onClick={() => recordCardResponse(index, 'hard')}
                      className={`px-3 py-2 rounded-md text-sm font-medium ${
                        cardResponses[index] === 'hard'
                          ? 'bg-yellow-500 text-white'
                          : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                      }`}
                    >
                      <span className="mr-1">4日</span>
                      難しい
                    </button>
                    <button
                      onClick={() => recordCardResponse(index, 'forgot')}
                      className={`px-3 py-2 rounded-md text-sm font-medium ${
                        cardResponses[index] === 'forgot'
                          ? 'bg-red-500 text-white'
                          : 'bg-red-100 text-red-800 hover:bg-red-200'
                      }`}
                    >
                      <span className="mr-1">10分</span>
                      忘却
                    </button>
                  </div>
                  
                  <div className="flex justify-end space-x-2 mt-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // カードを編集（インデックスを使って特定のカードを編集）
                        const updatedCards = [...flashcards];
                        const editedCard = prompt('問題を編集:', card.front);
                        if (editedCard !== null) {
                          updatedCards[index] = {
                            ...updatedCards[index],
                            front: editedCard,
                            frontRich: editedCard
                          };
                          setFlashcards(updatedCards);
                        }
                        
                        const editedAnswer = prompt('解答を編集:', card.back);
                        if (editedAnswer !== null) {
                          updatedCards[index] = {
                            ...updatedCards[index],
                            back: editedAnswer,
                            backRich: editedAnswer
                          };
                          setFlashcards(updatedCards);
                        }
                      }}
                      className="text-blue-500 hover:text-blue-700"
                    >
                      編集
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // カードを削除
                        if (confirm('このカードを削除してもよろしいですか？')) {
                          const updatedCards = flashcards.filter((_, i) => i !== index);
                          setFlashcards(updatedCards);
                        }
                      }}
                      className="text-red-500 hover:text-red-700"
                    >
                      削除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 