'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// フラッシュカードの型定義
interface Flashcard {
  id: string;
  front: string;
  back: string;
  frontRich?: string | null;
  backRich?: string | null;
  tags?: string[] | null;
  category?: string | null;
  created_at: string;
  deck_id?: number | null;
}

// デッキの型定義
interface Deck {
  id: number;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
}

// リッチテキストのスタイル定義
const richTextStyles = `
.flashcard-rich-content h4 {
  font-size: 1.1rem;
  font-weight: 600;
  margin-top: 0.75rem;
  margin-bottom: 0.5rem;
}

.flashcard-rich-content h5 {
  font-size: 1rem;
  font-weight: 600;
  margin-top: 0.5rem;
  margin-bottom: 0.25rem;
}

.flashcard-rich-content ul, .flashcard-rich-content ol {
  padding-left: 1.5rem;
  margin: 0.5rem 0;
}

.flashcard-rich-content ul {
  list-style-type: disc;
}

.flashcard-rich-content ol {
  list-style-type: decimal;
}

.flashcard-rich-content li {
  margin-bottom: 0.25rem;
}

.flashcard-rich-content p {
  margin-bottom: 0.5rem;
}

.flashcard-rich-content mark {
  background-color: #FEEBC8;
  padding: 0.1rem 0.2rem;
  border-radius: 0.2rem;
}

.flashcard-rich-content strong {
  font-weight: 600;
}

.flashcard-rich-content blockquote {
  border-left: 3px solid #E2E8F0;
  padding-left: 1rem;
  margin: 0.5rem 0;
  color: #4A5568;
  font-style: italic;
}

.flashcard-rich-content code {
  font-family: monospace;
  background-color: #EDF2F7;
  padding: 0.1rem 0.2rem;
  border-radius: 0.2rem;
  font-size: 0.9em;
}
`;

