const https = require('https');
const http = require('http');
const xml2js = require('xml2js');

// テストするYouTube動画ID
const videoId = 'jNQXAC9IVRw'; // "Me at the zoo" - YouTubeの最初の動画

// TimedText APIを使用して字幕トラック一覧を取得する関数
function getAvailableCaptionTracks(videoId) {
  return new Promise((resolve, reject) => {
    const url = `http://video.google.com/timedtext?type=list&v=${videoId}`;
    
    console.log(`字幕トラック一覧を取得: ${url}`);
    
    http.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', async () => {
        try {
          // レスポンスが空の場合
          if (!data || data.trim() === '') {
            console.log('利用可能な字幕トラックが見つかりませんでした');
            return resolve([]);
          }
          
          // XMLを解析
          const parser = new xml2js.Parser();
          parser.parseString(data, (err, result) => {
            if (err) {
              console.error('XML解析エラー:', err);
              return reject(err);
            }
            
            if (!result || !result.transcript_list || !result.transcript_list.track) {
              console.log('字幕トラックが見つかりませんでした');
              return resolve([]);
            }
            
            const tracks = Array.isArray(result.transcript_list.track) 
              ? result.transcript_list.track 
              : [result.transcript_list.track];
              
            const trackInfos = tracks.map(track => ({
              lang_code: track.$.lang_code,
              lang_original: track.$.lang_original,
              lang_translated: track.$.lang_translated,
              name: track.$.name || ''
            }));
            
            console.log(`${trackInfos.length}個の字幕トラックが見つかりました`);
            trackInfos.forEach(track => {
              console.log(`- 言語: ${track.lang_original} (${track.lang_code})${track.name ? ', 名前: ' + track.name : ''}`);
            });
            
            resolve(trackInfos);
          });
        } catch (error) {
          console.error('字幕トラック一覧の処理中にエラーが発生しました:', error);
          reject(error);
        }
      });
    }).on('error', (error) => {
      console.error(`字幕トラック一覧取得エラー: ${error.message}`);
      reject(error);
    });
  });
}

// TimedText APIから字幕を取得する関数
function getTimedTextCaptions(videoId, langCode = '', name = '') {
  return new Promise((resolve, reject) => {
    let url = `http://video.google.com/timedtext?v=${videoId}`;
    
    // 言語コードが指定されている場合は追加
    if (langCode) {
      url += `&lang=${langCode}`;
    }
    
    // 字幕トラック名が指定されている場合は追加
    if (name) {
      url += `&name=${encodeURIComponent(name)}`;
    }
    
    console.log(`TimedText APIを呼び出し: ${url}`);
    
    http.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', async () => {
        try {
          // レスポンスが空の場合
          if (!data || data.trim() === '') {
            console.log(`言語コード '${langCode}' の字幕は存在しません`);
            return resolve([]);
          }
          
          // XMLを解析
          const parser = new xml2js.Parser({ explicitArray: false });
          parser.parseString(data, (err, result) => {
            if (err) {
              console.error('XML解析エラー:', err);
              return reject(err);
            }
            
            if (!result || !result.transcript || !result.transcript.text) {
              console.log('字幕データが見つかりませんでした');
              return resolve([]);
            }
            
            // 字幕データを整形
            const textEntries = Array.isArray(result.transcript.text) 
              ? result.transcript.text 
              : [result.transcript.text];
              
            const captions = textEntries.map(entry => ({
              text: entry._ || entry,
              start: parseFloat(entry.$ ? entry.$.start : 0),
              duration: parseFloat(entry.$ ? entry.$.dur : 0)
            }));
            
            console.log(`${captions.length}件の字幕を取得しました`);
            resolve(captions);
          });
        } catch (error) {
          console.error('字幕データの処理中にエラーが発生しました:', error);
          reject(error);
        }
      });
    }).on('error', (error) => {
      console.error(`TimedText API呼び出しエラー: ${error.message}`);
      reject(error);
    });
  });
}

// メイン処理
async function main() {
  try {
    console.log(`YouTube動画ID: ${videoId}の字幕を取得しています...`);
    
    // 1. 利用可能な字幕トラックを取得
    console.log('\n=== 1. 利用可能な字幕トラックを取得 ===');
    const tracks = await getAvailableCaptionTracks(videoId);
    
    // 2. 字幕トラックから字幕を取得
    console.log('\n=== 2. 字幕トラックから字幕を取得 ===');
    if (tracks.length > 0) {
      // 日本語の字幕を優先
      const jaTrack = tracks.find(track => track.lang_code === 'ja');
      if (jaTrack) {
        console.log('日本語の字幕を取得します');
        const jaCaptions = await getTimedTextCaptions(videoId, jaTrack.lang_code, jaTrack.name);
        console.log('サンプル字幕:', jaCaptions.slice(0, 3));
      } else {
        // 英語の字幕を次に優先
        const enTrack = tracks.find(track => track.lang_code === 'en');
        if (enTrack) {
          console.log('英語の字幕を取得します');
          const enCaptions = await getTimedTextCaptions(videoId, enTrack.lang_code, enTrack.name);
          console.log('サンプル字幕:', enCaptions.slice(0, 3));
        } else if (tracks.length > 0) {
          // 最初の利用可能な字幕を取得
          const firstTrack = tracks[0];
          console.log(`${firstTrack.lang_original}の字幕を取得します`);
          const captions = await getTimedTextCaptions(videoId, firstTrack.lang_code, firstTrack.name);
          console.log('サンプル字幕:', captions.slice(0, 3));
        }
      }
    } else {
      console.log('利用可能な字幕トラックがありません');
    }
    
    console.log('\nテスト完了');
  } catch (error) {
    console.error('エラーが発生しました:', error);
  }
}

// 実行
main(); 