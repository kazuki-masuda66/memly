import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Google Generative AI APIの初期化
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

// Edge Runtimeを指定
export const runtime = 'edge';

// 最大実行時間を60秒に設定
export const maxDuration = 60;

// リクエストの型定義
interface FlashcardRequest {
  text: string;
  questionCount?: number | 'auto' | 'max';
  range?: string;
  complexity?: 'simple' | 'medium' | 'detailed';
  language?: string;
}

// レスポンスの型定義
interface Flashcard {
  front: string;
  back: string;
  frontRich?: string; // HTML形式のリッチテキスト
  backRich?: string;  // HTML形式のリッチテキスト
}

interface FlashcardResponse {
  flashcards: Flashcard[];
}

export async function POST(req: Request) {
  console.log('フラッシュカードAPI: リクエスト受信');
  
  try {
    // リクエストボディを取得
    const rawInput = await req.text();
    console.log('フラッシュカードAPI: 入力テキスト受信', rawInput.substring(0, 100) + '...');
    
    // JSONとしてパース
    let body: FlashcardRequest;
    try {
      const parsedJson = JSON.parse(rawInput);
      
      // promptフィールドがある場合の処理（vercel ai SDKの場合）
      if (parsedJson.prompt) {
        try {
          // promptフィールドの値がJSON文字列の場合、再度パースする
          body = JSON.parse(parsedJson.prompt) as FlashcardRequest;
          console.log('フラッシュカードAPI: promptフィールドからJSONをパース');
        } catch (promptParseError) {
          // promptフィールドの値が文字列の場合はそのまま使用
          body = { text: parsedJson.prompt };
          console.log('フラッシュカードAPI: promptフィールドを直接テキストとして使用');
        }
      } else {
        // 直接FlashcardRequestの形式で送信された場合
        body = parsedJson as FlashcardRequest;
        console.log('フラッシュカードAPI: 直接JSONオブジェクトを使用');
      }
    } catch (e) {
      console.error('JSONパースエラー:', e);
      return NextResponse.json(
        { error: { message: 'リクエストデータが不正なJSON形式です' } },
        { status: 400 }
      );
    }
    
    // 入力バリデーション
    if (!body.text) {
      console.error('フラッシュカードAPI: テキストが空');
      return NextResponse.json(
        { error: { message: '必須フィールド "text" が不足しています' } },
        { status: 400 }
      );
    }

    // デフォルト値の設定
    const questionCount = body.questionCount || 'auto';
    const range = body.range || '全体';
    const complexity = body.complexity || 'medium';
    const language = body.language || 'ja';

    console.log('フラッシュカードAPI: パラメータ設定完了', { questionCount, complexity, language });

    // Geminiへのプロンプト作成
    const prompt = `あなたはフラッシュカード作成のアシスタントAIです。

以下の情報をもとに、フラッシュカードを作成してください。

【元テキスト】:
${body.text}

【出題範囲・トピック】:
${range}

【問題数】:
${questionCount}
- 数値が指定されている場合はその数だけ作成してください。
- 「auto」の場合は、テキストの長さと内容に応じて適切な枚数を自動で決めてください。
- 「max」の場合は、テキストから抽出できる可能な限り多くの問題を作成してください。テキストの内容を十分に網羅するように努めてください。

【複雑さ】:
${complexity}
- 「simple」→ 問題文、回答ともにシンプルかつ短め（1～2文程度）
- 「medium」→ ポイントをしっかり押さえた説明（2～4文程度）、例を用意する
- 「detailed」→ 詳細な解説や補足情報、必要に応じて箇条書き・複数例を挙げるなどして詳しく（4文以上など）

【言語】:
${language}
- 出力する際のメインの説明や質問文はこの言語をベースにしてください。
- もし言語が「ja」（日本語）で、テキストが英語の場合は、それをすべて日本語に翻訳するのではなく、英語のまま活用しながら（問題文や例文などに英語を残す）、必要な解説や案内は日本語で加えてください。これは英語を学ぶための問題として扱うためです。
- テキストが日本語で、言語も「ja」の場合は、そのまま日本語で問題と解説を作成してください。
- 言語が「en」（英語）の場合は、テキストの言語に関わらず、必ず全てのフラッシュカードのfront, back, frontRich, backRichを英語で作成してください。テキストが他の言語（日本語など）であっても、全ての内容を英語に翻訳して英語だけのフラッシュカードを作成してください。

---

【フラッシュカードの形式】:
JSON形式で以下の構造で返してください。

{ 
  "flashcards": [ 
    { 
      "front": "問題や質問文を記述（プレーンテキスト）", 
      "back": "答え・解説を記述（プレーンテキスト）",
      "frontRich": "問題や質問文をHTML形式で記述（リッチテキスト）", 
      "backRich": "答え・解説をHTML形式で記述（リッチテキスト）" 
    }, 
    { "front": "...", "back": "...", "frontRich": "...", "backRich": "..." } 
  ] 
}

- \`front\`と\`back\`には必ずプレーンテキスト版を記載してください（互換性のため）。
- \`frontRich\`と\`backRich\`にはHTML形式でリッチなフォーマットを適用してください：
  - 重要なポイントは<strong>タグや<mark>タグでハイライト
  - 箇条書きには<ul>と<li>タグを使用
  - 段落は<p>タグで分割
  - 見出しやサブセクションには<h4>、<h5>タグを使用可能
  - 例文や引用は<blockquote>タグを使用可能

使用可能なHTMLタグ: p, strong, em, mark, ul, ol, li, blockquote, h4, h5, br, code

---

【重要な注意点】:
1. テキストが英語だがユーザー指定言語が日本語の場合、**英語の文章をすべて機械的に和訳せず**、問題部分や例文は英語のまま活用してください。
2. ただし、日本語ユーザーが理解しやすいよう、解説や必要最低限の補足は日本語で行ってください。
3. テキストが日本語で、ユーザー指定言語も日本語の場合は、そのまま日本語で問題・解説を作成してください。
4. テキストの言語に関係なく、言語指定が「en」（英語）の場合は、必ず全ての内容を英語で作成してください。一切の日本語や他言語を使用せず、100%英語だけのフラッシュカードにしてください。日本語のテキストが含まれている場合でも、すべて英語に翻訳して英語のフラッシュカードを作成してください。
5. 言語の問題（英語学習など）の場合は、解説にできるだけ例文を表示するようにしてください。
6. **複雑さ（complexity）のレベルをきちんと反映**してください。
   - **simple**: 問題文と回答を短くまとめる（1～2文程度）。不要に詳細な解説は避ける。
   - **medium**: ポイントを押さえつつ適度なボリューム（2～4文程度）。例文やポイントの簡潔な補足を含む。
   - **detailed**: できる限り詳細に（4文以上の丁寧な解説）。必要に応じて複数の例文や箇条書きを交える。
7. **リッチテキスト形式で魅力的に整形してください**。
   - 重要なキーワードや概念には**太字**や<mark>ハイライト</mark>を適用してください。
   - 長い解説や複数のポイントがある場合は箇条書きを使用して整理してください。
   - 情報の階層構造を明確にするため、見出しやサブセクションを活用してください。
   - 例文や引用は引用ブロックを使用して視覚的に区別してください。
   - プレーンテキスト版とリッチテキスト版の両方を必ず提供してください。

【言語指定の厳守について - 最重要事項】:
- 言語指定が「en」（英語）の場合は、例外なく全ての出力を英語のみで行ってください。入力テキストが日本語であっても、必ず英語に翻訳して英語でフラッシュカードを作成してください。
- 言語指定が「ja」（日本語）の場合でも、4の注意点に従い、英語のテキストは原則として翻訳せず英語のまま引用し、解説を日本語で行ってください。
- 出力フラッシュカードの言語が指定された言語と一致していない場合、タスクは失敗とみなされます。

以上の要件を踏まえて、フラッシュカードを生成してください。
必ず有効なJSON形式で返してください。`;

    console.log('フラッシュカードAPI: Gemini API呼び出し開始');

    // Gemini APIを呼び出し
    try {
      // Googleのモデルを取得
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash-001', // Gemini 2.0 Flash モデルを使用
      });

      // プロンプトを送信して応答を得る
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const responseText = response.text();

      console.log('フラッシュカードAPI: Gemini API呼び出し成功');

      return new Response(responseText, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (geminierror) {
      console.error('Gemini APIエラー:', geminierror);
      throw geminierror;
    }
    
  } catch (error: unknown) {
    console.error('APIエラー:', error);
    
    // サーバーエラーレスポンス
    return NextResponse.json(
      { 
        error: { 
          message: 'サーバーエラーが発生しました', 
          details: error instanceof Error ? error.message : '不明なエラー' 
        } 
      },
      { status: 500 }
    );
  }
} 