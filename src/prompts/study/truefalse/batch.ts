/**
 * 複数のフラッシュカードから一括で正誤問題（○×問題）を生成するためのプロンプト
 * @param cards フラッシュカードの配列（front, back, idを含む）
 * @returns システムプロンプトとユーザープロンプトを含むオブジェクト
 */
export const createTrueFalseBatchPrompt = (
  cards: Array<{ front: string; back: string; id: string }>
): { systemPrompt: string; userPrompt: string } => {
  const cardPrompts = cards.map(card => {
    return {
      front: card.front || '',
      back: card.back || '',
      id: card.id
    };
  });

  const systemPrompt = "あなたは教育用の正誤問題（○×問題）を生成するAIです。以下の指示に従って、質の高い正誤問題を生成してください。";
  
  const userPrompt = `以下のフラッシュカードの情報をもとに、各カードにつき正誤問題を2問ずつ生成してください。各カードについて、以下の条件を満たす問題を作成してください：

1. 1問目は「正（true）」の問題：
   - フラッシュカードの内容に完全に一致する正確な事実を述べた文
   - 曖昧な表現を避け、明確かつ具体的な内容にしてください
   - 「〜かもしれない」「〜と思われる」などの不確かな表現は使わないでください

2. 2問目は「誤（false）」の問題：
   - フラッシュカードの内容と明確に矛盾する事実を述べた文
   - 単に否定形にするだけでなく、具体的に間違った情報や数値を含めてください
   - わかりやすく明確な誤りを含め、微妙な表現の違いだけで判断が難しいものは避けてください
   - ただし、あまりに明らかすぎる誤りではなく、理解を確認できる適切な難易度にしてください

3. 一般的な要件：
   - 問題文は簡潔で明確に、1文で表現してください
   - 回答者が答えるのに十分な情報を含めてください
   - 専門用語や概念はフラッシュカードの内容に忠実に使用してください

フラッシュカード：
${JSON.stringify(cardPrompts, null, 2)}

以下の形式のJSONで回答してください：
[
  {
    "cardId": "カードID",
    "questions": [
      {
        "text": "問題文1（正しい文）",
        "isTrue": true
      },
      {
        "text": "問題文2（誤った文）",
        "isTrue": false
      }
    ]
  },
  // 他のカードについても同様に
]`;

  return { systemPrompt, userPrompt };
};
