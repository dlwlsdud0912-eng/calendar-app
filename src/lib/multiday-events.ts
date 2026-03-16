export interface MultiDayEvent {
  id: string | number;
  title: string;
  event_date: string;      // 시작일 "YYYY-MM-DD"
  event_end_date?: string | null;  // 종료일 "YYYY-MM-DD"
  event_type: string;
  event_time?: string;
  amount?: number;
  [key: string]: any;
}

export interface MultiDaySegment {
  event: MultiDayEvent;
  startCol: number;    // 해당 주에서 시작 열 (0=일, 6=토)
  spanCols: number;    // span 칸 수
  isStart: boolean;    // 이벤트 실제 시작일이 이 주에 있는지
  isEnd: boolean;      // 이벤트 실제 종료일이 이 주에 있는지
  row: number;         // 겹침 방지용 행 인덱스
}

export function computeMultiDaySegments(
  events: MultiDayEvent[],
  weekDates: string[]  // 해당 주의 7일 날짜 배열 ["2026-03-15", "2026-03-16", ...]
): MultiDaySegment[] {
  const weekStart = weekDates[0];
  const weekEnd = weekDates[weekDates.length - 1];

  // 1. 멀티데이 이벤트만 필터 (이 주와 겹치는 것)
  const filtered = events.filter((e) => {
    if (!e.event_end_date || e.event_date === e.event_end_date) return false;
    // 이벤트 범위가 이 주와 겹치는지 확인
    return e.event_date <= weekEnd && e.event_end_date >= weekStart;
  });

  // 2. 각 이벤트에 대해 세그먼트 계산
  const segments: Omit<MultiDaySegment, 'row'>[] = filtered.map((event) => {
    const endDate = event.event_end_date as string; // filter에서 이미 검증됨
    const clampedStart = event.event_date < weekStart ? weekStart : event.event_date;
    const clampedEnd = endDate > weekEnd ? weekEnd : endDate;

    const startCol = weekDates.indexOf(clampedStart);
    const endCol = weekDates.indexOf(clampedEnd);
    const spanCols = endCol - startCol + 1;

    const isStart = weekDates.includes(event.event_date);
    const isEnd = weekDates.includes(endDate);

    return { event, startCol, spanCols, isStart, isEnd };
  });

  // 3. row 할당 (그리디 알고리즘)
  // startCol 기준 정렬
  segments.sort((a, b) => a.startCol - b.startCol);

  // row별 occupied end column 추적
  const rowEndCols: number[] = [];

  const result: MultiDaySegment[] = segments.map((seg) => {
    const segEnd = seg.startCol + seg.spanCols - 1;
    // 가장 낮은 사용 가능한 row 찾기
    let assignedRow = -1;
    for (let r = 0; r < rowEndCols.length; r++) {
      if (rowEndCols[r] < seg.startCol) {
        assignedRow = r;
        rowEndCols[r] = segEnd;
        break;
      }
    }
    if (assignedRow === -1) {
      assignedRow = rowEndCols.length;
      rowEndCols.push(segEnd);
    }

    return { ...seg, row: assignedRow };
  });

  return result;
}

export function isMultiDayEvent(event: { event_date: string; event_end_date?: string | null }): boolean {
  return !!event.event_end_date && event.event_date !== event.event_end_date;
}

export function getMultiDayEventsForDate(
  events: MultiDayEvent[],
  dateStr: string
): MultiDayEvent[] {
  return events.filter((e) => {
    if (!e.event_end_date || e.event_date === e.event_end_date) return false;
    return e.event_date <= dateStr && e.event_end_date >= dateStr;
  });
}
