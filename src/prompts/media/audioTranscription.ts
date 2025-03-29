/**
 * 音声ファイルから文字起こしを行うためのプロンプト
 * @returns 文字起こし用プロンプト
 */
export const getAudioTranscriptionPrompt = (): string => {
  return "以下の音声を文字起こししてください。話者の区別、句読点、段落分けなどを適切に行ってください。";
};
