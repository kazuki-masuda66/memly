'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Flashcard {
  id: string;
  front: string;
  back: string;
  front_rich?: string | null;
  back_rich?: string | null;
  created_at: string;
  updated_at?: string;
  deck_id: number;
}

interface Deck {
  id: number;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export default function DeckDetailPage({ params }: { params: { id: string } }) {
  const [deck, setDeck] = useState<Deck | null>(null);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flippedCards, setFlippedCards] = useState<Record<string, boolean>>({});
  const router = useRouter();

  // デッキとフラッシュカードの取得
  useEffect(() => {
    const fetchDeckAndCards = async () => {
      try {
        // デッキの情報を取得
        const deckResponse = await fetch(`/api/decks/${params.id}`);
        if (!deckResponse.ok) {
          throw new Error('デッキの取得に失敗しました');
        }
        const deckData = await deckResponse.json();
        setDeck(deckData.deck);

        // フラッシュカードの一覧を取得
        const cardsResponse = await fetch(`/api/flashcards/list?deckId=${params.id}`);
        if (!cardsResponse.ok) {
          throw new Error('フラッシュカードの取得に失敗しました');
        }
        const cardsData = await cardsResponse.json();
        setFlashcards(cardsData.flashcards || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : '不明なエラーが発生しました');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDeckAndCards();
  }, [params.id]);

  // カードの表裏を切り替える
  const toggleCard = (cardId: string) => {
    setFlippedCards(prev => ({
      ...prev,
      [cardId]: !prev[cardId]
    }));
  };

  // 日付のフォーマット
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // カードの編集ページに移動
  const handleEditCard = (cardId: string) => {
    router.push(`/decks/${params.id}/cards/${cardId}/edit`);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        <p className="mt-2">読み込み中...</p>
      </div>
    );
  }

  if (error || !deck) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-red-50 border-l-4 border-red-400 p-4 text-red-700">
          <p>{error || 'デッキが見つかりませんでした'}</p>
        </div>
        <Link href="/decks" className="mt-4 inline-block text-blue-600 hover:underline">
          デッキ一覧に戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">{deck.title}</h1>
        <div className="flex gap-4">
          <Link
            href={`/study?deckId=${deck.id}`}
            className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            学習を始める
          </Link>
          <Link
            href="/decks"
            className="px-6 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
          >
            戻る
          </Link>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-xl font-semibold mb-4">デッキ情報</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-600">作成日</p>
            <p>{formatDate(deck.created_at)}</p>
          </div>
          <div>
            <p className="text-gray-600">更新日</p>
            <p>{formatDate(deck.updated_at)}</p>
          </div>
          <div>
            <p className="text-gray-600">カード数</p>
            <p>{flashcards.length}枚</p>
          </div>
          <div>
            <p className="text-gray-600">ステータス</p>
            <p>{deck.status}</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">フラッシュカード一覧</h2>
          <Link
            href={`/decks/${deck.id}/cards/new`}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            カードを追加
          </Link>
        </div>

        {flashcards.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <p className="text-lg">フラッシュカードがありません</p>
            <p className="text-gray-600 mt-2">
              新しいカードを追加して学習を始めましょう
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {flashcards.map((card) => (
              <div
                key={card.id}
                className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-medium">カード #{card.id.substring(0, 8)}</h3>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500">
                      {formatDate(card.created_at)}
                    </span>
                    <button
                      onClick={() => handleEditCard(card.id)}
                      className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm"
                    >
                      編集
                    </button>
                  </div>
                </div>
                
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div 
                    className="border rounded-lg p-4 cursor-pointer"
                    onClick={() => toggleCard(card.id)}
                  >
                    <div className="font-medium text-gray-700 mb-2">表面（問題）</div>
                    {card.front_rich ? (
                      <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: card.front_rich }} />
                    ) : (
                      <p>{card.front}</p>
                    )}
                  </div>
                  
                  <div 
                    className="border rounded-lg p-4 cursor-pointer"
                    onClick={() => toggleCard(card.id)}
                  >
                    <div className="font-medium text-gray-700 mb-2">裏面（解答）</div>
                    {card.back_rich ? (
                      <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: card.back_rich }} />
                    ) : (
                      <p>{card.back}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 