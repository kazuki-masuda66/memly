// YouTube字幕取得のテストスクリプト
const { YoutubeTranscript } = require('youtube-transcript');

// テスト用のYouTube動画ID（「Me at the zoo」- YouTubeの最初の動画）
const videoId = 'jNQXAC9IVRw';

async function getTranscripts() {
  try {
    console.log(`動画ID ${videoId} の字幕を取得中...`);
    
    // 字幕を取得
    const transcripts = await YoutubeTranscript.fetchTranscript(videoId);
    
    console.log('字幕の取得に成功しました:');
    console.log(`${transcripts.length}件の字幕エントリが見つかりました`);
    
    // 最初の数件の字幕を表示
    console.log('\n最初の5件の字幕:');
    transcripts.slice(0, 5).forEach((entry, index) => {
      console.log(`[${index + 1}] ${entry.text} (開始: ${entry.offset}ms, 長さ: ${entry.duration}ms)`);
    });
    
    return transcripts;
  } catch (error) {
    console.error('字幕の取得中にエラーが発生しました:', error.message);
    return null;
  }
}

// スクリプトを実行
getTranscripts()
  .then(result => {
    if (result) {
      console.log('\n字幕テキスト全体:');
      console.log(result.map(entry => entry.text).join(' '));
    }
  })
  .catch(error => {
    console.error('実行エラー:', error);
  }); 