import { NextRequest, NextResponse } from 'next/server';
import { query, ensureDb } from '@/lib/db';
import { verifyJwt } from '@/lib/auth';
import crypto from 'crypto';

// 기본 카테고리 시드 데이터
const DEFAULT_CATEGORIES = [
  { name: '계약', colorBg: '#1D4ED8', colorText: '#ffffff', sortOrder: 0, keywords: '계약,계약서,계약금' },
  { name: '중도금', colorBg: '#2563EB', colorText: '#ffffff', sortOrder: 1, keywords: '중도금,중도' },
  { name: '잔금', colorBg: '#059669', colorText: '#ffffff', sortOrder: 2, keywords: '잔금' },
  { name: '안내', colorBg: '#7C3AED', colorText: '#ffffff', sortOrder: 3, keywords: '안내,공지,통보' },
  { name: '상담', colorBg: '#0F766E', colorText: '#ffffff', sortOrder: 4, keywords: '상담,미팅,회의' },
  { name: '일상', colorBg: '#E5E7EB', colorText: '#111827', sortOrder: 5, keywords: '' },
];

// 기존 유저의 기본 카테고리 keywords 백필용
const DEFAULT_KEYWORDS: Record<string, string> = {
  '계약': '계약,계약서,계약금',
  '중도금': '중도금,중도',
  '잔금': '잔금',
  '안내': '안내,공지,통보',
  '상담': '상담,미팅,회의',
};

/** JWT 인증 헬퍼 - userId를 반환하거나 에러 응답을 반환 */
async function authenticate(request: NextRequest): Promise<string | NextResponse> {
  const jwtToken = request.cookies.get('nepcon-token')?.value;
  if (!jwtToken) {
    return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
  }
  const jwtPayload = await verifyJwt(jwtToken);
  if (!jwtPayload) {
    return NextResponse.json({ success: false, error: '인증이 만료되었습니다.' }, { status: 401 });
  }
  return jwtPayload.userId;
}

/** 같은 팀 폴더(루트 폴더)를 공유하는 다른 멤버 userId 목록 반환 */
async function getTeamMemberIds(userId: string): Promise<string[]> {
  const result = await query(
    `SELECT DISTINCT uf2.user_id FROM user_folders uf1
     JOIN user_folders uf2 ON uf1.folder_id = uf2.folder_id
     JOIN folders f ON f.id = uf1.folder_id
     WHERE uf1.user_id = $1 AND uf2.user_id != $1
     AND f.parent_id IS NULL`,
    [userId]
  );
  return result.rows.map((r: { user_id: string }) => r.user_id);
}

// GET - 사용자의 카테고리 목록 조회 (없으면 기본 카테고리 자동 생성)
export async function GET(request: NextRequest) {
  try {
    await ensureDb();

    // keywords 컬럼 안전하게 추가 (없으면 추가)
    try {
      await query(`ALTER TABLE event_categories ADD COLUMN IF NOT EXISTS keywords TEXT NOT NULL DEFAULT ''`);
    } catch {
      // 이미 존재하면 무시
    }

    const authResult = await authenticate(request);
    if (authResult instanceof NextResponse) return authResult;
    const userId = authResult;

    // 카테고리 조회
    let result = await query(
      `SELECT * FROM event_categories WHERE user_id = $1 ORDER BY sort_order, created_at`,
      [userId]
    );

    // 카테고리가 없으면 기본 카테고리 시드
    if (result.rows.length === 0) {
      const now = new Date().toISOString();
      for (const cat of DEFAULT_CATEGORIES) {
        const id = crypto.randomUUID();
        await query(
          `INSERT INTO event_categories (id, user_id, name, color_bg, color_text, sort_order, is_default, keywords, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8)`,
          [id, userId, cat.name, cat.colorBg, cat.colorText, cat.sortOrder, cat.keywords, now]
        );
      }

      // 생성 후 다시 조회
      result = await query(
        `SELECT * FROM event_categories WHERE user_id = $1 ORDER BY sort_order, created_at`,
        [userId]
      );
    }

    // keywords 백필: 기본 카테고리에 키워드가 비어있으면 채우기
    for (const row of result.rows) {
      if (row.is_default && (!row.keywords || row.keywords === '') && DEFAULT_KEYWORDS[row.name]) {
        await query(
          'UPDATE event_categories SET keywords = $1 WHERE id = $2',
          [DEFAULT_KEYWORDS[row.name], row.id]
        );
        row.keywords = DEFAULT_KEYWORDS[row.name];
      }
    }

    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[Calendar Categories GET] Error:', error);
    return NextResponse.json({ success: false, error: '카테고리 조회 실패' }, { status: 500 });
  }
}

