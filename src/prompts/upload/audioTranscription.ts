/**
 * アップロードされた音声ファイルから文字起こしを行うためのプロンプト
 * @returns 文字起こし用プロンプト
 */
export const getUploadAudioTranscriptionPrompt = (): string => {
  return "この音声を文字起こししてください。できるだけ正確に書き起こし、話者の区別がある場合は区別してください。句読点や改行を適切に入れてください。";
};
