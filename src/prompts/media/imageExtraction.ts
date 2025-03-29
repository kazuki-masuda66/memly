/**
 * 画像からテキストを抽出するためのプロンプト
 * @returns テキスト抽出用プロンプト
 */
export const getImageExtractionPrompt = (): string => {
  return "この画像に含まれるすべてのテキストを抽出してください。テーブルやリスト、段落などの構造を可能な限り保持してください。";
};
