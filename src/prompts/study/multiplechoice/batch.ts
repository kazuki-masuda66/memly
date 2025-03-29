/**
 * 複数のフラッシュカードから一括で4択クイズを生成するためのプロンプト
 * @param cardsData フラッシュカード情報の配列
 * @returns フォーマット済みプロンプト
 */
export const createMultipleChoiceBatchPrompt = (
  cardsData: Array<{
    id: string;
    front: string;
    back: string;
    decks?: { title?: string };
  }>
): string => {
  let prompt = `
# 課題
複数のフラッシュカードの情報から、それぞれに関連する4択クイズを一括で生成してください。

# フラッシュカードのリスト
`;

  // 各カード情報をプロンプトに追加
  cardsData.forEach((card, index) => {
    prompt += `
## カード ${index + 1}
- ID: ${card.id}
- 問題 (表面): ${card.front}
- 解答 (裏面): ${card.back}
- デッキ名: ${card.decks && card.decks.title ? card.decks.title : '不明'}
`;
  });

  // 出力形式の指定
  prompt += `
# 出力形式
以下のJSON形式で出力してください。各カードごとに1つの4択問題を生成し、IDと選択肢を指定してください：

\`\`\`json
{
  "cards": [
    {
      "id": "カード1のID",
      "choices": [
        {
          "id": "a",
          "text": "正解の選択肢",
          "isCorrect": true
        },
        {
          "id": "b",
          "text": "不正解の選択肢1",
          "isCorrect": false
        },
        {
          "id": "c",
          "text": "不正解の選択肢2",
          "isCorrect": false
        },
        {
          "id": "d",
          "text": "不正解の選択肢3",
          "isCorrect": false
        }
      ]
    },
    // 残りのカードも同様に
  ]
}
\`\`\`

# 要件
- 各カードごとに4つの選択肢を生成してください
- 正解の選択肢は必ず1つだけにしてください
- 不正解の選択肢は、正解に似ているが明らかに異なるものにしてください
- 不正解の選択肢は、正解の内容に関連しているが誤った情報を含むものにしてください
- 選択肢はどの選択肢が正解でも構いません（a, b, c, dのどれか一つが正解）
- JSONのみを出力し、余計な説明や補足は不要です
- 必ずすべてのカードに対して問題を生成してください
`;

  return prompt;
};
