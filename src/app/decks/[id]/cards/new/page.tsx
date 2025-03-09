'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import RichTextEditor from '@/components/RichTextEditor';

interface Deck {
  id: number;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface Flashcard {
  front: string;
  back: string;
  frontRich?: string;
  backRich?: string;
}

export default function NewCardPage({ params }: { params: { id: string } }) {
  const [deck, setDeck] = useState<Deck | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();

  // フラッシュカードの入力状態
  const [cards, setCards] = useState<Flashcard[]>([
    { front: '', back: '', frontRich: '', backRich: '' }
  ]);

  // デッキ情報の取得
  useEffect(() => {
    const fetchDeck = async () => {
      try {
        const response = await fetch(`/api/decks/${params.id}`);
        if (!response.ok) {
          throw new Error('デッキの取得に失敗しました');
        }
        const data = await response.json();
        setDeck(data.deck);
      } catch (err) {
        setError(err instanceof Error ? err.message : '不明なエラーが発生しました');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDeck();
  }, [params.id]);

  // カードの追加
  const handleAddCard = () => {
    setCards([...cards, { front: '', back: '', frontRich: '', backRich: '' }]);
  };

  // カードの削除
  const handleRemoveCard = (index: number) => {
    setCards(cards.filter((_, i) => i !== index));
  };

  // カードの更新（プレーンテキスト）
  const handleCardChange = (index: number, field: 'front' | 'back', value: string) => {
    const newCards = [...cards];
    newCards[index] = { ...newCards[index], [field]: value };
    setCards(newCards);
  };

  // カードの更新（リッチテキスト）
  const handleRichTextChange = (index: number, field: 'frontRich' | 'backRich', value: string) => {
    const newCards = [...cards];
    newCards[index] = { ...newCards[index], [field]: value };
    // プレーンテキストも更新
    const plainField = field === 'frontRich' ? 'front' : 'back';
    newCards[index][plainField] = value.replace(/<[^>]+>/g, '');
    setCards(newCards);
  };

  // カードの保存
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 空のカードを除外
    const validCards = cards.filter(card => card.front.trim() && card.back.trim());
    if (validCards.length === 0) {
      setError('少なくとも1つのカードを入力してください');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/flashcards/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          flashcards: validCards,
          deckId: params.id
        })
      });

      if (!response.ok) {
        throw new Error('カードの保存に失敗しました');
      }

      // 保存成功後、デッキ詳細ページに戻る
      router.push(`/decks/${params.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '不明なエラーが発生しました');
    } finally {
      setIsSaving(false);
    }
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
        <Link href={`/decks/${params.id}`} className="mt-4 inline-block text-blue-600 hover:underline">
          デッキ詳細に戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">カードの追加</h1>
        <div className="flex gap-4">
          <Link
            href={`/decks/${params.id}`}
            className="px-6 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
          >
            戻る
          </Link>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-xl font-semibold mb-2">デッキ情報</h2>
        <p className="text-gray-600">{deck.title}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {cards.map((card, index) => (
          <div key={index} className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">カード {index + 1}</h3>
              {cards.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveCard(index)}
                  className="text-red-600 hover:text-red-800"
                >
                  削除
                </button>
              )}
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  表面（問題）
                </label>
                <RichTextEditor
                  content={card.frontRich || ''}
                  onChange={(value) => handleRichTextChange(index, 'frontRich', value)}
                  placeholder="問題を入力してください"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  裏面（解答）
                </label>
                <RichTextEditor
                  content={card.backRich || ''}
                  onChange={(value) => handleRichTextChange(index, 'backRich', value)}
                  placeholder="解答を入力してください"
                />
              </div>
            </div>
          </div>
        ))}

        <div className="flex justify-between items-center">
          <button
            type="button"
            onClick={handleAddCard}
            className="px-6 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
          >
            カードを追加
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className={`px-6 py-2 bg-blue-600 text-white rounded-md ${
              isSaving ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'
            }`}
          >
            {isSaving ? '保存中...' : '保存'}
          </button>
        </div>
      </form>
    </div>
  );
} 