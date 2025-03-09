'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import RichTextEditor from '@/components/RichTextEditor';

interface Flashcard {
  id: string;
  front: string;
  back: string;
  frontRich?: string | null;
  backRich?: string | null;
  deck_id: number | null;
  created_at: string;
  updated_at: string;
}

interface Deck {
  id: number;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export default function EditCardPage({ 
  params 
}: { 
  params: { id: string; cardId: string } 
}) {
  const router = useRouter();
  const { id: deckId, cardId } = params;
  
  const [flashcard, setFlashcard] = useState<Flashcard | null>(null);
  const [originalFlashcard, setOriginalFlashcard] = useState<Flashcard | null>(null);
  const [deck, setDeck] = useState<Deck | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // フラッシュカードとデッキの情報を取得
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // フラッシュカードの取得
        const cardResponse = await fetch(`/api/flashcards/${cardId}`);
        if (!cardResponse.ok) {
          throw new Error('フラッシュカードの取得に失敗しました');
        }
        const cardData = await cardResponse.json();
        
        // APIのレスポンスフィールド名を調整（front_rich → frontRich など）
        const formattedCard = {
          ...cardData.flashcard,
          frontRich: cardData.flashcard.front_rich,
          backRich: cardData.flashcard.back_rich
        };
        
        // デッキの取得
        const deckResponse = await fetch(`/api/decks/${deckId}`);
        if (!deckResponse.ok) {
          throw new Error('デッキの取得に失敗しました');
        }
        const deckData = await deckResponse.json();
        
        console.log('取得したフラッシュカード:', formattedCard);
        setFlashcard(formattedCard);
        setOriginalFlashcard(JSON.parse(JSON.stringify(formattedCard))); // ディープコピー
        setDeck(deckData.deck);
      } catch (err) {
        setError(err instanceof Error ? err.message : '不明なエラーが発生しました');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [deckId, cardId]);

  // フォーム送信処理
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!flashcard) return;
    
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      const response = await fetch(`/api/flashcards/${cardId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          front: flashcard.front,
          back: flashcard.back,
          frontRich: flashcard.frontRich,
          backRich: flashcard.backRich,
          deck_id: parseInt(deckId)
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '更新に失敗しました');
      }
      
      const data = await response.json();
      setSuccessMessage('フラッシュカードを更新しました');
      
      // デッキ詳細ページに戻る
      router.push(`/decks/${deckId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '不明なエラーが発生しました');
    } finally {
      setSaving(false);
    }
  };

  // カード削除処理
  const handleDelete = async () => {
    if (!confirm('このフラッシュカードを削除してもよろしいですか？')) {
      return;
    }
    
    setSaving(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/flashcards/${cardId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '削除に失敗しました');
      }
      
      // 削除成功後、デッキ詳細ページに戻る
      router.push(`/decks/${deckId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '不明なエラーが発生しました');
    } finally {
      setSaving(false);
    }
  };

  // フィールド更新処理
  const handleChange = (field: keyof Flashcard, value: string) => {
    if (!flashcard) return;
    
    setFlashcard({
      ...flashcard,
      [field]: value
    });
  };

  // リッチテキスト更新処理
  const handleRichTextChange = (field: 'frontRich' | 'backRich', value: string) => {
    if (!flashcard) return;
    
    setFlashcard({
      ...flashcard,
      [field]: value,
      // プレーンテキストも更新
      [field === 'frontRich' ? 'front' : 'back']: value.replace(/<[^>]+>/g, '')
    });
  };

  // 元の状態に戻す
  const handleResetToOriginal = () => {
    if (originalFlashcard) {
      setFlashcard(JSON.parse(JSON.stringify(originalFlashcard)));
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex flex-col items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-gray-600">フラッシュカードを読み込み中...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
        <button
          onClick={() => router.push(`/decks/${deckId}`)}
          className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
        >
          デッキに戻る
        </button>
      </div>
    );
  }

  if (!flashcard || !deck) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
          フラッシュカードまたはデッキが見つかりません
        </div>
        <button
          onClick={() => router.push('/decks')}
          className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
        >
          デッキ一覧に戻る
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">フラッシュカードの編集</h1>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="bg-indigo-500 text-white px-4 py-2 rounded hover:bg-indigo-600"
          >
            {showPreview ? '編集に戻る' : 'プレビュー'}
          </button>
          <button
            onClick={() => router.push(`/decks/${deckId}`)}
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
          >
            キャンセル
          </button>
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">デッキ: {deck?.title}</h2>
          <button
            type="button"
            onClick={handleResetToOriginal}
            className="text-blue-500 hover:text-blue-700"
          >
            元の状態に戻す
          </button>
        </div>
        
        {successMessage && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            {successMessage}
          </div>
        )}
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        {showPreview ? (
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-4">プレビュー</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border rounded-lg p-4">
                <h4 className="font-medium text-gray-700 mb-2">表面（問題）</h4>
                <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: flashcard?.frontRich || flashcard?.front || '' }} />
              </div>
              <div className="border rounded-lg p-4">
                <h4 className="font-medium text-gray-700 mb-2">裏面（解答）</h4>
                <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: flashcard?.backRich || flashcard?.back || '' }} />
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                表面（問題）
              </label>
              <RichTextEditor
                content={flashcard?.frontRich || flashcard?.front || ''}
                onChange={(value) => handleRichTextChange('frontRich', value)}
                placeholder="問題を入力してください"
              />
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                裏面（解答）
              </label>
              <RichTextEditor
                content={flashcard?.backRich || flashcard?.back || ''}
                onChange={(value) => handleRichTextChange('backRich', value)}
                placeholder="解答を入力してください"
              />
            </div>
            
            <div className="flex justify-between">
              <button
                type="button"
                onClick={handleDelete}
                className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 disabled:bg-red-300"
                disabled={saving}
              >
                削除
              </button>
              
              <button
                type="submit"
                className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600 disabled:bg-blue-300"
                disabled={saving}
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
} 