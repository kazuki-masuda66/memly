import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-admin';
import { randomUUID } from 'crypto';

export const runtime = 'edge';
export const maxDuration = 60; // 60秒

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'ファイルがアップロードされていません' },
        { status: 400 }
      );
    }

    // ファイルタイプの検証
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: '画像ファイルのみアップロード可能です' },
        { status: 400 }
      );
    }

    // ファイルサイズの検証（5MB以下）
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'ファイルサイズは5MB以下にしてください' },
        { status: 400 }
      );
    }

    // ファイル名の生成（一意のIDを使用）
    const fileExt = file.name.split('.').pop();
    const fileName = `${randomUUID()}.${fileExt}`;
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