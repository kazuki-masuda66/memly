import { StreamingTextResponse } from 'ai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Message } from 'ai';

// Google Generative AI APIの設定
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

// Edge Runtimeを指定
export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    // リクエストからJSONを抽出
    const { messages } = await req.json();

    // Googleのモデルを取得
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-001', // Gemini 2.0 Flash モデルを使用
    });

    // メッセージを整形
    const formattedMessages = messages.map((message: Message) => ({
      role: message.role === 'user' ? 'user' : 'model',
      parts: [{ text: message.content }],
    }));

    // Geminiのチャットセッションを開始
    const chat = model.startChat({
      history: formattedMessages.slice(0, -1),
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 500,
      },
    });

    // 最後のメッセージを取得して応答を生成
    const lastMessage = formattedMessages[formattedMessages.length - 1];
    const response = await chat.sendMessage(lastMessage.parts[0].text);
    const responseText = response.response.text();

    // テキストレスポンスを返す（非ストリーミング）
    return new Response(responseText);
  } catch (error) {
    console.error('Gemini APIエラー:', error);
    return new Response('エラーが発生しました', { status: 500 });
  }
} 