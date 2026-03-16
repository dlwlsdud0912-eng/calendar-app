import { NextRequest, NextResponse } from 'next/server';
import { query, ensureDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { verifyJwt, extractToken } from '@/lib/auth';

// ── ICS 파싱 유틸리티 (외부 라이브러리 없이 직접 구현) ──

interface ParsedEvent {
  title: string;
  eventDate: string; // YYYY-MM-DD
  eventTime: string | null; // HH:MM or null
  memo: string | null;
}

function unfoldLines(raw: string): string[] {
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const unfolded = normalized.replace(/\n[ \t]/g, '');
  return unfolded.split('\n');
}

function unescapeIcs(value: string): string {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\\\/g, '\\')
    .replace(/\\;/g, ';');
}

function parseDtStart(line: string): { date: string; time: string | null } | null {
  const colonIdx = line.indexOf(':');
  if (colonIdx === -1) return null;

  const propPart = line.substring(0, colonIdx).toUpperCase();
  const valuePart = line.substring(colonIdx + 1).trim();

  if (!valuePart) return null;

  if (propPart.includes('VALUE=DATE')) {
    const m = valuePart.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (m) return { date: `${m[1]}-${m[2]}-${m[3]}`, time: null };
    return null;
  }

  const tzidMatch = propPart.match(/TZID=([^;:]+)/i);

  const dtMatch = valuePart.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (dtMatch) {
    const [, y, mo, d, h, mi, , utcFlag] = dtMatch;
    const dateStr = `${y}-${mo}-${d}`;

    if (utcFlag) {
      const utcDate = new Date(Date.UTC(
        parseInt(y), parseInt(mo) - 1, parseInt(d),
        parseInt(h), parseInt(mi), 0
      ));
      utcDate.setUTCHours(utcDate.getUTCHours() + 9);
      const kstDate = `${utcDate.getUTCFullYear()}-${String(utcDate.getUTCMonth() + 1).padStart(2, '0')}-${String(utcDate.getUTCDate()).padStart(2, '0')}`;
      const kstTime = `${String(utcDate.getUTCHours()).padStart(2, '0')}:${String(utcDate.getUTCMinutes()).padStart(2, '0')}`;
      return { date: kstDate, time: kstTime };
    }

    if (tzidMatch) {
      return { date: dateStr, time: `${h}:${mi}` };
    }

    return { date: dateStr, time: `${h}:${mi}` };
  }

  const dateOnly = valuePart.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (dateOnly) {
    return { date: `${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}`, time: null };
  }

  return null;
}

function parseIcs(icsText: string): ParsedEvent[] {
  const lines = unfoldLines(icsText);
  const events: ParsedEvent[] = [];

  let inEvent = false;
  let summary = '';
  let dtstart: { date: string; time: string | null } | null = null;
  let description = '';
  let location = '';

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === 'BEGIN:VEVENT') {
      inEvent = true;
      summary = '';
      dtstart = null;
      description = '';
      location = '';
      continue;
    }

    if (trimmed === 'END:VEVENT') {
      if (inEvent && summary && dtstart) {
        let memo: string | null = null;
        const parts: string[] = [];
        if (description) parts.push(unescapeIcs(description));
        if (location) parts.push(`장소: ${unescapeIcs(location)}`);
        if (parts.length > 0) memo = parts.join('\n');

        events.push({
          title: unescapeIcs(summary),
          eventDate: dtstart.date,
          eventTime: dtstart.time,
          memo,
        });
      }
      inEvent = false;
      continue;
    }

    if (!inEvent) continue;

    const upperLine = trimmed.toUpperCase();

    if (upperLine.startsWith('SUMMARY')) {
      const idx = trimmed.indexOf(':');
      if (idx !== -1) summary = trimmed.substring(idx + 1).trim();
    } else if (upperLine.startsWith('DTSTART')) {
      dtstart = parseDtStart(trimmed);
    } else if (upperLine.startsWith('DESCRIPTION')) {
      const idx = trimmed.indexOf(':');
      if (idx !== -1) description = trimmed.substring(idx + 1).trim();
    } else if (upperLine.startsWith('LOCATION')) {
      const idx = trimmed.indexOf(':');
      if (idx !== -1) location = trimmed.substring(idx + 1).trim();
    }
  }

  return events;
}

