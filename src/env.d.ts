namespace NodeJS {
  interface ProcessEnv {
    OPENAI_API_KEY: string;
    NEXT_PUBLIC_SUPABASE_URL: string;
    NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
    // 他の環境変数を追加する場合はここに定義
  }
}

// ライブラリの型宣言
declare module 'pdf-parse';
declare module 'mammoth'; 