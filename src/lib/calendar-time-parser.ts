// ============================================================
// lib/calendar-time-parser.ts
//
// 수기 입력 텍스트에서 한국어 시간 패턴을 자동 파싱하고,
// 일정을 시간순으로 정렬하는 유틸리티
// ============================================================

export interface ParsedEvent {
  title: string
  startTime: string | null  // "HH:MM" 형식 (예: "07:30", "14:00")
  startTimeMinutes: number | null  // 정렬용: 0~1439 (분 단위)
}

/**
 * 텍스트에서 한국어 시간 패턴을 감지하여 분리
 *
 * @example
 * parseTimeFromText("계약서 작성하기 오후4시")
 * // → { title: "계약서 작성하기", startTime: "16:00", startTimeMinutes: 960 }
 *
 * parseTimeFromText("1030 치과")
 * // → { title: "치과", startTime: "10:30", startTimeMinutes: 630 }
 *
 * parseTimeFromText("김정은 중도금2차")
 * // → { title: "김정은 중도금2차", startTime: null, startTimeMinutes: null }
 */
/** 한글 숫자를 아라비아 숫자로 변환 */
function koreanNumberToDigit(text: string): number | null {
  const map: Record<string, number> = {
    '한': 1, '하나': 1, '일': 1,
    '두': 2, '둘': 2, '이': 2,
    '세': 3, '셋': 3, '삼': 3,
    '네': 4, '넷': 4, '사': 4,
    '다섯': 5, '오': 5,
    '여섯': 6, '육': 6,
    '일곱': 7, '칠': 7,
    '여덟': 8, '팔': 8,
    '아홉': 9, '구': 9,
    '열': 10, '십': 10,
    '열한': 11, '십일': 11,
    '열두': 12, '십이': 12,
    '열세': 13, '십삼': 13,
    '열네': 14, '십사': 14,
    '열다섯': 15, '십오': 15,
    '열여섯': 16, '십육': 16,
    '열일곱': 17, '십칠': 17,
    '열여덟': 18, '십팔': 18,
    '열아홉': 19, '십구': 19,
    '스물': 20, '이십': 20,
    '스물한': 21, '이십일': 21,
    '스물두': 22, '이십이': 22,
    '스물세': 23, '이십삼': 23,
  }
  return map[text] ?? null
}

/** 한글 분 숫자 변환 */
function koreanMinuteToDigit(text: string): number | null {
  const map: Record<string, number> = {
    '십': 10, '이십': 20, '삼십': 30, '사십': 40, '오십': 50,
    '십오': 15, '이십오': 25, '삼십오': 35, '사십오': 45,
  }
  return map[text] ?? null
}