export default function SavedFlashcardsPage() {
  const router = useRouter();
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [flippedCards, setFlippedCards] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCards, setTotalCards] = useState(0);
  const cardsPerPage = 10;
  // 正解/不正解の記録状態を拡張して4択対応に
  const [cardResponses, setCardResponses] = useState<Record<string, string>>({});

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
          setDecks(data.decks);
        } else {
          setError(data.error || 'デッキの取得に失敗しました');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '不明なエラーが発生しました');
      }
    };

    fetchDecks();
  }, []);

  // フラッシュカード一覧を取得
  useEffect(() => {
    const fetchFlashcards = async () => {
      setLoading(true);
      try {
        const offset = (currentPage - 1) * cardsPerPage;
        let url = `/api/flashcards/list?limit=${cardsPerPage}&offset=${offset}`;
        
        if (selectedDeckId) {
          url += `&deckId=${selectedDeckId}`;
        }
        
        if (searchTerm) {
          url += `&search=${encodeURIComponent(searchTerm)}`;
        }
        
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('フラッシュカードの取得に失敗しました');
        }
        
        const data = await response.json();
        if (data.success) {
          setFlashcards(data.flashcards);
          setTotalCards(data.count);
        } else {
          setError(data.error || 'フラッシュカードの取得に失敗しました');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '不明なエラーが発生しました');
      } finally {
        setLoading(false);
      }
    };

    fetchFlashcards();
  }, [currentPage, selectedDeckId, searchTerm]);

  // カードを裏返す
  const toggleCard = (id: string) => {
    setFlippedCards(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // カードの理解度を記録する関数（4択対応）
  const recordCardResponse = (id: string, response: string) => {
    setCardResponses(prev => ({
      ...prev,
      [id]: response
    }));
    
    // ここでAPIを呼び出して保存することも可能
    // 現在のサンプル実装では保存はしていません
  };

  // カードを編集する
  const handleEdit = (cardId: string, deckId: number | null) => {
    if (deckId) {
      router.push(`/decks/${deckId}/cards/${cardId}/edit`);
    } else {
      // デッキがない場合の処理
      alert('このカードはデッキに属していないため編集できません');
    }
  };

  // カードを削除する
  const handleDelete = async (cardId: string) => {
    if (!confirm('このカードを削除してもよろしいですか？')) {
      return;
    }

    try {
      const response = await fetch(`/api/flashcards/${cardId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('カードの削除に失敗しました');
      }

      // 成功したら一覧から削除
      setFlashcards(prev => prev.filter(card => card.id !== cardId));
    } catch (err) {
      setError(err instanceof Error ? err.message : '不明なエラーが発生しました');
    }
  };

  // 日付をフォーマット
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  // 検索処理
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1); // 検索時は1ページ目に戻る
  };

  // デッキ選択
  const handleDeckChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedDeckId(e.target.value === 'all' ? null : e.target.value);
    setCurrentPage(1); // デッキ変更時は1ページ目に戻る
  };

  // ページネーション
  const totalPages = Math.ceil(totalCards / cardsPerPage);
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // HTMLをプレーンテキストに変換
  const stripHtml = (html: string | null | undefined) => {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '');
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <style dangerouslySetInnerHTML={{ __html: richTextStyles }} />
      
      <h1 className="text-2xl font-bold mb-6">保存済みフラッシュカード</h1>
      
      {/* 検索・フィルター */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <div className="flex-1">
            <form onSubmit={handleSearch} className="flex">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="キーワードで検索..."
                className="flex-1 px-4 py-2 border rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="bg-blue-500 text-white px-4 py-2 rounded-r-lg hover:bg-blue-600"
              >
                検索
              </button>
            </form>
          </div>
          
          <div className="w-full md:w-64">
            <select
              value={selectedDeckId || 'all'}
              onChange={handleDeckChange}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">すべてのデッキ</option>
              {decks.map(deck => (
                <option key={deck.id} value={deck.id}>
                  {deck.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      
      {/* エラー表示 */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {/* ローディング */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <>
          {/* カード一覧 */}
          {flashcards.length === 0 ? (
            <div className="bg-gray-100 p-8 rounded-lg text-center">
              <p className="text-gray-600 mb-4">保存されたフラッシュカードがありません</p>
              <Link href="/flashcards" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                フラッシュカードを作成する
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {flashcards.map(card => {
                const isFlipped = flippedCards[card.id] || false;
                const deckTitle = decks.find(d => d.id === card.deck_id)?.title || '未分類';
                
                return (
                  <div key={card.id} className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="p-4 bg-gray-50 flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-600">
                        {deckTitle}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatDate(card.created_at)}
                      </span>
                    </div>
                    
                    <div 
                      className="p-6 cursor-pointer min-h-[200px] flex items-center justify-center"
                      onClick={() => toggleCard(card.id)}
                    >
                      {isFlipped ? (
                        <div>
                          {card.backRich ? (
                            <div dangerouslySetInnerHTML={{ __html: card.backRich }} />
                          ) : (
                            <p>{card.back}</p>
                          )}
                        </div>
                      ) : (
                        <div>
                          {card.frontRich ? (
                            <div dangerouslySetInnerHTML={{ __html: card.frontRich }} />
                          ) : (
                            <p>{card.front}</p>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* 4択の理解度選択ボタン */}
                    {isFlipped && (
                      <div className="mt-4 flex flex-wrap gap-2 justify-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            recordCardResponse(card.id, 'ultra_easy');
                          }}
                          className={`px-2 py-1 rounded-md text-xs font-medium ${
                            cardResponses[card.id] === 'ultra_easy'
                              ? 'bg-green-500 text-white'
                              : 'bg-green-100 text-green-800 hover:bg-green-200'
                          }`}
                        >
                          <span className="mr-1">10点</span>
                          超簡単
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            recordCardResponse(card.id, 'easy');
                          }}
                          className={`px-2 py-1 rounded-md text-xs font-medium ${
                            cardResponses[card.id] === 'easy'
                              ? 'bg-blue-500 text-white'
                              : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                          }`}
                        >
                          <span className="mr-1">4点</span>
                          容易
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            recordCardResponse(card.id, 'hard');
                          }}
                          className={`px-2 py-1 rounded-md text-xs font-medium ${
                            cardResponses[card.id] === 'hard'
                              ? 'bg-yellow-500 text-white'
                              : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                          }`}
                        >
                          <span className="mr-1">4日</span>
                          難しい
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            recordCardResponse(card.id, 'forgot');
                          }}
                          className={`px-2 py-1 rounded-md text-xs font-medium ${
                            cardResponses[card.id] === 'forgot'
                              ? 'bg-red-500 text-white'
                              : 'bg-red-100 text-red-800 hover:bg-red-200'
                          }`}
                        >
                          <span className="mr-1">10分</span>
                          忘却
                        </button>
                      </div>
                    )}
                    
                    <div className="p-4 bg-gray-50 flex justify-between">
                      <button
                        onClick={() => handleEdit(card.id, card.deck_id || null)}
                        className="text-blue-500 hover:text-blue-700"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => handleDelete(card.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          {/* ページネーション */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-8">
              <nav className="flex items-center">
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className={`px-3 py-1 rounded-l-md border ${
                    currentPage === 1 ? 'bg-gray-100 text-gray-400' : 'bg-white text-blue-500 hover:bg-blue-50'
                  }`}
                >
                  前へ
                </button>
                
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => goToPage(page)}
                    className={`px-3 py-1 border-t border-b ${
                      currentPage === page
                        ? 'bg-blue-500 text-white'
                        : 'bg-white text-blue-500 hover:bg-blue-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                
                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className={`px-3 py-1 rounded-r-md border ${
                    currentPage === totalPages ? 'bg-gray-100 text-gray-400' : 'bg-white text-blue-500 hover:bg-blue-50'
                  }`}
                >
                  次へ
                </button>
              </nav>
            </div>
          )}
        </>
      )}
    </div>
  );
} 