// ── POST - .ics 파일 가져오기 ──
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { icsText, folderId } = body;

    if (!icsText || typeof icsText !== 'string') {
      return NextResponse.json({ success: false, error: '.ics 파일 내용이 필요합니다.' }, { status: 400 });
    }

    if (!folderId) {
      return NextResponse.json({ success: false, error: 'folderId가 필요합니다.' }, { status: 400 });
    }

    // 폴더 권한 확인 (user_folders 기반)
    const folderCheck = await query(
      `WITH RECURSIVE folder_chain AS (
        SELECT id, parent_id FROM folders WHERE id = $2
        UNION ALL
        SELECT f.id, f.parent_id FROM folders f INNER JOIN folder_chain fc ON f.id = fc.parent_id
      )
      SELECT 1 FROM folder_chain fc
      INNER JOIN user_folders uf ON uf.folder_id = fc.id
      WHERE uf.user_id = $1
      LIMIT 1`,
      [userId, folderId]
    );
    if (folderCheck.rows.length === 0) {
      return NextResponse.json({ success: false, error: '접근 권한이 없는 폴더입니다.' }, { status: 403 });
    }

    const parsedEvents = parseIcs(icsText);

    if (parsedEvents.length === 0) {
      return NextResponse.json({ success: false, error: '가져올 수 있는 일정이 없습니다. .ics 파일 형식을 확인하세요.' }, { status: 400 });
    }

    const existingResult = await query(
      `SELECT event_date, title FROM calendar_events WHERE folder_id = $1 AND deleted_at IS NULL`,
      [folderId]
    );
    const existingSet = new Set(
      existingResult.rows.map((r: { event_date: string; title: string }) => `${r.event_date}||${r.title}`)
    );

    const batchDate = new Date();
    const batchId = `ics_${batchDate.getFullYear()}${String(batchDate.getMonth() + 1).padStart(2, '0')}${String(batchDate.getDate()).padStart(2, '0')}_${String(batchDate.getHours()).padStart(2, '0')}${String(batchDate.getMinutes()).padStart(2, '0')}${String(batchDate.getSeconds()).padStart(2, '0')}`;

    let imported = 0;
    let skipped = 0;
    const now = new Date().toISOString();

    for (const evt of parsedEvents) {
      const key = `${evt.eventDate}||${evt.title}`;
      if (existingSet.has(key)) {
        skipped++;
        continue;
      }

      const id = uuidv4();
      await query(
        `INSERT INTO calendar_events (id, folder_id, title, event_date, event_time, event_type, memo, import_source, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [id, folderId, evt.title, evt.eventDate, evt.eventTime, '일상', evt.memo, batchId, now, now]
      );

      existingSet.add(key);
      imported++;
    }

    return NextResponse.json({
      success: true,
      data: { total: parsedEvents.length, imported, skipped, batchId },
    });
  } catch (error) {
    console.error('[Calendar Import POST] Error:', error);
    return NextResponse.json({ success: false, error: '일정 가져오기 실패' }, { status: 500 });
  }
}

// ── DELETE - ICS 가져오기 취소 (되돌리기) ──
export async function DELETE(request: NextRequest) {
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
    const batchId = searchParams.get('batchId');

    let result;
    if (batchId) {
      result = await query(
        `DELETE FROM calendar_events WHERE import_source = $1 AND deleted_at IS NULL
         AND folder_id IN (
           SELECT folder_id FROM user_folders WHERE user_id = $2
           UNION
           SELECT id FROM folders WHERE parent_id IN (SELECT folder_id FROM user_folders WHERE user_id = $2)
         )`,
        [batchId, userId]
      );
    } else {
      result = await query(
        `DELETE FROM calendar_events WHERE import_source LIKE 'ics_%' AND deleted_at IS NULL
         AND folder_id IN (
           SELECT folder_id FROM user_folders WHERE user_id = $1
           UNION
           SELECT id FROM folders WHERE parent_id IN (SELECT folder_id FROM user_folders WHERE user_id = $1)
         )`,
        [userId]
      );
    }

    return NextResponse.json({
      success: true,
      data: { deleted: result.rowCount || 0 },
    });
  } catch (error) {
    console.error('[Calendar Import DELETE] Error:', error);
    return NextResponse.json({ success: false, error: '가져오기 취소 실패' }, { status: 500 });
  }
}