export function parseTimeFromText(text: string): ParsedEvent {
  const original = text.trim()
  let remaining = original
  let hours: number | null = null
  let minutes: number = 0
  let matched = false

  // ── 패턴 1: "오후4시30분", "오전10시", "오후 3시 반" 등 ──
  const koreanTimeRegex = /(?:^|[\s,])?(오전|오후|아침|낮|저녁|밤|새벽)\s*(\d{1,2})\s*시\s*(?:(\d{1,2})\s*분|반)?(?:\s|$|,)/
  const koreanMatch = remaining.match(koreanTimeRegex)
  if (koreanMatch) {
    const period = koreanMatch[1]
    let h = parseInt(koreanMatch[2])
    const m = koreanMatch[3] ? parseInt(koreanMatch[3]) : (remaining.includes('반') && koreanMatch[0].includes('반') ? 30 : 0)

    if (['오후', '낮', '저녁', '밤'].includes(period)) {
      if (h < 12) h += 12
    } else if (['오전', '아침', '새벽'].includes(period)) {
      if (h === 12) h = 0
    }

    hours = h
    minutes = m
    matched = true
    remaining = remaining.replace(koreanMatch[0], ' ').trim()
  }

  // ── 패턴 1.5: "오후 네시반", "오전 두시", "저녁 여섯시" 등 (시간대 + 한글숫자) ──
  if (!matched) {
    const periodKoreanRegex = /(?:^|[\s,])?(오전|오후|아침|낮|저녁|밤|새벽)\s*(한|두|세|네|다섯|여섯|일곱|여덟|아홉|열한|열두|열세|열네|열다섯|열여섯|열일곱|열여덟|열아홉|스물한|스물두|스물세|스물|열)\s*시\s*(?:(\d{1,2}|십|이십|삼십|사십|오십|십오|이십오|삼십오|사십오)\s*분|반)?/
    const periodKoreanMatch = remaining.match(periodKoreanRegex)
    if (periodKoreanMatch) {
      const period = periodKoreanMatch[1]
      let h = koreanNumberToDigit(periodKoreanMatch[2])
      let m = 0
      if (periodKoreanMatch[3]) {
        const digitMin = parseInt(periodKoreanMatch[3])
        if (!isNaN(digitMin)) { m = digitMin } else { m = koreanMinuteToDigit(periodKoreanMatch[3]) ?? 0 }
      } else if (periodKoreanMatch[0].includes('반')) { m = 30 }

      if (h !== null) {
        if (['오후', '낮', '저녁', '밤'].includes(period)) { if (h < 12) h += 12 }
        else if (['오전', '아침', '새벽'].includes(period)) { if (h === 12) h = 0 }
        hours = h; minutes = m; matched = true
        remaining = remaining.replace(periodKoreanMatch[0], ' ').trim()
      }
    }
  }

  // ── 패턴 2: "14시30분", "9시반", "3시", "22시" 등 ──
  if (!matched) {
    const simpleTimeRegex = /(?:^|[\s,])?(\d{1,2})\s*시\s*(?:(\d{1,2})\s*분|반)?(?:\s|$|,)/
    const simpleMatch = remaining.match(simpleTimeRegex)
    if (simpleMatch) {
      const h = parseInt(simpleMatch[1])
      const m = simpleMatch[2] ? parseInt(simpleMatch[2]) : (simpleMatch[0].includes('반') ? 30 : 0)

      if (h >= 0 && h <= 23) {
        hours = h
        minutes = m
        matched = true
        remaining = remaining.replace(simpleMatch[0], ' ').trim()
      }
    }
  }

  // ── 패턴 2.5: 한글 숫자 시간 "두시30분", "세시 사십분", "열두시반" 등 ──
  if (!matched) {
    const koreanHourRegex = /(?:^|[\s,])?(한|두|세|네|다섯|여섯|일곱|여덟|아홉|열한|열두|열세|열네|열다섯|열여섯|열일곱|열여덟|열아홉|스물한|스물두|스물세|스물|열)\s*시\s*(?:(\d{1,2}|십|이십|삼십|사십|오십|십오|이십오|삼십오|사십오)\s*분|반)?/
    const koreanHourMatch = remaining.match(koreanHourRegex)
    if (koreanHourMatch) {
      const h = koreanNumberToDigit(koreanHourMatch[1])
      let m = 0
      if (koreanHourMatch[2]) {
        // 숫자인지 한글인지 확인
        const digitMin = parseInt(koreanHourMatch[2])
        if (!isNaN(digitMin)) {
          m = digitMin
        } else {
          m = koreanMinuteToDigit(koreanHourMatch[2]) ?? 0
        }
      } else if (koreanHourMatch[0].includes('반')) {
        m = 30
      }

      if (h !== null && h >= 0 && h <= 23) {
        hours = h
        minutes = m
        matched = true
        remaining = remaining.replace(koreanHourMatch[0], ' ').trim()
      }
    }
  }

  // ── 패턴 3: 콜론 형식 "16:40", "9:30", "14:30분" ──
  if (!matched) {
    const colonRegex = /(?:^|[\s,])(\d{1,2}):(\d{2})분?(?:[\s,]|$)/
    const colonMatch = remaining.match(colonRegex)
    if (colonMatch) {
      const h = parseInt(colonMatch[1])
      const m = parseInt(colonMatch[2])
      if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
        hours = h
        minutes = m
        matched = true
        remaining = remaining.replace(new RegExp(colonMatch[1] + ':' + colonMatch[2] + '분?'), '').trim()
      }
    }
  }

  // ── 패턴 4: 4자리 숫자 시간 "1030", "1400", "2230" ──
  if (!matched) {
    const fourDigitRegex = /(?:^|[\s,])(\d{4})(?:[\s,]|$)/
    const fourDigitMatch = remaining.match(fourDigitRegex)
    if (fourDigitMatch) {
      const num = parseInt(fourDigitMatch[1])
      const h = Math.floor(num / 100)
      const m = num % 100
      if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
        hours = h
        minutes = m
        matched = true
        remaining = remaining.replace(fourDigitMatch[1], '').trim()
      }
    }
  }

  // ── 패턴 5: 시간대 키워드만 "아침 운동", "저녁 회식" ──
  if (!matched) {
    const periodOnlyRegex = /^(아침|점심|저녁|밤|새벽|정오|자정)\s+/
    const periodMatch = remaining.match(periodOnlyRegex)
    if (periodMatch) {
      const periodMap: Record<string, number> = {
        '새벽': 5, '아침': 9, '점심': 12, '정오': 12,
        '저녁': 18, '밤': 21, '자정': 0,
      }
      const period = periodMatch[1]
      if (periodMap[period] !== undefined) {
        hours = periodMap[period]
        minutes = 0
        matched = true
        remaining = remaining.replace(periodMatch[0], '').trim()
      }
    }
  }

  // ── 결과 조합 (HH:MM 형식으로 반환) ──
  if (matched && hours !== null) {
    const timeStr = String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0')
    const totalMinutes = hours * 60 + minutes

    const cleanTitle = remaining
      .replace(/\s+/g, ' ')
      .replace(/^[\s,]+|[\s,]+$/g, '')
      .trim()

    return {
      title: cleanTitle || original,
      startTime: timeStr,
      startTimeMinutes: totalMinutes,
    }
  }

  return {
    title: original,
    startTime: null,
    startTimeMinutes: null,
  }
}

/**
 * 수기 입력된 일정 텍스트를 파싱하여 title과 event_time을 분리
 *
 * @example
 * processManualInput("계약서 작성하기 오후4시")
 * // → { title: "계약서 작성하기", event_time: "16:00" }
 */
export function processManualInput(text: string): { title: string; event_time: string | null } {
  const parsed = parseTimeFromText(text)
  return {
    title: parsed.title,
    event_time: parsed.startTime,
  }
}
