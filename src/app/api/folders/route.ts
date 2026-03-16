import { NextRequest, NextResponse } from 'next/server';
import { query, ensureDb } from '@/lib/db';
import { verifyJwt, extractToken } from '@/lib/auth';

// ── GET - 사용자 폴더 목록 조회 ──
export async function GET(request: NextRequest) {
  try {
    await ensureDb();

    const jwtToken = extractToken(request);
    if (!jwtToken) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }
    const jwtPayload = await verifyJwt(jwtToken);
    if (!jwtPayload) {
      return NextResponse.json({ success: false, error: '인증이 만료되었습니다.' }, { status: 401 });
    }
    const userId = jwtPayload.userId;

    const { searchParams } = new URL(request.url);
    const parentId = searchParams.get('parentId');

    let result;
    if (parentId === 'null' || parentId === null) {
      // 루트 폴더 조회 (parent_id IS NULL이고 사용자가 접근 가능한 폴더)
      result = await query(
        `SELECT f.id, f.name, f.color, f.icon, f."order", f.parent_id, f.type, f.created_at
         FROM folders f
         INNER JOIN user_folders uf ON uf.folder_id = f.id
         WHERE uf.user_id = $1 AND f.parent_id IS NULL
         ORDER BY f."order" ASC, f.created_at ASC`,
        [userId]
      );
    } else {
      // 하위 폴더 조회
      result = await query(
        `SELECT f.id, f.name, f.color, f.icon, f."order", f.parent_id, f.type, f.created_at
         FROM folders f
         INNER JOIN user_folders uf ON uf.folder_id = f.id
         WHERE uf.user_id = $1 AND f.parent_id = $2
         ORDER BY f."order" ASC, f.created_at ASC`,
        [userId, parentId]
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        folders: result.rows,
      },
    });
  } catch (error) {
    console.error('[Folders GET] Error:', error);
    return NextResponse.json({ success: false, error: '폴더 목록 조회 실패' }, { status: 500 });
  }
}
