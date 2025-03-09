import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold mb-4">Memly API</h1>
        <p className="text-xl">Vercel AI SDKを使用したAPIサーバー</p>
        
        <div className="mt-12">
          <h2 className="text-2xl font-bold mb-4">利用可能なAPIエンドポイント</h2>
          <ul className="space-y-4">
            <li>
              <div className="font-medium">APIエンドポイント: <code className="bg-gray-100 p-1 rounded">/api/chat</code></div>
              <p className="text-gray-600">AIによるチャットレスポンスを提供します</p>
            </li>
            <li>
              <div className="font-medium">APIエンドポイント: <code className="bg-gray-100 p-1 rounded">/api/flashcards</code></div>
              <p className="text-gray-600">AIによるフラッシュカード生成を提供します</p>
            </li>
          </ul>
        </div>
        
        <div className="mt-12">
          <h2 className="text-2xl font-bold mb-4">デモページ</h2>
          <ul className="space-y-4">
            <li>
              <Link href="/flashcards" className="text-blue-600 hover:underline">
                フラッシュカード生成デモ
              </Link>
              <p className="text-gray-600">APIを使ったフラッシュカード生成のデモンストレーション</p>
            </li>
          </ul>
        </div>
      </div>
    </main>
  );
} 