import { NextRequest, NextResponse } from 'next/server';
import { query, ensureDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { verifyJwt } from '@/lib/auth';

// GET - 이벤트 목록 조회
export async function GET(request: NextRequest) {
  try {
    await ensureDb();

    // JWT 인증
    const jwtToken = request.cookies.get('nepcon-token')?.value;
    if (!jwtToken) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }
    const jwtPayload = await verifyJwt(jwtToken);
    if (!jwtPayload) {
      return NextResponse.json({ success: false, error: '인증이 만료되었습니다.' }, { status: 401 });
    }
    const userId = jwtPayload.userId;

    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get('folderId');
    const spaceTypes = searchParams.get('spaceTypes');
    const year = searchParams.get('year');
    const month = searchParams.get('month');

    // spaceTypes 기반 조회 (folderId 없을 때)
    if (!folderId && spaceTypes) {
      const types = spaceTypes.split(',').filter(t => t === 'team' || t === 'personal');
      if (types.length === 0) {
        return NextResponse.json({ success: false, error: '유효한 spaceTypes가 필요합니다.' }, { status: 400 });
      }

      // 동적 파라미터 빌드: types를 $1, $2, ... 로 매핑, 마지막에 userId 추가
      const typePlaceholders = types.map((_, i) => `$${i + 1}`).join(', ');
      const userIdIdx = types.length + 1;
      const params: (string | number | boolean | null | undefined)[] = [...types, userId];

      let result;
      if (year && month) {
        const startDate = `${year}-${month.padStart(2, '0')}-01`;
        const endDate = `${year}-${month.padStart(2, '0')}-31`;
        const dateStartIdx = params.length + 1;
        const dateEndIdx = params.length + 2;
        params.push(startDate, endDate);
        result = await query(
          `SELECT ce.*, COALESCE(rf.name, df.name) AS folder_name, COALESCE(rf.type, df.type) AS folder_type
           FROM calendar_events ce
           LEFT JOIN folders df ON df.id = ce.folder_id
           LEFT JOIN folders rf ON rf.id = df.parent_id
           WHERE ce.folder_id IN (
             SELECT id FROM folders WHERE type IN (${typePlaceholders}) AND parent_id IS NULL
               AND id IN (SELECT folder_id FROM user_folders WHERE user_id = $${userIdIdx})
             UNION ALL
             SELECT id FROM folders WHERE parent_id IN (
               SELECT id FROM folders WHERE type IN (${typePlaceholders}) AND parent_id IS NULL
                 AND id IN (SELECT folder_id FROM user_folders WHERE user_id = $${userIdIdx})
             )
           )
           AND (
             (ce.event_end_date IS NULL AND ce.event_date >= $${dateStartIdx} AND ce.event_date <= $${dateEndIdx})
             OR
             (ce.event_end_date IS NOT NULL AND ce.event_date <= $${dateEndIdx} AND ce.event_end_date >= $${dateStartIdx})
           )
           AND ce.deleted_at IS NULL
           ORDER BY ce.event_date ASC, ce.event_time ASC NULLS LAST, ce.created_at ASC`,
          params
        );
      } else {
        result = await query(
          `SELECT ce.*, COALESCE(rf.name, df.name) AS folder_name, COALESCE(rf.type, df.type) AS folder_type
           FROM calendar_events ce
           LEFT JOIN folders df ON df.id = ce.folder_id
           LEFT JOIN folders rf ON rf.id = df.parent_id
           WHERE ce.folder_id IN (
             SELECT id FROM folders WHERE type IN (${typePlaceholders}) AND parent_id IS NULL
               AND id IN (SELECT folder_id FROM user_folders WHERE user_id = $${userIdIdx})
             UNION ALL
             SELECT id FROM folders WHERE parent_id IN (
               SELECT id FROM folders WHERE type IN (${typePlaceholders}) AND parent_id IS NULL
                 AND id IN (SELECT folder_id FROM user_folders WHERE user_id = $${userIdIdx})
             )
           )
           AND ce.deleted_at IS NULL
           ORDER BY ce.event_date ASC, ce.event_time ASC NULLS LAST, ce.created_at ASC`,
          params
        );
      }

      return NextResponse.json({ success: true, data: result.rows });
    }

    if (!folderId) {
      return NextResponse.json({ success: false, error: 'folderId가 필요합니다.' }, { status: 400 });
    }

    // folderId 기반 조회 시에도 해당 사용자의 폴더인지 검증
    const folderCheck = await query(
      `SELECT 1 FROM user_folders WHERE user_id = $1 AND (folder_id = $2 OR folder_id = (SELECT parent_id FROM folders WHERE id = $2))`,
      [userId, folderId]
    );
    if (folderCheck.rows.length === 0) {
      return NextResponse.json({ success: false, error: '접근 권한이 없는 폴더입니다.' }, { status: 403 });
    }

    // 서브폴더 포함 이벤트 조회 (단일 쿼리로 처리, 폴더 정보 포함)
    let result;
    if (year && month) {
      // 해당 월의 시작일~종료일 범위로 조회
      const startDate = `${year}-${month.padStart(2, '0')}-01`;
      const endDate = `${year}-${month.padStart(2, '0')}-31`;
      result = await query(
        `SELECT ce.*, COALESCE(rf.name, df.name) AS folder_name, COALESCE(rf.type, df.type) AS folder_type
         FROM calendar_events ce
         LEFT JOIN folders df ON df.id = ce.folder_id
         LEFT JOIN folders rf ON rf.id = df.parent_id
         WHERE (ce.folder_id = $1 OR ce.folder_id IN (SELECT id FROM folders WHERE parent_id = $1))
           AND (
             (ce.event_end_date IS NULL AND ce.event_date >= $2 AND ce.event_date <= $3)
             OR
             (ce.event_end_date IS NOT NULL AND ce.event_date <= $3 AND ce.event_end_date >= $2)
           )
           AND ce.deleted_at IS NULL
         ORDER BY ce.event_date ASC, ce.event_time ASC NULLS LAST, ce.created_at ASC`,
        [folderId, startDate, endDate]
      );
    } else {
      // year/month가 없으면 전체 이벤트 반환
      result = await query(
        `SELECT ce.*, COALESCE(rf.name, df.name) AS folder_name, COALESCE(rf.type, df.type) AS folder_type
         FROM calendar_events ce
         LEFT JOIN folders df ON df.id = ce.folder_id
         LEFT JOIN folders rf ON rf.id = df.parent_id
         WHERE (ce.folder_id = $1 OR ce.folder_id IN (SELECT id FROM folders WHERE parent_id = $1))
           AND ce.deleted_at IS NULL
         ORDER BY ce.event_date ASC, ce.event_time ASC NULLS LAST, ce.created_at ASC`,
        [folderId]
      );
    }

    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[Calendar Events GET] Error:', error);
    return NextResponse.json({ success: false, error: '일정 조회 실패' }, { status: 500 });
  }
}

