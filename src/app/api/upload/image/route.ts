import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-admin';

export const runtime = 'edge';
export const maxDuration = 60; // 60秒

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'ファイルが提供されていません' },
        { status: 400 }
      );
    }

    // 画像ファイルかどうかを確認
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { success: false, error: '画像ファイルのみアップロードできます' },
        { status: 400 }
      );
    }

    // ファイルサイズの制限（10MB）
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: 'ファイルサイズは10MB以下にしてください' },
        { status: 400 }
      );
    }

    // ファイル名の生成（一意のIDを使用）
    const fileExt = file.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `public/images/${fileName}`;

    // ファイルをArrayBufferに変換
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Supabase Storageにアップロード
    const { data, error } = await supabase.storage
      .from('images')
      .upload(filePath, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw error;

    // 画像のURLを取得
    const { data: { publicUrl } } = supabase.storage
      .from('images')
      .getPublicUrl(filePath);

    return NextResponse.json({
      success: true,
      url: publicUrl,
      message: '画像がアップロードされました'
    });

  } catch (error) {
    console.error('画像アップロードエラー:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : '画像のアップロードに失敗しました'
      },
      { status: 500 }
    );
  }
}