// POST - 새 카테고리 추가
export async function POST(request: NextRequest) {
  try {
    await ensureDb();

    const authResult = await authenticate(request);
    if (authResult instanceof NextResponse) return authResult;
    const userId = authResult;

    const body = await request.json();
    const { name, colorBg, colorText, keywords } = body;

    if (!name) {
      return NextResponse.json({ success: false, error: '카테고리 이름이 필요합니다.' }, { status: 400 });
    }

    // 현재 max sort_order 조회
    const maxResult = await query(
      `SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM event_categories WHERE user_id = $1`,
      [userId]
    );
    const nextOrder = (maxResult.rows[0]?.max_order ?? -1) + 1;

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await query(
      `INSERT INTO event_categories (id, user_id, name, color_bg, color_text, sort_order, is_default, keywords, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, false, $7, $8)`,
      [id, userId, name, colorBg || '#f3f4f6', colorText || '#374151', nextOrder, keywords || '', now]
    );

    // 팀 멤버에게 동일 카테고리 동기화 (없는 경우에만 생성)
    try {
      const memberIds = await getTeamMemberIds(userId);
      for (const memberId of memberIds) {
        const existing = await query(
          `SELECT id FROM event_categories WHERE user_id = $1 AND name = $2`,
          [memberId, name]
        );
        if (existing.rows.length === 0) {
          const memberMaxResult = await query(
            `SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM event_categories WHERE user_id = $1`,
            [memberId]
          );
          const memberNextOrder = (memberMaxResult.rows[0]?.max_order ?? -1) + 1;
          await query(
            `INSERT INTO event_categories (id, user_id, name, color_bg, color_text, sort_order, is_default, keywords, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, false, $7, $8)`,
            [crypto.randomUUID(), memberId, name, colorBg || '#f3f4f6', colorText || '#374151', memberNextOrder, keywords || '', now]
          );
        }
      }
    } catch (syncErr) {
      console.error('[Categories POST] 팀 멤버 동기화 실패:', syncErr);
    }

    return NextResponse.json({
      success: true,
      data: {
        id,
        user_id: userId,
        name,
        color_bg: colorBg || '#f3f4f6',
        color_text: colorText || '#374151',
        sort_order: nextOrder,
        is_default: false,
        keywords: keywords || '',
        created_at: now,
      },
    });
  } catch (error) {
    console.error('[Calendar Categories POST] Error:', error);
    return NextResponse.json({ success: false, error: '카테고리 추가 실패' }, { status: 500 });
  }
}