// POST - 이벤트 생성
export async function POST(request: NextRequest) {
  try {
    await ensureDb();

    // JWT 인증
    const jwtToken = request.cookies.get('nepcon-token')?.value;
    if (!jwtToken) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }
    const jwtPayload = await verifyJwt(jwtToken);
    if (!jwtPayload) {
      return NextResponse.json({ success: false, error: '인증이 만료되었습니다.' }, { status: 401 });
    }
    const userId = jwtPayload.userId;

    const body = await request.json();
    const { folderId, customerId, customerName, title, eventDate, eventEndDate, eventType, eventTime, amount, memo } = body;

    if (!folderId || !title || !eventDate) {
      return NextResponse.json({ success: false, error: 'folderId, title, eventDate가 필요합니다.' }, { status: 400 });
    }

    // user_folders 권한 확인 (재귀적으로 루트 폴더까지 올라가서 확인)
    const folderCheck = await query(
      `WITH RECURSIVE folder_chain AS (
        SELECT id, parent_id FROM folders WHERE id = $2
        UNION ALL
        SELECT f.id, f.parent_id FROM folders f INNER JOIN folder_chain fc ON f.id = fc.parent_id
      )
      SELECT 1 FROM user_folders uf
      INNER JOIN folder_chain fc ON uf.folder_id = fc.id
      WHERE uf.user_id = $1
      LIMIT 1`,
      [userId, folderId]
    );
    if (folderCheck.rows.length === 0) {
      console.error('[Calendar Events POST] 권한 없음:', { userId, folderId });
      return NextResponse.json({ success: false, error: '접근 권한이 없는 폴더입니다.' }, { status: 403 });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    await query(
      `INSERT INTO calendar_events (id, folder_id, customer_id, customer_name, title, event_date, event_end_date, event_time, event_type, amount, memo, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [id, folderId, customerId || null, customerName || null, title, eventDate, eventEndDate || null, eventTime || null, eventType || '일상', amount || null, memo || null, now, now]
    );

    return NextResponse.json({ success: true, data: { id, folderId, customerId, customerName, title, eventDate, eventEndDate: eventEndDate || null, eventTime: eventTime || null, eventType: eventType || '일상', amount, memo, createdAt: now, updatedAt: now } });
  } catch (error) {
    console.error('[Calendar Events POST] Error:', error);
    return NextResponse.json({ success: false, error: '일정 생성 실패' }, { status: 500 });
  }
}

// PUT - 이벤트 수정
export async function PUT(request: NextRequest) {
  try {
    await ensureDb();

    // JWT 인증
    const jwtToken = request.cookies.get('nepcon-token')?.value;
    if (!jwtToken) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }
    const jwtPayload = await verifyJwt(jwtToken);
    if (!jwtPayload) {
      return NextResponse.json({ success: false, error: '인증이 만료되었습니다.' }, { status: 401 });
    }
    const userId = jwtPayload.userId;

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'id가 필요합니다.' }, { status: 400 });
    }

    // 이벤트의 folder_id 조회
    const eventCheck = await query(
      `SELECT folder_id FROM calendar_events WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    if (eventCheck.rows.length === 0) {
      return NextResponse.json({ success: false, error: '이벤트를 찾을 수 없습니다.' }, { status: 404 });
    }
    const eventFolderId = eventCheck.rows[0].folder_id;

    // user_folders 권한 확인
    const folderCheck = await query(
      `SELECT 1 FROM user_folders WHERE user_id = $1 AND (folder_id = $2 OR folder_id = (SELECT parent_id FROM folders WHERE id = $2))`,
      [userId, eventFolderId]
    );
    if (folderCheck.rows.length === 0) {
      return NextResponse.json({ success: false, error: '접근 권한이 없는 폴더입니다.' }, { status: 403 });
    }

    const fields: string[] = [];
    const values: (string | number | boolean | null)[] = [];
    let paramIndex = 1;

    if (updates.title !== undefined) { fields.push(`title = $${paramIndex++}`); values.push(updates.title); }
    if (updates.eventDate !== undefined) { fields.push(`event_date = $${paramIndex++}`); values.push(updates.eventDate); }
    if (updates.eventType !== undefined) { fields.push(`event_type = $${paramIndex++}`); values.push(updates.eventType); }
    if (updates.amount !== undefined) { fields.push(`amount = $${paramIndex++}`); values.push(updates.amount); }
    if (updates.memo !== undefined) { fields.push(`memo = $${paramIndex++}`); values.push(updates.memo); }
    if (updates.eventTime !== undefined) { fields.push(`event_time = $${paramIndex++}`); values.push(updates.eventTime); }
    if (updates.customerName !== undefined) { fields.push(`customer_name = $${paramIndex++}`); values.push(updates.customerName); }
    if (updates.completed !== undefined) { fields.push(`completed = $${paramIndex++}`); values.push(updates.completed); }
    if (updates.eventEndDate !== undefined) { fields.push(`event_end_date = $${paramIndex++}`); values.push(updates.eventEndDate === '' ? null : updates.eventEndDate); }

    if (fields.length === 0) {
      return NextResponse.json({ success: false, error: '수정할 항목이 없습니다.' }, { status: 400 });
    }

    fields.push(`updated_at = $${paramIndex++}`);
    values.push(new Date().toISOString());
    values.push(id);

    let whereClause = `WHERE id = $${paramIndex} AND deleted_at IS NULL`;
    if (updates.folderId) {
      values.push(updates.folderId);
      whereClause += ` AND folder_id = $${++paramIndex}`;
    }

    await query(
      `UPDATE calendar_events SET ${fields.join(', ')} ${whereClause}`,
      values
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Calendar Events PUT] Error:', error);
    return NextResponse.json({ success: false, error: '일정 수정 실패' }, { status: 500 });
  }
}

// DELETE - 이벤트 삭제 (soft delete)
export async function DELETE(request: NextRequest) {
  try {
    await ensureDb();

    // JWT 인증
    const jwtToken = request.cookies.get('nepcon-token')?.value;
    if (!jwtToken) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }
    const jwtPayload = await verifyJwt(jwtToken);
    if (!jwtPayload) {
      return NextResponse.json({ success: false, error: '인증이 만료되었습니다.' }, { status: 401 });
    }
    const userId = jwtPayload.userId;

    const body = await request.json();
    const { id, folderId } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'id가 필요합니다.' }, { status: 400 });
    }

    // 이벤트의 folder_id 조회
    const eventCheck = await query(
      `SELECT folder_id FROM calendar_events WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    if (eventCheck.rows.length === 0) {
      return NextResponse.json({ success: false, error: '이벤트를 찾을 수 없습니다.' }, { status: 404 });
    }
    const eventFolderId = eventCheck.rows[0].folder_id;

    // user_folders 권한 확인
    const folderCheck = await query(
      `SELECT 1 FROM user_folders WHERE user_id = $1 AND (folder_id = $2 OR folder_id = (SELECT parent_id FROM folders WHERE id = $2))`,
      [userId, eventFolderId]
    );
    if (folderCheck.rows.length === 0) {
      return NextResponse.json({ success: false, error: '접근 권한이 없는 폴더입니다.' }, { status: 403 });
    }

    if (folderId) {
      await query(
        'UPDATE calendar_events SET deleted_at = $1 WHERE id = $2 AND folder_id = $3',
        [new Date().toISOString(), id, folderId]
      );
    } else {
      await query(
        'UPDATE calendar_events SET deleted_at = $1 WHERE id = $2',
        [new Date().toISOString(), id]
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Calendar Events DELETE] Error:', error);
    return NextResponse.json({ success: false, error: '일정 삭제 실패' }, { status: 500 });
  }
}
