'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// デッキの型定義
interface Deck {
  id: number;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
  card_count?: number;
}

export default function DecksPage() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newDeckTitle, setNewDeckTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();

  // デッキ一覧を取得
  const fetchDecks = async () => {
    try {
      const response = await fetch('/api/decks', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error('デッキの取得に失敗しました');
      }

      const data = await response.json();
      setDecks(data.decks || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '不明なエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  // 初回読み込み時にデッキを取得
  useEffect(() => {
    fetchDecks();
  }, []);

  // 新規デッキ作成
  const handleCreateDeck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeckTitle.trim()) return;

    setIsCreating(true);
    try {
      const response = await fetch('/api/decks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: newDeckTitle.trim() })
      });

      if (!response.ok) {
        throw new Error('デッキの作成に失敗しました');
      }

      // 作成成功後、入力をクリアしてデッキ一覧を更新
      setNewDeckTitle('');
      await fetchDecks();
    } catch (err) {
      setError(err instanceof Error ? err.message : '不明なエラーが発生しました');
    } finally {
      setIsCreating(false);
    }
  };

  // デッキの削除
  const handleDeleteDeck = async (deckId: number) => {
    if (!confirm('このデッキを削除してもよろしいですか？')) return;

    try {
      const response = await fetch(`/api/decks/${deckId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error('デッキの削除に失敗しました');
      }

      // 削除成功後、デッキ一覧を更新
      await fetchDecks();
    } catch (err) {
      setError(err instanceof Error ? err.message : '不明なエラーが発生しました');
    }
  };

  // 日付のフォーマット
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <h1 className="text-3xl font-bold mb-6">デッキ管理</h1>

      {/* エラーメッセージ */}
      {error && (
        <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4 text-red-700">
          <p>{error}</p>
        </div>
      )}

      {/* 新規デッキ作成フォーム */}
      <div className="mb-8 bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">新規デッキ作成</h2>
        <form onSubmit={handleCreateDeck} className="flex gap-4">
          <input
            type="text"
            value={newDeckTitle}
            onChange={(e) => setNewDeckTitle(e.target.value)}
            placeholder="デッキのタイトルを入力"
            className="flex-1 p-2 border rounded-md"
            disabled={isCreating}
          />
          <button
            type="submit"
            disabled={isCreating || !newDeckTitle.trim()}
            className={`px-6 py-2 bg-blue-600 text-white rounded-md ${
              isCreating || !newDeckTitle.trim()
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-blue-700'
            }`}
          >
            {isCreating ? '作成中...' : '作成'}
          </button>
        </form>
      </div>

      {/* デッキ一覧 */}
      {isLoading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          <p className="mt-2">デッキを読み込んでいます...</p>
        </div>
      ) : decks.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <p className="text-lg">デッキがありません</p>
          <p className="text-gray-600 mt-2">
            新しいデッキを作成してフラッシュカードを追加しましょう
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {decks.map((deck) => (
            <div
              key={deck.id}
              className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow"
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-semibold">{deck.title}</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDeleteDeck(deck.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    削除
                  </button>
                </div>
              </div>
              <div className="text-sm text-gray-600">
                <p>作成日: {formatDate(deck.created_at)}</p>
                <p>更新日: {formatDate(deck.updated_at)}</p>
                {deck.card_count !== undefined && (
                  <p>カード数: {deck.card_count}枚</p>
                )}
              </div>
              <div className="mt-4 flex gap-2">
                <Link
                  href={`/decks/${deck.id}`}
                  className="inline-block px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"
                >
                  詳細を見る
                </Link>
                <Link
                  href={`/study?deckId=${deck.id}`}
                  className="inline-block px-4 py-2 bg-green-100 text-green-700 rounded-md hover:bg-green-200"
                >
                  学習を始める
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 