// PUT - 카테고리 수정 (is_default 카테고리도 name/color 수정 가능)
export async function PUT(request: NextRequest) {
  try {
    await ensureDb();

    const authResult = await authenticate(request);
    if (authResult instanceof NextResponse) return authResult;
    const userId = authResult;

    const body = await request.json();
    const { id, name, colorBg, colorText, sortOrder, keywords } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: '카테고리 id가 필요합니다.' }, { status: 400 });
    }

    const fields: string[] = [];
    const values: (string | number | boolean | null)[] = [];
    let paramIndex = 1;

    if (name !== undefined) { fields.push(`name = $${paramIndex++}`); values.push(name); }
    if (colorBg !== undefined) { fields.push(`color_bg = $${paramIndex++}`); values.push(colorBg); }
    if (colorText !== undefined) { fields.push(`color_text = $${paramIndex++}`); values.push(colorText); }
    if (sortOrder !== undefined) { fields.push(`sort_order = $${paramIndex++}`); values.push(sortOrder); }
    if (keywords !== undefined) { fields.push(`keywords = $${paramIndex++}`); values.push(keywords); }

    if (fields.length === 0) {
      return NextResponse.json({ success: false, error: '수정할 항목이 없습니다.' }, { status: 400 });
    }

    values.push(id, userId);

    const result = await query(
      `UPDATE event_categories SET ${fields.join(', ')} WHERE id = $${paramIndex++} AND user_id = $${paramIndex}`,
      values
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ success: false, error: '카테고리를 찾을 수 없습니다.' }, { status: 404 });
    }

    // keywords가 변경된 경우 기존 이벤트의 event_type을 재평가
    if (keywords !== undefined) {
      // 해당 사용자의 모든 카테고리 조회 (keywords 포함)
      const allCatsResult = await query(
        `SELECT name, keywords FROM event_categories WHERE user_id = $1`,
        [userId]
      );
      const allCategories = allCatsResult.rows as { name: string; keywords: string }[];

      // 해당 사용자의 모든 활성 이벤트 조회
      const allEventsResult = await query(
        `SELECT id, title, event_type FROM calendar_events
         WHERE folder_id IN (SELECT folder_id FROM user_folders WHERE user_id = $1)`,
        [userId]
      );
      const allEvents = allEventsResult.rows as { id: string; title: string; event_type: string }[];

      // 각 이벤트의 event_type을 재계산
      const toUpdate: { id: string; newType: string }[] = [];
      for (const event of allEvents) {
        let matched = '일상';
        for (const cat of allCategories) {
          if (!cat.keywords) continue;
          const kws = cat.keywords.split(',').map((k: string) => k.trim()).filter(Boolean);
          if (kws.some((kw: string) => event.title.includes(kw))) {
            matched = cat.name;
            break;
          }
        }
        if (matched !== event.event_type) {
          toUpdate.push({ id: event.id, newType: matched });
        }
      }

      // 변경이 필요한 이벤트만 UPDATE
      for (const item of toUpdate) {
        await query(
          `UPDATE calendar_events SET event_type = $1 WHERE id = $2`,
          [item.newType, item.id]
        );
      }
    }

    // 팀 멤버에게 색상/keywords 변경 동기화
    try {
      // 수정된 카테고리의 name 조회
      const catNameResult = await query(
        `SELECT name FROM event_categories WHERE id = $1 AND user_id = $2`,
        [id, userId]
      );
      if (catNameResult.rows.length > 0) {
        const catName = catNameResult.rows[0].name;
        const memberIds = await getTeamMemberIds(userId);
        for (const memberId of memberIds) {
          const memberCat = await query(
            `SELECT id FROM event_categories WHERE user_id = $1 AND name = $2`,
            [memberId, catName]
          );
          const syncFields: string[] = [];
          const syncValues: (string | number | boolean | null)[] = [];
          let syncIdx = 1;
          if (colorBg !== undefined) { syncFields.push(`color_bg = $${syncIdx++}`); syncValues.push(colorBg); }
          if (colorText !== undefined) { syncFields.push(`color_text = $${syncIdx++}`); syncValues.push(colorText); }
          if (keywords !== undefined) { syncFields.push(`keywords = $${syncIdx++}`); syncValues.push(keywords); }
          if (syncFields.length === 0) continue;

          if (memberCat.rows.length > 0) {
            syncValues.push(memberCat.rows[0].id, memberId);
            await query(
              `UPDATE event_categories SET ${syncFields.join(', ')} WHERE id = $${syncIdx++} AND user_id = $${syncIdx}`,
              syncValues
            );
          } else {
            // 멤버에게 해당 카테고리 없으면 생성
            const memberMaxResult = await query(
              `SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM event_categories WHERE user_id = $1`,
              [memberId]
            );
            const memberNextOrder = (memberMaxResult.rows[0]?.max_order ?? -1) + 1;
            const now = new Date().toISOString();
            await query(
              `INSERT INTO event_categories (id, user_id, name, color_bg, color_text, sort_order, is_default, keywords, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, false, $7, $8)`,
              [crypto.randomUUID(), memberId, catName, colorBg || '#f3f4f6', colorText || '#374151', memberNextOrder, keywords || '', now]
            );
          }
        }
      }
    } catch (syncErr) {
      console.error('[Categories PUT] 팀 멤버 동기화 실패:', syncErr);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Calendar Categories PUT] Error:', error);
    return NextResponse.json({ success: false, error: '카테고리 수정 실패' }, { status: 500 });
  }
}

// DELETE - 카테고리 삭제 (해당 카테고리를 사용 중인 이벤트는 '일상'으로 변경)
export async function DELETE(request: NextRequest) {
  try {
    await ensureDb();

    const authResult = await authenticate(request);
    if (authResult instanceof NextResponse) return authResult;
    const userId = authResult;

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: '카테고리 id가 필요합니다.' }, { status: 400 });
    }

    // 삭제 대상 카테고리의 이름 조회
    const catResult = await query(
      `SELECT name FROM event_categories WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    if (catResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: '카테고리를 찾을 수 없습니다.' }, { status: 404 });
    }

    const categoryName = catResult.rows[0].name;

    // 해당 카테고리를 사용 중인 이벤트의 event_type을 '일상'으로 변경
    await query(
      `UPDATE calendar_events SET event_type = '일상' WHERE event_type = $1 AND folder_id IN (SELECT folder_id FROM user_folders WHERE user_id = $2)`,
      [categoryName, userId]
    );

    // 카테고리 삭제
    await query(
      `DELETE FROM event_categories WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    // 팀 멤버의 동일 이름 카테고리도 삭제 + 해당 이벤트 '일상'으로 변경
    try {
      const memberIds = await getTeamMemberIds(userId);
      for (const memberId of memberIds) {
        // 멤버의 이벤트 event_type을 '일상'으로 변경
        await query(
          `UPDATE calendar_events SET event_type = '일상' WHERE event_type = $1 AND folder_id IN (SELECT folder_id FROM user_folders WHERE user_id = $2)`,
          [categoryName, memberId]
        );
        // 멤버의 동일 이름 카테고리 삭제
        await query(
          `DELETE FROM event_categories WHERE user_id = $1 AND name = $2`,
          [memberId, categoryName]
        );
      }
    } catch (syncErr) {
      console.error('[Categories DELETE] 팀 멤버 동기화 실패:', syncErr);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Calendar Categories DELETE] Error:', error);
    return NextResponse.json({ success: false, error: '카테고리 삭제 실패', detail: String(error) }, { status: 500 });
  }
}
