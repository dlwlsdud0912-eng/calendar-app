'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { processManualInput } from '@/lib/calendar-time-parser'
import { computeMultiDaySegments, isMultiDayEvent, MultiDaySegment } from '@/lib/multiday-events';
import CalendarCat from './CalendarCat';
import { useCalendarCat } from '@/hooks/useCalendarCat';

// ── Types ──

interface CalendarEvent {
  id: string;
  folder_id: string;
  customer_id?: string;
  customer_name?: string;
  title: string;
  event_date: string;
  event_time?: string; // "HH:MM" 형식
  event_type: string;
  amount?: number;
  memo?: string;
  completed?: boolean;
  event_end_date?: string;  // 멀티데이 이벤트 종료일
  created_at: string;
  updated_at: string;
}

interface EventCategory {
  id: string;
  name: string;
  colorBg: string;
  colorText: string;
  sortOrder: number;
  isDefault: boolean;
  keywords: string;
}

// ── Fallback color mapping (used before categories load) ──
function getEventTypeColorFallback(eventType: string): { bg: string; text: string } {
  if (eventType === '계약') return { bg: '#1D4ED8', text: '#ffffff' };
  if (eventType.startsWith('중도금')) return { bg: '#2563EB', text: '#ffffff' };
  if (eventType === '잔금') return { bg: '#059669', text: '#ffffff' };
  if (eventType === '안내') return { bg: '#7C3AED', text: '#ffffff' };
  if (eventType === '상담') return { bg: '#0F766E', text: '#ffffff' };
  return { bg: '#E5E7EB', text: '#111827' };
}

// ── Color presets for category manager ──
const COLOR_PRESETS: { bg: string; text: string }[] = [
  { bg: 'transparent', text: '#111827' },  // 색 없음
  // Google Calendar 12색
  { bg: '#D50000', text: '#ffffff' },  // 토마토 (Tomato)
  { bg: '#F4511E', text: '#ffffff' },  // 귤 (Tangerine)
  { bg: '#E4C441', text: '#111827' },  // 바나나 (Banana)
  { bg: '#0B8043', text: '#ffffff' },  // 바질 (Basil)
  { bg: '#33B679', text: '#ffffff' },  // 세이지 (Sage)
  { bg: '#039BE5', text: '#ffffff' },  // 공작 (Peacock)
  { bg: '#3F51B5', text: '#ffffff' },  // 블루베리 (Blueberry)
  { bg: '#7986CB', text: '#ffffff' },  // 라벤더 (Lavender)
  { bg: '#8E24AA', text: '#ffffff' },  // 포도 (Grape)
  { bg: '#E67C73', text: '#ffffff' },  // 홍학 (Flamingo)
  { bg: '#616161', text: '#ffffff' },  // 흑연 (Graphite)
  { bg: '#4285F4', text: '#ffffff' },  // 기본 (Default)
];

// ── Detect event type from title ──
function detectEventType(title: string): string {
  if (title.includes('계약')) return '계약';
  if (title.includes('중도금')) {
    if (title.includes('1차')) return '중도금1차';
    if (title.includes('2차')) return '중도금2차';
    if (title.includes('3차')) return '중도금3차';
    if (title.includes('4차')) return '중도금4차';
    return '중도금1차';
  }
  if (title.includes('잔금')) return '잔금';
  if (title.includes('안내') || title.includes('견학') || title.includes('방문')) return '안내';
  if (title.includes('상담')) return '상담';
  return '일상';
}

// ── Korean holidays ──
function getKoreanHolidays(year: number): Map<string, string> {
  const holidays = new Map<string, string>();

  // 양력 고정 공휴일
  holidays.set(`${year}-01-01`, '신정');
  holidays.set(`${year}-03-01`, '삼일절');
  holidays.set(`${year}-05-05`, '어린이날');
  holidays.set(`${year}-06-06`, '현충일');
  holidays.set(`${year}-08-15`, '광복절');
  holidays.set(`${year}-10-03`, '개천절');
  holidays.set(`${year}-10-09`, '한글날');
  holidays.set(`${year}-12-25`, '크리스마스');

  // 음력 기반 공휴일 (연도별 양력 날짜 하드코딩)
  const lunarHolidays: Record<number, { seollal: string[]; chuseok: string[]; buddha: string }> = {
    2024: {
      seollal: ['02-09', '02-10', '02-11', '02-12'],
      chuseok: ['09-16', '09-17', '09-18'],
      buddha: '05-15',
    },
    2025: {
      seollal: ['01-28', '01-29', '01-30'],
      chuseok: ['10-05', '10-06', '10-07', '10-08'],
      buddha: '05-05',
    },
    2026: {
      seollal: ['02-16', '02-17', '02-18'],
      chuseok: ['09-24', '09-25', '09-26'],
      buddha: '05-24',
    },
    2027: {
      seollal: ['02-05', '02-06', '02-07', '02-08'],
      chuseok: ['09-14', '09-15', '09-16'],
      buddha: '05-13',
    },
    2028: {
      seollal: ['01-25', '01-26', '01-27'],
      chuseok: ['10-02', '10-03', '10-04'],
      buddha: '05-02',
    },
    2029: {
      seollal: ['02-12', '02-13', '02-14'],
      chuseok: ['09-21', '09-22', '09-23', '09-24'],
      buddha: '05-20',
    },
    2030: {
      seollal: ['02-02', '02-03', '02-04'],
      chuseok: ['09-11', '09-12', '09-13'],
      buddha: '05-09',
    },
  };

  const yearData = lunarHolidays[year];
  if (yearData) {
    // 설날 연휴
    yearData.seollal.forEach((d, i) => {
      const seollalNames = ['설날 연휴', '설날', '설날 연휴'];
      if (yearData.seollal.length === 4) {
        if (i === 0) holidays.set(`${year}-${d}`, '설날 연휴');
        else if (i === 1) holidays.set(`${year}-${d}`, '설날');
        else if (i === 2) holidays.set(`${year}-${d}`, '설날 연휴');
        else holidays.set(`${year}-${d}`, '대체공휴일');
      } else {
        holidays.set(`${year}-${d}`, seollalNames[i] || '설날 연휴');
      }
    });

    // 추석 연휴
    yearData.chuseok.forEach((d, i) => {
      const chuseokNames = ['추석 연휴', '추석', '추석 연휴'];
      if (yearData.chuseok.length === 4) {
        if (i === 0) holidays.set(`${year}-${d}`, '추석 연휴');
        else if (i === 1) holidays.set(`${year}-${d}`, '추석');
        else if (i === 2) holidays.set(`${year}-${d}`, '추석 연휴');
        else holidays.set(`${year}-${d}`, '대체공휴일');
      } else {
        holidays.set(`${year}-${d}`, chuseokNames[i] || '추석 연휴');
      }
    });

    // 부처님 오신 날
    holidays.set(`${year}-${yearData.buddha}`, '부처님오신날');
  }

  return holidays;
}

// ── Amount formatting ──
function formatAmount(amount: number): string {
  if (amount >= 100000000) {
    const eok = Math.floor(amount / 100000000);
    const man = Math.floor((amount % 100000000) / 10000);
    return man > 0 ? `${eok}억 ${man}만원` : `${eok}억원`;
  }
  if (amount >= 10000) {
    return `${Math.floor(amount / 10000)}만원`;
  }
  return `${amount.toLocaleString()}원`;
}

// ── Time display format ──
type TimeDisplayFormat = 'colon' | 'ampm'

function getTimeDisplayFormat(): TimeDisplayFormat {
  if (typeof window === 'undefined') return 'colon'
  return (localStorage.getItem('nepcon-time-format') as TimeDisplayFormat) || 'colon'
}

// ── Format event time ──
function formatEventTime(time: string): string {
  const [hStr, mStr] = time.split(':')
  const h = parseInt(hStr)
  const m = parseInt(mStr || '0')
  const format = getTimeDisplayFormat()

  switch (format) {
    case 'ampm': {
      const period = h < 12 ? '오전' : '오후'
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
      if (m === 0) return `${period} ${h12}시`
      return `${period} ${h12}:${String(m).padStart(2, '0')}`
    }
    case 'colon':
    default:
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }
}

// ── Extract time from event (event_time field or title pattern) ──
function extractEventHour(event: CalendarEvent): number | null {
  // 1) event_time 필드가 있으면 우선 사용 ("HH:MM" 형식)
  if (event.event_time) {
    const h = parseInt(event.event_time.split(':')[0], 10);
    if (!isNaN(h)) return h;
  }
  // 2) title에서 "N시" 패턴 추출 (예: "14시 볼보수리" → 14)
  const match = event.title.match(/(\d{1,2})시/);
  if (match) {
    const h = parseInt(match[1], 10);
    if (h >= 0 && h <= 23) return h;
  }
  return null;
}

// ── Sort events by time (시간 오름차순, 시간 없는 것은 뒤로) ──
function sortEventsByTime(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort((a, b) => {
    // event_time 필드 기준 정렬 (분 단위까지 비교)
    const aTime = a.event_time || null;
    const bTime = b.event_time || null;
    // 둘 다 event_time이 있으면 문자열 비교 (HH:MM)
    if (aTime && bTime) return aTime.localeCompare(bTime);

    // event_time이 없는 경우 title에서 시간 추출하여 비교
    const aHour = extractEventHour(a);
    const bHour = extractEventHour(b);

    // 둘 다 시간이 있으면 시간순
    if (aHour !== null && bHour !== null) {
      if (aHour !== bHour) return aHour - bHour;
      // 같은 시간이면 event_time이 있는 쪽 우선
      if (aTime && !bTime) return -1;
      if (!aTime && bTime) return 1;
      return 0;
    }
    // 시간 있는 것이 먼저
    if (aHour !== null) return -1;
    if (bHour !== null) return 1;
    return 0;
  });
}

// ── Calendar helpers ──
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}


export default function CalendarModal() {
  // ── Auto-fetch folderId ──
  const [folderId, setFolderId] = useState<string | null>(null);
  // ── State ──
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  // ── Categories ──
  const [categories, setCategories] = useState<EventCategory[]>([]);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [catEditName, setCatEditName] = useState('');
  const [catEditBg, setCatEditBg] = useState('#f3f4f6');
  const [catEditText, setCatEditText] = useState('#374151');
  const [addingNewCategory, setAddingNewCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatBg, setNewCatBg] = useState('#f3f4f6');
  const [newCatText, setNewCatText] = useState('#374151');
  const [catEditKeywords, setCatEditKeywords] = useState('');
  const [newCatKeywords, setNewCatKeywords] = useState('');
  const [catSaving, setCatSaving] = useState(false);
  // ── ICS Import ──
  const [showIcsImport, setShowIcsImport] = useState(false);
  const [icsImporting, setIcsImporting] = useState(false);
  const [icsFile, setIcsFile] = useState<File | null>(null);
  const [icsResult, setIcsResult] = useState<{ imported: number; skipped: number; total: number; batchId?: string } | null>(null);
  const [icsError, setIcsError] = useState<string | null>(null);
  const [icsUndoing, setIcsUndoing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [panelDate, setPanelDate] = useState<string | null>(null);
  const [textSize, setTextSize] = useState<0 | 1 | 2>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('calendarTextSize');
      if (saved === '1') return 1;
      if (saved === '2') return 2;
      // migrate old boolean key
      if (saved === null && localStorage.getItem('calendarLargeText') === 'true') return 2;
    }
    return 0;
  });

  const toggleTextSize = () => {
    setTextSize(prev => {
      const next = (prev === 0 ? 1 : prev === 1 ? 2 : 0) as 0 | 1 | 2;
      try { localStorage.setItem('calendarTextSize', String(next)); } catch {}
      return next;
    });
  };

  // ── Time format ──
  const [timeFormat, setTimeFormat] = useState<TimeDisplayFormat>(() => {
    if (typeof window === 'undefined') return 'colon'
    return (localStorage.getItem('nepcon-time-format') as TimeDisplayFormat) || 'colon'
  });

  const cycleTimeFormat = () => {
    const next: TimeDisplayFormat = timeFormat === 'colon' ? 'ampm' : 'colon'
    setTimeFormat(next)
    localStorage.setItem('nepcon-time-format', next)
  };

  // Space filter — localStorage에서 이전 선택 복원
  const [selectedSpaces, setSelectedSpaces] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('calendarSpaces');
      if (saved) {
        try {
          return new Set(JSON.parse(saved));
        } catch { /* ignore */ }
      }
    }
    return new Set(['team', 'personal']);
  });

  // AI input
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState('');

  // Add form
  const [showAddForm, setShowAddForm] = useState(false);
  const [addTitle, setAddTitle] = useState('');
  const [addEventType, setAddEventType] = useState('일상');
  const [addAmount, setAddAmount] = useState('');
  const [addMemo, setAddMemo] = useState('');
  const [addTime, setAddTime] = useState('');

  // AI delete confirmation
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);

  // Edit form
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editEventType, setEditEventType] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editEndDate, setEditEndDate] = useState<string>('');
  const [addEndDate, setAddEndDate] = useState<string>('');
  const [isLongEvent, setIsLongEvent] = useState(false);

  // Category filter chips
  const [activeCategoryFilters, setActiveCategoryFilters] = useState<Set<string>>(new Set(['__all__']));

  // Space picker (when both spaces checked)
  const [spacePickerMode, setSpacePickerMode] = useState(false);
  const [addTargetFolderId, setAddTargetFolderId] = useState<string | null>(null);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [categoryPickerOptions, setCategoryPickerOptions] = useState<{name: string; colorBg: string; colorText: string}[]>([]);
  const [pendingAddData, setPendingAddData] = useState<{folderId: string; title: string; eventDate: string; eventTime?: string; eventEndDate?: string} | null>(null);
  const [userRootFolders, setUserRootFolders] = useState<{id: string, name: string, type: string}[]>([]);

  // Pending AI events (waiting for space selection)
  const [pendingAiEvents, setPendingAiEvents] = useState<any[] | null>(null);

  // Floating AI panel
  const [showAiPanel, setShowAiPanel] = useState(false);

  // AI 버튼 드래그 위치
  const [aiBtnPos, setAiBtnPos] = useState<{right: number, bottom: number}>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('aiBtnPos');
      if (saved) {
        try { return JSON.parse(saved); } catch {}
      }
    }
    return { right: 20, bottom: 180 };
  });
  const aiBtnDragRef = useRef<{startX: number, startY: number, origRight: number, origBottom: number, moved: boolean} | null>(null);
  const aiBtnRef = useRef<HTMLButtonElement>(null);

  // AI input ref (auto-focus)
  const aiInputRef = useRef<HTMLInputElement>(null);

  // Wheel debounce ref
  const lastWheelTime = useRef<number>(0);

  // ── Swipe slider state/refs ──
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSnapping, setIsSnapping] = useState(false);
  const swipeStartX = useRef<number | null>(null);
  const swipeStartY = useRef<number | null>(null);
  const swipeDirection = useRef<'horizontal' | 'vertical' | null>(null);
  const swipeStartTime = useRef(0);

  // ── Events cache (persists across re-renders, no re-render on update) ──
  const eventsCacheRef = useRef<Record<string, CalendarEvent[]>>({});
  const needsRefreshRef = useRef(false);

  // ── Vertical swipe tracking for bottom sheet ──
  const lastSwipeTouchY = useRef<number | null>(null);

  // ── Swipe-to-close refs ──
  const touchStartYRef = useRef<number | null>(null);
  const touchCurrentYRef = useRef<number | null>(null);

  // ── Cat physics ──
  const totalWeeksForCat = useMemo(() => {
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
    const daysCount = getDaysInMonth(currentYear, currentMonth);
    return Math.ceil((firstDay + daysCount) / 7);
  }, [currentYear, currentMonth]);

  const {
    registerCell: registerCatCell,
    setContainerRef: setCatContainerRef,
    catPixelPos,
    catState: catAnimState,
    catDirection,
    bubble: catBubble,
    showHeart: catShowHeart,
    handleCatClick,
    handleDragStart: handleCatDragStart,
    reducedMotion: catReducedMotion,
  } = useCalendarCat(totalWeeksForCat, currentYear, currentMonth);

  // ── Auto-fetch user's personal folder ──
  useEffect(() => {
    const fetchFolder = async () => {
      try {
        const res = await fetch('/api/folders?parentId=null');
        const json = await res.json();
        if (json.success && json.data?.folders && json.data.folders.length > 0) {
          const personal = json.data.folders.find((f: any) => f.type === 'personal');
          setFolderId(personal ? personal.id : json.data.folders[0].id);
        }
      } catch (err) {
        console.error('Failed to fetch folders:', err);
      }
    };
    fetchFolder();
  }, []);

  // ── Fetch categories ──
  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/calendar/categories');
      const json = await res.json();
      if (json.success && json.data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setCategories(json.data.map((row: any) => ({
          id: row.id,
          name: row.name,
          colorBg: row.color_bg,
          colorText: row.color_text,
          sortOrder: row.sort_order,
          isDefault: row.is_default,
          keywords: row.keywords || '',
        })));
      }
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // ── Get category color (from categories or fallback) ──
  // eventType 이름으로만 매칭 (title 키워드 매칭은 수동 설정을 덮어쓰므로 제거)
  const getCategoryColor = useCallback((eventType: string): { bg: string; text: string } => {
    const cat = categories.find(c => c.name === eventType);
    if (cat) return { bg: cat.colorBg, text: cat.colorText };
    return getEventTypeColorFallback(eventType);
  }, [categories]);

  // ── Fetch events ──
  const fetchEvents = useCallback(async (forceRefresh = false, silent = false) => {
    // 체크박스 둘 다 해제 시 빈 배열 반환
    if (selectedSpaces.size === 0) {
      setEvents([]);
      return;
    }
    const activeSpaces = selectedSpaces;

    const spaceTypesStr = Array.from(activeSpaces).sort().join(',');
    const cacheKey = `spaces-${spaceTypesStr}-${currentYear}-${currentMonth}`;

    // 강제 새로고침이면 캐시 제거
    if (forceRefresh) {
      delete eventsCacheRef.current[cacheKey];
    }

    // 캐시에 있고 강제 새로고침이 아니면 캐시 사용 (로딩 없이 즉시)
    if (!forceRefresh && eventsCacheRef.current[cacheKey]) {
      setEvents(eventsCacheRef.current[cacheKey]);
      return;
    }

    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('spaceTypes', spaceTypesStr);
      params.set('year', String(currentYear));
      params.set('month', String(currentMonth));

      const res = await fetch(`/api/calendar/events?${params}`);
      const json = await res.json();
      if (json.success) {
        eventsCacheRef.current[cacheKey] = json.data;
        setEvents(json.data);
        // 인접 월 사전 캐시 (백그라운드, fire-and-forget)
        const pm = currentMonth === 1 ? 12 : currentMonth - 1;
        const py = currentMonth === 1 ? currentYear - 1 : currentYear;
        const nm = currentMonth === 12 ? 1 : currentMonth + 1;
        const ny = currentMonth === 12 ? currentYear + 1 : currentYear;
        const prevKey = `spaces-${spaceTypesStr}-${py}-${pm}`;
        const nextKey = `spaces-${spaceTypesStr}-${ny}-${nm}`;
        if (!eventsCacheRef.current[prevKey]) {
          fetch(`/api/calendar/events?spaceTypes=${spaceTypesStr}&year=${py}&month=${pm}`)
            .then(r => r.json())
            .then(j => { if (j.success) eventsCacheRef.current[prevKey] = j.data; })
            .catch(() => {});
        }
        if (!eventsCacheRef.current[nextKey]) {
          fetch(`/api/calendar/events?spaceTypes=${spaceTypesStr}&year=${ny}&month=${nm}`)
            .then(r => r.json())
            .then(j => { if (j.success) eventsCacheRef.current[nextKey] = j.data; })
            .catch(() => {});
        }
      }
    } catch (err) {
      console.error('Failed to fetch events:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [currentYear, currentMonth, selectedSpaces]);

  useEffect(() => {
    setSpacePickerMode(false);
    setAddTargetFolderId(null);
    setPendingAiEvents(null);
    if (needsRefreshRef.current) {
      needsRefreshRef.current = false;
      fetchEvents(true);
    } else {
      fetchEvents(false, true);
    }
  }, [fetchEvents, selectedSpaces]);

  // ── Scroll lock (always active - fullpage) ──
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // ── Fetch user root folders for space picker ──
  useEffect(() => {
    fetch('/api/folders?parentId=null')
      .then(r => r.json())
      .then(json => {
        if (json.success && json.data?.folders) {
          setUserRootFolders(json.data.folders.map((f: any) => ({ id: f.id, name: f.name, type: f.type })));
        }
      })
      .catch(() => {});
  }, []);

  // ── Panel animation timing ──
  useEffect(() => {
    if (selectedDate) {
      setPanelDate(selectedDate);
    } else {
      const timer = setTimeout(() => setPanelDate(null), 300);
      return () => clearTimeout(timer);
    }
  }, [selectedDate]);

  // ── Month navigation ──
  const changeMonth = (delta: number) => {
    let newMonth = currentMonth + delta;
    let newYear = currentYear;
    if (newMonth < 1) {
      newMonth = 12;
      newYear -= 1;
    } else if (newMonth > 12) {
      newMonth = 1;
      newYear += 1;
    }
    setCurrentYear(newYear);
    setCurrentMonth(newMonth);
    // 바텀바 유지 - 월 전환 시 selectedDate를 null로 초기화하지 않음
    setShowAddForm(false);
    setEditingEvent(null);
    setSpacePickerMode(false);
    setAddTargetFolderId(null);
    setPendingAiEvents(null);
    setShowMonthPicker(false);
  };

  const changeMonthAnimated = useCallback((delta: number) => {
    if (isSnapping) return;
    const containerWidth = window.innerWidth;
    setIsSnapping(true);
    setSwipeOffset(delta > 0 ? -containerWidth : containerWidth);
    setTimeout(() => {
      requestAnimationFrame(() => {
        flushSync(() => {
          setIsSnapping(false);
          setSwipeOffset(0);
          changeMonth(delta);
        });
      });
    }, 250);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSnapping, changeMonth]);

  // ── Swipe to change month (slide) + vertical swipe for bottom sheet ──
  const handleSwipeStart = useCallback((e: React.TouchEvent) => {
    if (isSnapping) return;
    swipeStartX.current = e.touches[0].clientX;
    swipeStartY.current = e.touches[0].clientY;
    swipeDirection.current = null;
    swipeStartTime.current = Date.now();
  }, [isSnapping]);

  const handleSwipeMove = useCallback((e: React.TouchEvent) => {
    if (swipeStartX.current === null || swipeStartY.current === null || isSnapping) return;

    const dx = e.touches[0].clientX - swipeStartX.current;
    const dy = e.touches[0].clientY - swipeStartY.current;

    if (!swipeDirection.current && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      swipeDirection.current = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
    }

    if (swipeDirection.current === 'horizontal') {
      e.preventDefault();
      setSwipeOffset(dx);
    }

    // 수직 스와이프 시 마지막 Y 위치 기록 (바텀시트 제스처용)
    if (swipeDirection.current === 'vertical') {
      lastSwipeTouchY.current = e.touches[0].clientY;
    }
  }, [isSnapping]);

  const handleSwipeEnd = useCallback(() => {
    // 수직 스와이프 → 바텀시트 열기/닫기
    if (swipeDirection.current === 'vertical' && swipeStartY.current !== null) {
      // touchEnd에서는 터치 위치를 알 수 없으므로 lastSwipeTouchY ref 사용
      const lastY = lastSwipeTouchY.current;
      if (lastY !== null && swipeStartY.current !== null) {
        const verticalDy = lastY - swipeStartY.current;
        if (verticalDy < -50 && !selectedDate) {
          // 위로 50px 이상 스와이프 → 바텀시트 열기 (오늘 날짜)
          const kstNowSwipe = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
          const todayStrSwipe = `${kstNowSwipe.getFullYear()}-${String(kstNowSwipe.getMonth() + 1).padStart(2, '0')}-${String(kstNowSwipe.getDate()).padStart(2, '0')}`;
          setSelectedDate(todayStrSwipe);
          setShowAddForm(false);
          setEditingEvent(null);
          setSpacePickerMode(false);
          setAddTargetFolderId(null);
          setPendingAiEvents(null);
        } else if (verticalDy > 50 && selectedDate) {
          // 아래로 50px 이상 스와이프 → 바텀시트 닫기
          setSelectedDate(null);
        }
      }
      swipeStartX.current = null;
      swipeStartY.current = null;
      swipeDirection.current = null;
      lastSwipeTouchY.current = null;
      setSwipeOffset(0);
      return;
    }

    if (swipeStartX.current === null || swipeDirection.current !== 'horizontal') {
      swipeStartX.current = null;
      swipeStartY.current = null;
      swipeDirection.current = null;
      lastSwipeTouchY.current = null;
      setSwipeOffset(0);
      return;
    }

    const containerWidth = window.innerWidth;
    const elapsed = Date.now() - swipeStartTime.current;
    const velocity = Math.abs(swipeOffset) / Math.max(elapsed, 1);
    const threshold = velocity > 0.3 ? containerWidth * 0.1 : containerWidth * 0.25;

    if (swipeOffset < -threshold) {
      // 왼쪽 스와이프 → 다음 달
      setIsSnapping(true);
      setSwipeOffset(-containerWidth);
      setTimeout(() => {
        requestAnimationFrame(() => {
          // flushSync로 한 렌더에 동기 처리 → 깜박임 방지
          flushSync(() => {
            setIsSnapping(false);
            setSwipeOffset(0);
            changeMonth(1);
          });
        });
      }, 250);
    } else if (swipeOffset > threshold) {
      // 오른쪽 스와이프 → 이전 달
      setIsSnapping(true);
      setSwipeOffset(containerWidth);
      setTimeout(() => {
        requestAnimationFrame(() => {
          flushSync(() => {
            setIsSnapping(false);
            setSwipeOffset(0);
            changeMonth(-1);
          });
        });
      }, 250);
    } else {
      // 임계값 미달 → 원래 위치로 복귀
      setIsSnapping(true);
      setSwipeOffset(0);
      setTimeout(() => setIsSnapping(false), 250);
    }

    swipeStartX.current = null;
    swipeStartY.current = null;
    swipeDirection.current = null;
    lastSwipeTouchY.current = null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swipeOffset, selectedDate]);

  // ── Mouse wheel to change month ──
  const handleWheel = useCallback((e: React.WheelEvent) => {
    const now = Date.now();
    if (now - lastWheelTime.current < 300) return;

    if (e.deltaY > 30) {
      lastWheelTime.current = now;
      changeMonthAnimated(1);
    } else if (e.deltaY < -30) {
      lastWheelTime.current = now;
      changeMonthAnimated(-1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonth, currentYear, changeMonthAnimated]);

  // ── AI input auto-focus when panel opens (패널 애니메이션 완료 후 focus) ──
  useEffect(() => {
    if (showAiPanel && aiInputRef.current) {
      // 패널 등장 후 자동 포커스 (키보드 올림)
      setTimeout(() => aiInputRef.current?.focus(), 320);
    }
  }, [showAiPanel]);

  // ── AI submit ──
  const handleAiSubmit = async () => {
    if (!aiInput.trim() || aiLoading) return;
    setAiResult('');
    setAiLoading(true);
    // 체크박스 둘 다 해제 시 빈 set 그대로 사용 (fallback 없음)
    const activeSpacesForAi = selectedSpaces;

    try {
      // 전체 이벤트 가져오기
      let allEvents = events;
      try {
        const params = new URLSearchParams();
        // 항상 spaceTypes 기반으로 이벤트 조회 (체크박스 상태 반영)
        // folderId가 있어도 체크박스 기준으로 필터링해야 스페이스 격리 유지
        const spaceTypesStr = Array.from(activeSpacesForAi).sort().join(',');
        if (spaceTypesStr) params.set('spaceTypes', spaceTypesStr);
        const allRes = await fetch(`/api/calendar/events?${params}`);
        const allJson = await allRes.json();
        if (allJson.success && allJson.data) {
          allEvents = allJson.data;
        }
      } catch { /* 실패 시 현재 달 이벤트 사용 */ }

      const res = await fetch('/api/calendar/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: aiInput,
          folderId: addTargetFolderId || folderId || (activeSpacesForAi.size === 1 ? userRootFolders.find(f => f.type === (activeSpacesForAi.has('team') ? 'team' : 'personal'))?.id : null) || null,
          events: allEvents,
          activeSpaces: Array.from(activeSpacesForAi),
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        const { action, events: aiEvents, eventIds } = json.data;
        if (action === 'create' && aiEvents) {
          // 사용할 폴더 결정 (AI create는 체크박스 기반, folderId 무시)
          let targetFolder: string | null = addTargetFolderId || null;

          if (!targetFolder) {
            // 1. 키워드 감지: 사용자가 명시적으로 스페이스를 지정한 경우
            const inputLower = aiInput.toLowerCase();
            const wantTeam = inputLower.includes('팀스페이스') || inputLower.includes('팀 스페이스');
            const wantPersonal = inputLower.includes('개인스페이스') || inputLower.includes('개인 스페이스');

            if (wantTeam && !wantPersonal) {
              const teamFolder = userRootFolders.find(f => f.type === 'team');
              if (teamFolder) {
                targetFolder = teamFolder.id;
              }
            } else if (wantPersonal && !wantTeam) {
              const personalFolder = userRootFolders.find(f => f.type === 'personal');
              if (personalFolder) {
                targetFolder = personalFolder.id;
              }
            }

            // 2. 키워드로 결정 안된 경우: 체크박스 상태로 결정
            if (!targetFolder) {
              if (selectedSpaces.size === 2 || selectedSpaces.size === 0) {
                // 스페이스 타입별 폴더 존재 여부 확인
                const hasTeam = userRootFolders.some(f => f.type === 'team');
                const hasPersonal = userRootFolders.some(f => f.type === 'personal');

                if (hasTeam && !hasPersonal) {
                  // 팀만 있으면 자동선택
                  const teamFolder = userRootFolders.find(f => f.type === 'team');
                  if (teamFolder) {
                    for (const evt of aiEvents) {
                      let autoType = detectEventType(evt.title || '');
                      for (const cat of categories) {
                        if (!cat.keywords) continue;
                        const kwList = cat.keywords.split(',').map((k: string) => k.trim()).filter(Boolean);
                        if (kwList.some((kw: string) => (evt.title || '').includes(kw))) { autoType = cat.name; break; }
                      }
                      await fetch('/api/calendar/events', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ folderId: teamFolder.id, ...evt, eventType: autoType !== '일상' ? autoType : (evt.eventType || '일상') }),
                      });
                    }
                    setAiResult(`팀 스페이스 - ${aiEvents.length}건 일정이 추가되었습니다.`);
                    await fetchEvents(true);
                    setAiLoading(false);
                    setAiInput('');
                    return;
                  }
                } else if (hasPersonal && !hasTeam) {
                  // 개인만 있으면 자동선택
                  const personalFolder = userRootFolders.find(f => f.type === 'personal');
                  if (personalFolder) {
                    for (const evt of aiEvents) {
                      let autoType = detectEventType(evt.title || '');
                      for (const cat of categories) {
                        if (!cat.keywords) continue;
                        const kwList = cat.keywords.split(',').map((k: string) => k.trim()).filter(Boolean);
                        if (kwList.some((kw: string) => (evt.title || '').includes(kw))) { autoType = cat.name; break; }
                      }
                      await fetch('/api/calendar/events', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ folderId: personalFolder.id, ...evt, eventType: autoType !== '일상' ? autoType : (evt.eventType || '일상') }),
                      });
                    }
                    setAiResult(`개인 스페이스 - ${aiEvents.length}건 일정이 추가되었습니다.`);
                    await fetchEvents(true);
                    setAiLoading(false);
                    setAiInput('');
                    return;
                  }
                }

                // 둘 다 있으면 선택 UI 표시
                setPendingAiEvents(aiEvents);
                setSpacePickerMode(true);
                setAiResult('일정 추가할 스페이스(팀or개인)를 선택해주세요.');
                setAiLoading(false);
                setAiInput('');
                return;
              } else {
                // 하나만 체크 → 해당 타입의 첫 번째 폴더 사용
                const spaceType = selectedSpaces.has('team') ? 'team' : 'personal';
                const folder = userRootFolders.find(f => f.type === spaceType);
                if (folder) {
                  targetFolder = folder.id;
                } else {
                  setAiResult('해당 스페이스에 폴더가 없습니다.');
                  setAiLoading(false);
                  setAiInput('');
                  return;
                }
              }
            }
          }

          // 폴더 결정됨 → 이벤트 생성
          for (const evt of aiEvents) {
            let autoType = detectEventType(evt.title || '');
            for (const cat of categories) {
              if (!cat.keywords) continue;
              const kwList = cat.keywords.split(',').map((k: string) => k.trim()).filter(Boolean);
              if (kwList.some((kw: string) => (evt.title || '').includes(kw))) { autoType = cat.name; break; }
            }
            await fetch('/api/calendar/events', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ folderId: targetFolder, ...evt, eventType: autoType !== '일상' ? autoType : (evt.eventType || '일상') }),
            });
          }

          // 스페이스 이름 찾기
          const folderInfo = userRootFolders.find(f => f.id === targetFolder);
          const spaceName = folderInfo ? (folderInfo.type === 'team' ? '팀 스페이스' : '개인 스페이스') : '';
          setAiResult(`${spaceName ? spaceName + ' - ' : ''}${aiEvents.length}건 일정이 추가되었습니다.`);
          setAiInput('');
        } else if (action === 'update' && aiEvents) {
          for (const evt of aiEvents) {
            await fetch('/api/calendar/events', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(evt),
            });
          }
          setAiResult(`일정이 수정되었습니다.`);
        } else if (action === 'delete' && eventIds) {
          setPendingDeleteIds(eventIds);
          setAiResult(`삭제 확인 대기 중...`);
        } else if (action === 'query') {
          setAiResult(json.data.message || '답변을 생성하지 못했습니다.');
        } else if (action === 'error') {
          setAiResult(json.data.message || '처리할 수 없습니다.');
        }
        await fetchEvents(true);
      } else {
        setAiResult(json.error || '요청 처리에 실패했습니다.');
      }
    } catch {
      setAiResult('처리 중 오류가 발생했습니다.');
    } finally {
      setAiLoading(false);
      setAiInput('');
    }
  };

  // ── Direct add event ──
  const handleDirectAdd = async () => {
    if (!addTitle.trim() || !selectedDate) {
      console.warn('[handleDirectAdd] Missing:', { addTitle: addTitle.trim(), selectedDate });
      return;
    }

    // targetFolder 결정: addTargetFolderId 우선, 없으면 folderId 사용
    let targetFolder = addTargetFolderId || folderId;

    // 본인 소유 폴더인지 확인 (userRootFolders에 있는지)
    const isMyFolder = targetFolder && userRootFolders.some(f => f.id === targetFolder);

    if (!targetFolder || !isMyFolder) {
      // fallback: 첫 번째 폴더 (라디오가 이미 설정하므로 거의 안 탈 것)
      if (userRootFolders.length > 0) {
        targetFolder = userRootFolders[0].id;
        setAddTargetFolderId(targetFolder);
      } else {
        alert('일정을 추가할 폴더가 없습니다.');
        return;
      }
    }

    // 키워드 기반 카테고리 자동 감지
    let autoEventType = detectEventType(addTitle.trim()); // fallback
    const titleText = addTitle.trim();
    const matchedCategories: {name: string; colorBg: string; colorText: string}[] = [];
    for (const cat of categories) {
      if (!cat.keywords) continue;
      const kwList = cat.keywords.split(',').map(k => k.trim()).filter(Boolean);
      if (kwList.some(kw => titleText.includes(kw))) {
        matchedCategories.push({ name: cat.name, colorBg: cat.colorBg, colorText: cat.colorText });
      }
    }

    if (matchedCategories.length > 1) {
      // 여러 카테고리 매칭 → 선택 팝업 표시
      const parsed = processManualInput(addTitle.trim());
      setCategoryPickerOptions(matchedCategories);
      setPendingAddData({
        folderId: targetFolder,
        title: parsed.title,
        eventDate: selectedDate,
        eventTime: parsed.event_time || undefined,
        eventEndDate: addEndDate || undefined,
      });
      setCategoryPickerOpen(true);
      return;
    } else if (matchedCategories.length === 1) {
      autoEventType = matchedCategories[0].name;
    }

    // 시간 파싱: "계약서 작성 오후4시" → title: "계약서 작성", event_time: "16:00"
    const parsed = processManualInput(addTitle.trim());

    try {
      const res = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderId: targetFolder,
          title: parsed.title,
          eventDate: selectedDate,
          eventType: autoEventType,
          eventTime: parsed.event_time,
          eventEndDate: addEndDate || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        console.error('[handleDirectAdd] API error:', json.error);
        const myFolders = userRootFolders.map(f => `${f.name}(${f.id.slice(0,8)})`).join(', ');
        alert(`일정 추가 실패: ${json.error}\n\n[디버그]\ntargetFolder: ${targetFolder.slice(0,8)}\naddTargetFolderId: ${addTargetFolderId?.slice(0,8) || 'null'}\nfolderId prop: ${folderId?.slice(0,8) || 'null'}\nmyFolders: ${myFolders}`);
        return;
      }
      setAddTitle('');
      setAddEndDate('');
      setIsLongEvent(false);
      setShowAddForm(false);
      setAddTargetFolderId(null);
      // 현재 월 캐시만 무효화, silent refetch (깜박임 방지)
      const addSpaceStr = Array.from(selectedSpaces).sort().join(',');
      delete eventsCacheRef.current[`spaces-${addSpaceStr}-${currentYear}-${currentMonth}`];
      await fetchEvents(true, true);
    } catch (err) {
      console.error('Failed to add event:', err);
      alert('일정 추가 중 오류가 발생했습니다.');
    }
  };

  // ── Category picker select handler ──
  const handleCategoryPickerSelect = async (categoryName: string) => {
    if (!pendingAddData) return;
    setCategoryPickerOpen(false);
    try {
      const res = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...pendingAddData,
          eventType: categoryName,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        alert(`일정 추가 실패: ${json.error}`);
        return;
      }
      setAddTitle('');
      setAddEndDate('');
      setIsLongEvent(false);
      setShowAddForm(false);
      setAddTargetFolderId(null);
      const addSpaceStr = Array.from(selectedSpaces).sort().join(',');
      delete eventsCacheRef.current[`spaces-${addSpaceStr}-${currentYear}-${currentMonth}`];
      await fetchEvents(true, true);
    } catch (err) {
      console.error('Failed to add event:', err);
      alert('일정 추가 중 오류가 발생했습니다.');
    }
    setPendingAddData(null);
    setCategoryPickerOptions([]);
  };

  // ── Edit event ──
  const startEdit = (event: CalendarEvent) => {
    setEditingEvent(event);
    setEditTitle(event.title);
    setEditDate(event.event_date);
    setEditEventType(event.event_type);
    setEditAmount(event.amount ? String(event.amount) : '');
    setEditTime(event.event_time || '');
    setEditEndDate(event.event_end_date || '');
  };

  const handleEditSave = async () => {
    if (!editingEvent || !editTitle.trim()) return;
    try {
      const parsed = processManualInput(editTitle.trim());
      const finalTitle = parsed.title;
      const finalTime = parsed.event_time || editTime || undefined;
      await fetch('/api/calendar/events', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingEvent.id,
          title: finalTitle,
          eventDate: editDate,
          eventTime: finalTime,
          eventType: editEventType,
          amount: editAmount ? Number(editAmount) : undefined,
          eventEndDate: editEndDate || undefined,
        }),
      });
      setEditingEvent(null);
      // silent refetch (깜박임 방지)
      const editSpaceStr = Array.from(selectedSpaces).sort().join(',');
      delete eventsCacheRef.current[`spaces-${editSpaceStr}-${currentYear}-${currentMonth}`];
      await fetchEvents(true, true);
    } catch (err) {
      console.error('Failed to update event:', err);
    }
  };

  // ── Delete event ──
  const handleDelete = async (id: string) => {
    if (!window.confirm('이 일정을 삭제하시겠습니까?')) return;
    try {
      await fetch('/api/calendar/events', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      // silent refetch (깜박임 방지)
      const delSpaceStr = Array.from(selectedSpaces).sort().join(',');
      delete eventsCacheRef.current[`spaces-${delSpaceStr}-${currentYear}-${currentMonth}`];
      await fetchEvents(true, true);
    } catch (err) {
      console.error('Failed to delete event:', err);
    }
  };

  // ── AI delete confirmation handlers ──
  const handleConfirmDelete = async () => {
    try {
      for (const id of pendingDeleteIds) {
        await fetch('/api/calendar/events', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        });
      }
      setAiResult(`${pendingDeleteIds.length}건 일정이 삭제되었습니다.`);
      setPendingDeleteIds([]);
      // silent refetch (깜박임 방지)
      const delAllSpaceStr = Array.from(selectedSpaces).sort().join(',');
      delete eventsCacheRef.current[`spaces-${delAllSpaceStr}-${currentYear}-${currentMonth}`];
      await fetchEvents(true, true);
    } catch {
      setAiResult('삭제 중 오류가 발생했습니다.');
      setPendingDeleteIds([]);
    }
  };

  const handleCancelDelete = () => {
    setPendingDeleteIds([]);
    setAiResult('삭제가 취소되었습니다.');
  };

  const handleToggleComplete = async (eventId: string, completed: boolean) => {
    // 낙관적 업데이트 (UI 먼저 반영)
    setEvents(prev => prev.map(e => e.id === eventId ? { ...e, completed } : e));

    // 캐시도 업데이트
    Object.keys(eventsCacheRef.current).forEach(key => {
      eventsCacheRef.current[key] = eventsCacheRef.current[key].map(e =>
        e.id === eventId ? { ...e, completed } : e
      );
    });

    try {
      const res = await fetch('/api/calendar/events', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: eventId, completed }),
      });
      if (!res.ok) {
        // 실패 시 롤백
        setEvents(prev => prev.map(e => e.id === eventId ? { ...e, completed: !completed } : e));
      }
    } catch {
      // 에러 시 롤백
      setEvents(prev => prev.map(e => e.id === eventId ? { ...e, completed: !completed } : e));
    }
  };

  // ── Category filter: filtered events ──
  const filteredEvents = useMemo(() => {
    if (activeCategoryFilters.has('__all__')) return events;
    return events.filter(e => activeCategoryFilters.has(e.event_type));
  }, [events, activeCategoryFilters]);

  // ── Calendar grid data ──
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
  // 한국 시간(KST) 기준 오늘 날짜
  const kstNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const todayStr = `${kstNow.getFullYear()}-${String(kstNow.getMonth() + 1).padStart(2, '0')}-${String(kstNow.getDate()).padStart(2, '0')}`;

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);
  while (calendarDays.length % 7 !== 0) calendarDays.push(null);

  const getDateStr = (day: number) =>
    `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const holidays = getKoreanHolidays(currentYear);

  const getEventsForDate = (day: number) => {
    const dateStr = getDateStr(day);
    return filteredEvents.filter((e) => {
      if (e.event_end_date) {
        return dateStr >= e.event_date && dateStr <= e.event_end_date;
      }
      return e.event_date === dateStr;
    });
  };

  const displayDate = selectedDate || panelDate;
  const selectedDateEvents = displayDate
    ? sortEventsByTime(filteredEvents.filter((e) => {
        if (e.event_date === displayDate) return true;
        // 멀티데이 이벤트: 시작일~종료일 범위 내 날짜도 포함
        if (e.event_end_date && e.event_date <= displayDate && e.event_end_date >= displayDate) return true;
        return false;
      }))
    : [];

  // ── AI 버튼 드래그 핸들러 (touch 이벤트 + DOM 직접 조작) ──
  const handleAiBtnTouchStart = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    const touch = e.touches[0];
    aiBtnDragRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      origRight: aiBtnPos.right,
      origBottom: aiBtnPos.bottom,
      moved: false
    };
  }, [aiBtnPos]);

  const handleAiBtnTouchMove = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    if (!aiBtnDragRef.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - aiBtnDragRef.current.startX;
    const dy = touch.clientY - aiBtnDragRef.current.startY;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      aiBtnDragRef.current.moved = true;
    }
    if (aiBtnDragRef.current.moved && aiBtnRef.current) {
      // DOM 직접 조작으로 리렌더링 없이 실시간 이동
      const newRight = Math.max(5, Math.min(window.innerWidth - 60, aiBtnDragRef.current.origRight - dx));
      const newBottom = Math.max(5, Math.min(window.innerHeight - 60, aiBtnDragRef.current.origBottom - dy));
      aiBtnRef.current.style.right = `${newRight}px`;
      aiBtnRef.current.style.bottom = `${newBottom}px`;
    }
  }, []);

  const handleAiBtnTouchEnd = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault(); // synthetic click 방지 (백드롭 onClick 트리거 차단)
    if (!aiBtnDragRef.current) return;
    const wasDrag = aiBtnDragRef.current.moved;
    aiBtnDragRef.current = null;
    if (wasDrag && aiBtnRef.current) {
      // 드래그 끝: DOM에서 현재 위치를 읽어 state 업데이트 + localStorage 저장
      const finalRight = parseInt(aiBtnRef.current.style.right) || 20;
      const finalBottom = parseInt(aiBtnRef.current.style.bottom) || 180;
      const newPos = { right: finalRight, bottom: finalBottom };
      setAiBtnPos(newPos);
      localStorage.setItem('aiBtnPos', JSON.stringify(newPos));
    } else {
      // AI 패널 열 때 바텀시트 닫기 (깔끔한 전환)
      setSelectedDate(null);
      setShowAiPanel(true);
    }
  }, []);

  // ── AI 버튼 드래그 핸들러 (mouse 이벤트 - PC용) ──
  const handleAiBtnMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    aiBtnDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origRight: aiBtnPos.right,
      origBottom: aiBtnPos.bottom,
      moved: false
    };
    const handleMouseMove = (ev: MouseEvent) => {
      if (!aiBtnDragRef.current) return;
      const dx = ev.clientX - aiBtnDragRef.current.startX;
      const dy = ev.clientY - aiBtnDragRef.current.startY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) aiBtnDragRef.current.moved = true;
      if (aiBtnDragRef.current.moved && aiBtnRef.current) {
        const newRight = Math.max(5, Math.min(window.innerWidth - 60, aiBtnDragRef.current.origRight - dx));
        const newBottom = Math.max(5, Math.min(window.innerHeight - 60, aiBtnDragRef.current.origBottom - dy));
        aiBtnRef.current.style.right = `${newRight}px`;
        aiBtnRef.current.style.bottom = `${newBottom}px`;
      }
    };
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (!aiBtnDragRef.current) return;
      const wasDrag = aiBtnDragRef.current.moved;
      aiBtnDragRef.current = null;
      if (wasDrag && aiBtnRef.current) {
        const finalRight = parseInt(aiBtnRef.current.style.right) || 20;
        const finalBottom = parseInt(aiBtnRef.current.style.bottom) || 180;
        const newPos = { right: finalRight, bottom: finalBottom };
        setAiBtnPos(newPos);
        localStorage.setItem('aiBtnPos', JSON.stringify(newPos));
      } else {
        setSelectedDate(null);
        setShowAiPanel(true);
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [aiBtnPos]);

  // ── Prev/Next month helpers ──
  const getPrevMonth = () => {
    if (currentMonth === 1) return { year: currentYear - 1, month: 12 };
    return { year: currentYear, month: currentMonth - 1 };
  };
  const getNextMonth = () => {
    if (currentMonth === 12) return { year: currentYear + 1, month: 1 };
    return { year: currentYear, month: currentMonth + 1 };
  };

  const getCalendarDaysForMonth = (year: number, month: number) => {
    const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
    const daysInMth = new Date(year, month, 0).getDate();
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDayOfWeek; i++) days.push(null);
    for (let d = 1; d <= daysInMth; d++) days.push(d);
    while (days.length % 7 !== 0) days.push(null);
    return days;
  };

  const prevMonthData = getPrevMonth();
  const nextMonthData = getNextMonth();
  const prevCalendarDays = getCalendarDaysForMonth(prevMonthData.year, prevMonthData.month);
  const nextCalendarDays = getCalendarDaysForMonth(nextMonthData.year, nextMonthData.month);
  const prevHolidays = getKoreanHolidays(prevMonthData.year);
  const nextHolidays = getKoreanHolidays(nextMonthData.year);

  // ── Multi-day bar heights by textSize ──
  const multiDayBarHeight = textSize === 2 ? 24 : textSize === 1 ? 22 : 20;
  const multiDayFontSize = textSize === 2 ? '13px' : textSize === 1 ? '12px' : '11px';

  // ── Helper: split calendarDays array into weeks ──
  const splitIntoWeeks = (days: (number | null)[]) => {
    const weeks: (number | null)[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }
    return weeks;
  };

  // ── Helper: compute 7-date strings for a week row ──
  const getWeekDates = (weekDays: (number | null)[], year: number, month: number): string[] => {
    return weekDays.map((day, col) => {
      if (day !== null) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
      // Null slots: compute the actual calendar date by offsetting from the first non-null day
      // Find first non-null in this week
      const firstNonNullIdx = weekDays.findIndex(d => d !== null);
      if (firstNonNullIdx !== -1) {
        const firstNonNullDay = weekDays[firstNonNullIdx] as number;
        const firstDate = new Date(year, month - 1, firstNonNullDay);
        const offset = col - firstNonNullIdx;
        const d = new Date(firstDate);
        d.setDate(d.getDate() + offset);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }
      return '';
    });
  };

  // ── Compute multi-day segments per week for each panel ──
  const currentWeeks = splitIntoWeeks(calendarDays);
  const prevWeeks = splitIntoWeeks(prevCalendarDays);
  const nextWeeks = splitIntoWeeks(nextCalendarDays);

  const currentPanelEvents = filteredEvents;
  const prevPanelEvents = eventsCacheRef.current[`spaces-${Array.from(selectedSpaces).sort().join(',')}-${prevMonthData.year}-${prevMonthData.month}`] || [];
  const nextPanelEvents = eventsCacheRef.current[`spaces-${Array.from(selectedSpaces).sort().join(',')}-${nextMonthData.year}-${nextMonthData.month}`] || [];

  const currentWeekSegments = useMemo(() => currentWeeks.map(weekDays => {
    const weekDates = getWeekDates(weekDays, currentYear, currentMonth);
    return computeMultiDaySegments(currentPanelEvents, weekDates);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [currentPanelEvents, currentYear, currentMonth]);

  const prevWeekSegments = useMemo(() => prevWeeks.map(weekDays => {
    const weekDates = getWeekDates(weekDays, prevMonthData.year, prevMonthData.month);
    return computeMultiDaySegments(prevPanelEvents, weekDates);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [prevPanelEvents, prevMonthData.year, prevMonthData.month]);

  const nextWeekSegments = useMemo(() => nextWeeks.map(weekDays => {
    const weekDates = getWeekDates(weekDays, nextMonthData.year, nextMonthData.month);
    return computeMultiDaySegments(nextPanelEvents, weekDates);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [nextPanelEvents, nextMonthData.year, nextMonthData.month]);

  // ── Render multi-day bar layer for one week ──
  const renderMultiDayBars = (segments: MultiDaySegment[]) => {
    if (segments.length === 0) return null;
    const maxRow = Math.max(...segments.map(s => s.row));
    const layerHeight = (maxRow + 1) * multiDayBarHeight;
    return (
      <div className="relative w-full" style={{ height: layerHeight }}>
        {segments.map((seg) => {
          const color = getCategoryColor(seg.event.event_type);
          const isTransparent = color.bg === 'transparent';
          return (
            <div
              key={`${seg.event.id}-${seg.startCol}`}
              style={{
                position: 'absolute',
                left: `${(seg.startCol / 7) * 100}%`,
                width: `calc(${(seg.spanCols / 7) * 100}% - 2px)`,
                top: `${seg.row * multiDayBarHeight}px`,
                height: multiDayBarHeight - 2,
                backgroundColor: isTransparent ? 'transparent' : color.bg,
                color: color.text,
                borderRadius: `${seg.isStart ? '4px' : '0'} ${seg.isEnd ? '4px' : '0'} ${seg.isEnd ? '4px' : '0'} ${seg.isStart ? '4px' : '0'}`,
                fontSize: multiDayFontSize,
                fontWeight: 600,
                padding: isTransparent ? '0 2px' : '0 6px',
                overflow: 'hidden',
                textOverflow: 'clip',
                whiteSpace: 'nowrap',
                lineHeight: `${multiDayBarHeight - 2}px`,
                borderLeft: !seg.isStart && !isTransparent ? 'none' : undefined,
                boxSizing: 'border-box',
              }}
              title={seg.event.title}
            >
              {seg.isStart ? seg.event.title : ''}
            </div>
          );
        })}
      </div>
    );
  };

  // ── Render week row (multi-day bars + day cells) ──
  const renderWeekRow = (
    weekDays: (number | null)[],
    weekIdx: number,
    year: number,
    month: number,
    holidayMap: Map<string, string>,
    isOtherMonth: boolean,
    weekSegments: MultiDaySegment[],
    cellEvents?: CalendarEvent[],
    onGridClick?: () => void,
    catCellRef?: (dayIdx: number, el: HTMLDivElement | null) => void,
  ) => {
    const dateHeaderHeight = textSize === 2 ? 38 : textSize === 1 ? 32 : 28;
    // Calculate per-column padding based on overlapping multi-day segments
    const getColPadding = (col: number): number => {
      const overlapping = weekSegments.filter(s => col >= s.startCol && col < s.startCol + s.spanCols);
      if (overlapping.length === 0) return 0;
      const maxRow = Math.max(...overlapping.map(s => s.row));
      return (maxRow + 1) * multiDayBarHeight;
    };
    return (
      <div key={`week-${year}-${month}-${weekIdx}`} className="relative flex flex-col flex-1 min-h-0">
        {/* Day cells grid with multi-day bars overlay */}
        <div className="grid grid-cols-7 flex-1 min-h-0 relative" onClick={onGridClick}>
          {weekDays.map((day, dayIdx) =>
            renderDayCell(day, weekIdx * 7 + dayIdx, year, month, holidayMap, isOtherMonth, cellEvents, getColPadding(dayIdx), catCellRef ? (el) => catCellRef(dayIdx, el) : undefined)
          )}
          {/* Multi-day spanning bars - positioned below date headers, above events */}
          {weekSegments.length > 0 && (
            <div className="absolute left-0 right-0 pointer-events-none" style={{ top: dateHeaderHeight }}>
              {renderMultiDayBars(weekSegments)}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Render day cell (reusable for prev/current/next month) ──
  const renderDayCell = (day: number | null, idx: number, year: number, month: number, holidayMap: Map<string, string>, isOtherMonth: boolean, cellEvents?: CalendarEvent[], multiDayPaddingTop: number = 0, cellRefCallback?: (el: HTMLDivElement | null) => void) => {
    if (day === null) {
      return <div key={`empty-${year}-${month}-${idx}`} className="border-r border-b border-[#E5E7EB] bg-white" ref={cellRefCallback} />;
    }

    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayEventsForCell = sortEventsByTime((cellEvents ?? filteredEvents).filter(e => {
      // Multi-day events are rendered as spanning bars, skip them in day cells
      if (isMultiDayEvent(e)) return false;
      return e.event_date === dateStr;
    }));
    const isToday = dateStr === todayStr;
    const isSelected = !isOtherMonth && dateStr === selectedDate;
    const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
    const dayOfWeek = (firstDayOfWeek + day - 1) % 7;
    const isSunday = dayOfWeek === 0;
    const isSaturday = dayOfWeek === 6;
    const holidayName = holidayMap.get(dateStr);
    const isHoliday = !!holidayName;
    const maxVisible = textSize === 2 ? 3 : textSize === 1 ? 5 : 8;

    return (
      <div
        key={dateStr}
        ref={cellRefCallback}
        onClick={isOtherMonth ? undefined : (e) => {
          e.stopPropagation();
          setSelectedDate(selectedDate === dateStr ? null : dateStr);
          setShowAddForm(false);
          setEditingEvent(null);
          setSpacePickerMode(false);
          setAddTargetFolderId(null);
          setPendingAiEvents(null);
        }}
        className={`p-px sm:p-1 border-r border-b border-[#E5E7EB] bg-white h-full min-h-0 ${isOtherMonth ? '' : 'cursor-pointer active:scale-[0.95] active:bg-[#f0f0f0]'} transition-all duration-100 overflow-hidden ${
          isSelected ? 'bg-blue-50/30' : !isOtherMonth ? 'hover:bg-gray-50/50' : ''
        }`}
      >
        <div className={`flex items-center justify-center sm:justify-start ${textSize === 2 ? 'mb-1' : 'mb-0.5'}`}>
          <span className={`${textSize === 2 ? 'text-base sm:text-lg w-8 h-8' : textSize === 1 ? 'text-sm w-7 h-7' : 'text-xs sm:text-sm w-6 h-6'} inline-flex items-center justify-center rounded-full ${
            isToday ? 'bg-[#2563EB] text-white font-bold' :
            isOtherMonth ? 'text-[#98A2B3] font-semibold' :
            isHoliday || isSunday ? 'text-[#DC2626] font-semibold' :
            isSaturday ? 'text-[#2563EB] font-semibold' :
            'text-[#111827] font-semibold'
          }`}>
            {day}
          </span>
        </div>
        {holidayName && (
          <p className={`${textSize === 2 ? 'text-[14px]' : textSize === 1 ? 'text-[11px]' : 'text-[10px]'} text-red-500 font-medium leading-tight truncate text-center sm:text-left`}>{holidayName}</p>
        )}
        {!isOtherMonth && (
          <div className="flex flex-col" style={{ gap: textSize === 2 ? '4px' : '3px', paddingTop: multiDayPaddingTop > 0 ? multiDayPaddingTop : undefined }}>
            {dayEventsForCell.slice(0, maxVisible).map((evt) => (
              <div
                key={evt.id}
                className={`flex items-center overflow-hidden whitespace-nowrap${evt.completed ? ' opacity-40 line-through' : ''}`}
                style={{
                  height: textSize === 2 ? '23px' : textSize === 1 ? '20px' : '17px',
                  padding: getCategoryColor(evt.event_type).bg === 'transparent' ? '0' : textSize === 2 ? '3px 10px' : textSize === 1 ? '3px 8px' : '2px 6px',
                  borderRadius: getCategoryColor(evt.event_type).bg === 'transparent' ? '0' : textSize === 2 ? '5px' : textSize === 1 ? '4px' : '3px',
                  fontSize: textSize === 2 ? '12.5px' : textSize === 1 ? '11px' : '10px',
                  fontWeight: 600,
                  lineHeight: 1.2,
                  backgroundColor: getCategoryColor(evt.event_type).bg === 'transparent' ? 'transparent' : getCategoryColor(evt.event_type).bg,
                  color: getCategoryColor(evt.event_type).text,
                  textOverflow: 'clip',
                }}
                title={`${evt.event_time ? formatEventTime(evt.event_time) + ' ' : ''}${evt.title}${evt.amount ? ' ' + formatAmount(evt.amount) : ''}`}
              >
                {evt.event_time ? <span style={{
                  fontSize: textSize === 2 ? '11px' : textSize === 1 ? '10px' : '9px',
                  fontWeight: 500,
                  opacity: 0.82,
                  marginRight: textSize === 2 ? '4px' : textSize === 1 ? '3px' : '2px',
                  flexShrink: 0,
                }}>{formatEventTime(evt.event_time)}</span> : null}
                <span style={{ overflow: 'hidden', textOverflow: 'clip', whiteSpace: 'nowrap' }}>
                  {evt.title}
                  {evt.amount ? ` ${formatAmount(evt.amount)}` : ''}
                </span>
              </div>
            ))}
            {dayEventsForCell.length > maxVisible && (
              <div className={`${textSize === 2 ? 'text-sm' : textSize === 1 ? 'text-[10px]' : 'text-[8px]'} font-medium text-[#787774] px-1`}>
                +{dayEventsForCell.length - maxVisible}건
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">

      {/* Fullpage */}
      <div
        className="relative bg-white shadow-xl w-full flex flex-col overflow-hidden transition-all duration-[250ms] ease-[cubic-bezier(0.25,1,0.5,1)] max-w-[100vw] max-h-[100dvh] w-[100vw] h-[100dvh] rounded-none shadow-none"
      >
        {/* Title Bar */}
        <div className="px-4 py-3 border-b border-[#e3e2e0] flex items-center justify-between flex-shrink-0">
          <span className="text-sm font-bold text-[#37352f]">캘린더</span>
          <div className="flex items-center gap-1">
            <button
              onClick={cycleTimeFormat}
              className="px-3.5 py-1.5 text-sm font-bold rounded-full transition-all duration-150 active:scale-[0.92] bg-[#f0fdf4] text-[#16a34a] border border-[#bbf7d0] hover:bg-[#dcfce7]"
              title="시간 표시 형식 변경"
            >
              {timeFormat === 'colon' ? '🕐 14:00' : '🕐 오후2시'}
            </button>
            <button
              onClick={toggleTextSize}
              className={`px-3.5 py-1.5 text-sm font-bold rounded-full transition-all duration-150 active:scale-[0.92] ${textSize > 0 ? 'bg-[#8b5cf6] text-white shadow-sm' : 'bg-[#f5f3ff] text-[#8b5cf6] border border-[#ddd6fe]'}`}
              title={textSize === 0 ? '크게보기' : textSize === 1 ? '더크게보기' : '기본보기'}
            >
              {textSize === 0 ? '🔍 크게' : textSize === 1 ? '🔍 더크게' : '🔤 기본'}
            </button>
          </div>
        </div>

        {/* AI Input Box removed - replaced by floating AI button/panel below */}

        {/* Calendar content - flex column, no scroll */}
        <div className="flex-1 flex flex-col overflow-hidden" onClick={() => { if (selectedDate) setSelectedDate(null); }}>
          {/* Month Navigation */}
          <div className="flex items-center justify-center gap-2 px-4 py-1 flex-shrink-0">
            <button
              onClick={() => changeMonthAnimated(-1)}
              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[#efefef] transition-colors text-[#787774]"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => setShowMonthPicker(!showMonthPicker)}
              className="text-[22px] font-bold text-[#111827] hover:bg-[#efefef] px-2 py-0 rounded-lg transition-colors cursor-pointer"
            >
              {currentYear}년 {String(currentMonth).padStart(2, '0')}월
              <svg className="w-3.5 h-3.5 inline-block ml-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showMonthPicker ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
              </svg>
            </button>
            <button
              onClick={() => {
                const now = new Date();
                setCurrentYear(now.getFullYear());
                setCurrentMonth(now.getMonth() + 1);
                setSelectedDate(null);
                setShowAddForm(false);
                setEditingEvent(null);
                setShowMonthPicker(false);
              }}
              className="text-xs font-medium text-[#55534e] hover:text-[#37352f] hover:bg-[#efefef] px-2 py-1 rounded-md transition-colors border border-[#e3e2e0]"
            >
              오늘
            </button>
            <button
              onClick={() => changeMonthAnimated(1)}
              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[#efefef] transition-colors text-[#787774]"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Year/Month Picker */}
          {showMonthPicker && (
            <div className="px-4 py-3 border-b border-[#e3e2e0] bg-[#fbfbfa] animate-[slideDown_200ms_cubic-bezier(0.34,1.56,0.64,1)]">
              {/* 연도 선택 */}
              <div className="flex items-center justify-center gap-3 mb-3">
                <button
                  onClick={() => setCurrentYear(currentYear - 1)}
                  className="p-1 hover:bg-[#efefef] rounded-md transition-colors"
                >
                  <svg className="w-4 h-4 text-[#55534e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-sm font-bold text-[#37352f] min-w-[60px] text-center">{currentYear}년</span>
                <button
                  onClick={() => setCurrentYear(currentYear + 1)}
                  className="p-1 hover:bg-[#efefef] rounded-md transition-colors"
                >
                  <svg className="w-4 h-4 text-[#55534e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              {/* 월 그리드 (4x3) */}
              <div className="grid grid-cols-4 gap-1.5">
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <button
                    key={m}
                    onClick={() => {
                      setCurrentMonth(m);
                      setSelectedDate(null);
                      setShowAddForm(false);
                      setEditingEvent(null);
                      setShowMonthPicker(false);
                    }}
                    className={`py-1.5 text-sm rounded-md transition-all duration-150 active:scale-[0.92] ${
                      m === currentMonth
                        ? 'bg-[#2383e2] text-white font-bold'
                        : m === new Date().getMonth() + 1 && currentYear === new Date().getFullYear()
                          ? 'text-[#2383e2] font-semibold hover:bg-[#efefef]'
                          : 'text-[#37352f] hover:bg-[#efefef]'
                    }`}
                  >
                    {m}월
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Space filter checkboxes (always visible) */}
          <div className="flex items-center gap-3 px-4 py-1">
            <label className={`flex items-center gap-1.5 ${textSize === 2 ? 'text-sm' : textSize === 1 ? 'text-[15px]' : 'text-[13px]'} cursor-pointer select-none`}>
              <input
                type="checkbox"
                checked={selectedSpaces.has('team')}
                onChange={(e) => {
                  const next = new Set(selectedSpaces);
                  if (e.target.checked) next.add('team'); else next.delete('team');
                  setSelectedSpaces(next);
                  localStorage.setItem('calendarSpaces', JSON.stringify(Array.from(next)));
                }}
                className={`${textSize === 2 ? 'w-5 h-5' : textSize === 1 ? 'w-[18px] h-[18px]' : 'w-4 h-4'} rounded accent-[#7c3aed]`}
              />
              <span className="text-[#37352f] font-medium">팀 스페이스</span>
            </label>
            <label className={`flex items-center gap-1.5 ${textSize === 2 ? 'text-sm' : textSize === 1 ? 'text-[15px]' : 'text-[13px]'} cursor-pointer select-none`}>
              <input
                type="checkbox"
                checked={selectedSpaces.has('personal')}
                onChange={(e) => {
                  const next = new Set(selectedSpaces);
                  if (e.target.checked) next.add('personal'); else next.delete('personal');
                  setSelectedSpaces(next);
                  localStorage.setItem('calendarSpaces', JSON.stringify(Array.from(next)));
                }}
                className={`${textSize === 2 ? 'w-5 h-5' : textSize === 1 ? 'w-[18px] h-[18px]' : 'w-4 h-4'} rounded accent-[#2eaadc]`}
              />
              <span className="text-[#37352f] font-medium">개인 스페이스</span>
            </label>
            <span className="flex-1" />
            <button
              onClick={() => {
                setShowIcsImport(true);
                setIcsFile(null);
                setIcsResult(null);
                setIcsError(null);
              }}
              className={`flex items-center gap-1 px-2 sm:px-3 py-1.5 ${textSize === 2 ? 'text-sm' : textSize === 1 ? 'text-[13px] sm:text-[15px]' : 'text-[11px] sm:text-[13px]'} font-bold text-[#7c3aed] hover:text-[#6d28d9] bg-[#f5f3ff] hover:bg-[#ede9fe] rounded-full border border-[#ddd6fe] transition-all duration-200 active:scale-[0.92] shadow-sm whitespace-nowrap`}
            >
              <span>📥 가져오기</span>
            </button>
            <button
              onClick={() => {
                setShowCategoryManager(true);
                setEditingCategoryId(null);
                setAddingNewCategory(false);
              }}
              className={`flex items-center gap-1 px-2 sm:px-3 py-1.5 ${textSize === 2 ? 'text-sm' : textSize === 1 ? 'text-[13px] sm:text-[15px]' : 'text-[11px] sm:text-[13px]'} font-bold text-[#8b5cf6] hover:text-[#7c3aed] bg-[#f5f3ff] hover:bg-[#ede9fe] rounded-full border border-[#ddd6fe] transition-all duration-200 active:scale-[0.92] shadow-sm whitespace-nowrap`}
            >
              <span>🎨 컬러태그</span>
            </button>
          </div>

          {/* Category filter chips - horizontal scroll */}
          <div className="flex items-center gap-1.5 px-3 py-1 overflow-x-auto scrollbar-hide border-b border-[#E5E7EB]" style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' as React.CSSProperties['msOverflowStyle'] }}>
            <button
              onClick={() => setActiveCategoryFilters(new Set(['__all__']))}
              className={`flex-shrink-0 px-2.5 py-0.5 rounded-full text-xs font-semibold transition-all duration-150 active:scale-[0.95] ${
                activeCategoryFilters.has('__all__')
                  ? 'bg-[#37352f] text-white shadow-sm'
                  : 'bg-[#f0f0f0] text-[#787774] hover:bg-[#e3e2e0]'
              }`}
            >
              전체
            </button>
            {categories.map(cat => {
              const isActive = activeCategoryFilters.has(cat.name);
              const isAllMode = activeCategoryFilters.has('__all__');
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    const next = new Set(activeCategoryFilters);
                    if (isAllMode) {
                      next.clear();
                      next.add(cat.name);
                    } else if (isActive) {
                      next.delete(cat.name);
                      if (next.size === 0) next.add('__all__');
                    } else {
                      next.add(cat.name);
                    }
                    setActiveCategoryFilters(next);
                  }}
                  className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold transition-all duration-150 active:scale-[0.95] ${
                    isActive || isAllMode
                      ? 'shadow-sm ring-1 ring-black/10'
                      : 'opacity-40 hover:opacity-70'
                  }`}
                  style={{
                    backgroundColor: (isActive || isAllMode) ? cat.colorBg : '#f0f0f0',
                    color: (isActive || isAllMode) ? cat.colorText : '#787774',
                  }}
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.colorBg === 'transparent' ? '#d1d1d1' : cat.colorBg }} />
                  {cat.name}
                </button>
              );
            })}
          </div>

          {/* Weekday Header */}
          <div className={`grid grid-cols-7 text-center ${textSize === 2 ? 'text-sm' : textSize === 1 ? 'text-[13px]' : 'text-xs'} font-semibold text-[#475467] border-t border-b border-[#E5E7EB]`}>
            {['일', '월', '화', '수', '목', '금', '토'].map((d) => {
              // 1월~12월: 연두, 핑크, 하늘, 라벤더, 민트, 복숭아, 레몬, 장미, 청록, 살구, 보라, 산호
              const monthBgColors = ['bg-lime-50', 'bg-pink-50', 'bg-sky-50', 'bg-violet-50', 'bg-emerald-50', 'bg-rose-50', 'bg-amber-50', 'bg-fuchsia-50', 'bg-teal-50', 'bg-orange-50', 'bg-indigo-50', 'bg-red-50'];
              const headerBg = monthBgColors[(currentMonth - 1) % 12];
              return (
                <div
                  key={d}
                  className={`py-1.5 border-r border-[#E5E7EB] last:border-r-0 ${headerBg} ${d === '일' ? 'text-[#DC2626]' : d === '토' ? 'text-[#2563EB]' : ''}`}
                >
                  {d}
                </div>
              );
            })}
          </div>

          {/* Calendar Grid - 3-panel swipe slider */}
          <div className="relative flex-1 overflow-hidden" onWheel={handleWheel}>
            {loading && (
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-100 overflow-hidden z-10">
                <div className="h-full bg-blue-500 rounded-full animate-pulse" style={{ width: '40%' }} />
              </div>
            )}
            <div
              className={`flex h-full will-change-transform ${isSnapping ? 'transition-transform duration-[250ms] ease-[cubic-bezier(0.25,1,0.5,1)]' : ''}`}
              style={{
                width: '300%',
                transform: `translateX(calc(-33.333% + ${swipeOffset}px))`,
                backfaceVisibility: 'hidden',
              }}
              onTouchStart={handleSwipeStart}
              onTouchMove={handleSwipeMove}
              onTouchEnd={handleSwipeEnd}
            >
              {/* 이전 월 */}
              <div className="w-1/3 h-full flex flex-col">
                {prevWeeks.map((weekDays, weekIdx) =>
                  renderWeekRow(weekDays, weekIdx, prevMonthData.year, prevMonthData.month, prevHolidays, true, prevWeekSegments[weekIdx] || [], prevPanelEvents)
                )}
              </div>
              {/* 현재 월 */}
              <div
                className="w-1/3 h-full flex flex-col relative"
                ref={(el: HTMLDivElement | null) => setCatContainerRef(el)}
              >
                {currentWeeks.map((weekDays, weekIdx) =>
                  renderWeekRow(weekDays, weekIdx, currentYear, currentMonth, holidays, false, currentWeekSegments[weekIdx] || [], undefined, () => { setSelectedDate(null); setShowAddForm(false); setEditingEvent(null); setSpacePickerMode(false); setAddTargetFolderId(null); setPendingAiEvents(null); }, (dayIdx, el) => registerCatCell(weekIdx, dayIdx, el))
                )}
                {currentWeeks.length > 0 && (
                  <CalendarCat
                    x={catPixelPos.x}
                    y={catPixelPos.y}
                    state={catAnimState}
                    direction={catDirection}
                    bubble={catBubble}
                    onCatClick={handleCatClick}
                    onDragStart={handleCatDragStart}
                    reducedMotion={catReducedMotion}
                  />
                )}
              </div>
              {/* 다음 월 */}
              <div className="w-1/3 h-full flex flex-col">
                {nextWeeks.map((weekDays, weekIdx) =>
                  renderWeekRow(weekDays, weekIdx, nextMonthData.year, nextMonthData.month, nextHolidays, true, nextWeekSegments[weekIdx] || [], nextPanelEvents)
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Selected Date Detail Panel - Bottom Sheet */}
        <div
          className="bg-white border-t border-[#e3e2e0] shadow-[0_-4px_12px_rgba(0,0,0,0.08)] flex flex-col overflow-hidden"
          style={{
            height: selectedDate ? (editingEvent || showAddForm ? '55%' : '40%') : '0',
            maxHeight: selectedDate ? (editingEvent || showAddForm ? '55%' : '40%') : '0',
            overflow: 'hidden',
            transition: selectedDate
              ? 'height 350ms cubic-bezier(0.32, 0.72, 0, 1), max-height 350ms cubic-bezier(0.32, 0.72, 0, 1)'
              : 'height 250ms cubic-bezier(0.4, 0, 0.2, 1), max-height 250ms cubic-bezier(0.4, 0, 0.2, 1)',
            willChange: 'height, max-height',
          }}
        >
          <div style={{
            opacity: selectedDate ? 1 : 0,
            transform: selectedDate ? 'translateY(0)' : 'translateY(10px)',
            transition: selectedDate
              ? 'opacity 300ms ease 80ms, transform 300ms ease 80ms'
              : 'opacity 150ms ease, transform 150ms ease',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
          }}
          onTouchStart={(e) => {
            touchStartYRef.current = e.touches[0].clientY;
            touchCurrentYRef.current = e.touches[0].clientY;
          }}
          onTouchMove={(e) => {
            touchCurrentYRef.current = e.touches[0].clientY;
          }}
          onTouchEnd={() => {
            if (
              touchStartYRef.current !== null &&
              touchCurrentYRef.current !== null &&
              touchCurrentYRef.current - touchStartYRef.current > 50
            ) {
              const scrollEl = document.querySelector('[data-bottom-sheet-scroll]');
              if (!scrollEl || scrollEl.scrollTop <= 0) {
                setSelectedDate(null);
              }
            }
            touchStartYRef.current = null;
            touchCurrentYRef.current = null;
          }}
          >
          <div
            className="flex justify-center pt-2 pb-1 cursor-pointer select-none"
            onClick={() => setSelectedDate(null)}
          >
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>
          {panelDate && (
            <div className="px-4 pb-8 flex-1 overflow-y-auto min-h-0" data-bottom-sheet-scroll>
              {/* 헤더 */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className={`${textSize === 2 ? 'text-base' : textSize === 1 ? 'text-[15px]' : 'text-sm'} font-bold text-[#37352f]`}>일정</h3>
                  {panelDate && holidays.get(panelDate) && (
                    <span className={`${textSize === 2 ? 'text-sm' : textSize === 1 ? 'text-[13px]' : 'text-xs'} font-semibold text-red-500`}>{holidays.get(panelDate)}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                {(folderId || userRootFolders.length > 0) && (
                  <button
                    onClick={() => {
                      // 라디오 기본값 설정: selectedSpaces 체크박스 기반
                      let defaultFolder: string | null = null;
                      if (selectedSpaces.has('personal') && !selectedSpaces.has('team')) {
                        const pf = userRootFolders.find(f => f.type === 'personal');
                        if (pf) defaultFolder = pf.id;
                      }
                      if (!defaultFolder) {
                        const tf = userRootFolders.find(f => f.type === 'team');
                        if (tf) defaultFolder = tf.id;
                      }
                      if (!defaultFolder && userRootFolders.length > 0) {
                        defaultFolder = userRootFolders[0].id;
                      }
                      setAddTargetFolderId(defaultFolder);
                      setIsLongEvent(false);
                      setAddEndDate('');
                      setShowAddForm(true);
                      setEditingEvent(null);
                    }}
                    className={`${textSize === 2 ? 'px-4 py-1.5 text-sm' : textSize === 1 ? 'px-3.5 py-1 text-[13px]' : 'px-3 py-1 text-xs'} font-bold text-[#2eaadc] bg-[#e8f7fd] rounded-full border border-[#bae6fd] hover:bg-[#d1ecf5] transition-all active:scale-[0.92]`}
                  >
                    ✏️ 추가
                  </button>
                )}
                </div>
              </div>

              {/* Simplified Add Form - 인라인 라디오 버튼 + 입력 */}
                  {showAddForm && (
                    <div className="mb-2 p-3 bg-[#f7f7f5] rounded-lg space-y-2">
                      {/* 라디오 버튼 행 - 항상 팀/개인 둘 다 표시 */}
                      <div className="flex gap-3">
                        <label className={`flex items-center gap-1.5 cursor-pointer ${textSize === 2 ? 'text-base' : textSize === 1 ? 'text-[15px]' : 'text-sm'} font-medium ${addTargetFolderId && userRootFolders.find(f => f.id === addTargetFolderId)?.type === 'team' ? 'text-[#7c3aed]' : 'text-[#9b9a97]'}`}>
                          <input
                            type="radio"
                            name="addSpace"
                            checked={(() => {
                              const target = userRootFolders.find(f => f.id === addTargetFolderId);
                              return target?.type === 'team';
                            })()}
                            onChange={() => {
                              const teamFolder = userRootFolders.find(f => f.type === 'team');
                              if (teamFolder) {
                                setAddTargetFolderId(teamFolder.id);
                              } else {
                                alert('팀 스페이스가 없습니다.');
                              }
                            }}
                            className="accent-[#7c3aed]"
                          />
                          🏢 팀
                        </label>
                        <label className={`flex items-center gap-1.5 cursor-pointer ${textSize === 2 ? 'text-base' : textSize === 1 ? 'text-[15px]' : 'text-sm'} font-medium ${addTargetFolderId && userRootFolders.find(f => f.id === addTargetFolderId)?.type === 'personal' ? 'text-[#2eaadc]' : 'text-[#9b9a97]'}`}>
                          <input
                            type="radio"
                            name="addSpace"
                            checked={(() => {
                              const target = userRootFolders.find(f => f.id === addTargetFolderId);
                              return target?.type === 'personal';
                            })()}
                            onChange={() => {
                              const personalFolder = userRootFolders.find(f => f.type === 'personal');
                              if (personalFolder) {
                                setAddTargetFolderId(personalFolder.id);
                              } else {
                                alert('개인 스페이스가 없습니다.');
                              }
                            }}
                            className="accent-[#2eaadc]"
                          />
                          👤 개인
                        </label>
                      </div>
                      {/* 입력 + 등록 행 */}
                      <div className="flex gap-2 items-end">
                        <textarea
                          value={addTitle}
                          onChange={(e) => setAddTitle(e.target.value)}
                          placeholder="일정 내용을 입력하세요"
                          rows={1}
                          className={`flex-1 px-3 py-2 ${textSize === 2 ? 'text-base' : textSize === 1 ? 'text-[15px]' : 'text-sm'} bg-white border border-[#e3e2e0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2eaadc]/30 text-[#37352f] resize-none`}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              if (addTitle.trim()) handleDirectAdd();
                            }
                          }}
                        />
                        <button
                          onClick={handleDirectAdd}
                          disabled={!addTitle.trim()}
                          className={`px-4 py-2 ${textSize === 2 ? 'text-base' : textSize === 1 ? 'text-[15px]' : 'text-sm'} text-white bg-[#2eaadc] rounded-lg hover:bg-[#2696c4] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex-shrink-0`}
                        >
                          등록
                        </button>
                      </div>
                      <div className="flex flex-col gap-1.5 mt-1">
                        <label className="flex items-center gap-1.5 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={isLongEvent}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setIsLongEvent(checked);
                              if (checked && selectedDate) {
                                // 종료일 기본값: 시작일 다음날
                                const nextDay = new Date(selectedDate);
                                nextDay.setDate(nextDay.getDate() + 1);
                                setAddEndDate(nextDay.toISOString().split('T')[0]);
                              } else if (!checked) {
                                setAddEndDate('');
                              }
                            }}
                            className="accent-[#8b5cf6] w-3.5 h-3.5"
                          />
                          <span className="text-xs text-gray-600">📅 긴 일정 (여러 날)</span>
                        </label>
                        {isLongEvent && (
                          <div className="flex items-center gap-2">
                            <input
                              type="date"
                              value={selectedDate || ''}
                              onChange={(e) => {
                                // 시작일 변경 시 selectedDate 못 바꾸므로 읽기전용
                              }}
                              readOnly
                              className="text-xs border rounded px-2 py-1 bg-gray-50 text-gray-700"
                            />
                            <span className="text-xs text-gray-400">~</span>
                            <input
                              type="date"
                              value={addEndDate}
                              onChange={(e) => setAddEndDate(e.target.value)}
                              min={selectedDate || ''}
                              className="text-xs border rounded px-2 py-1"
                            />
                            {addEndDate && (
                              <button onClick={() => setAddEndDate('')} className="text-xs text-gray-400">✕</button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

              {/* 일정 목록 */}
              {(
                <>
                  {selectedDateEvents.length === 0 && !showAddForm && (
                    <p className={`${textSize === 2 ? 'text-sm' : textSize === 1 ? 'text-[13px]' : 'text-xs'} text-[#787774] py-2`}>이 날짜에 일정이 없습니다.</p>
                  )}

                  {selectedDateEvents.map((event) =>
                    editingEvent?.id === event.id ? (
                      /* ── Inline Edit Form ── */
                      <div
                        key={event.id}
                        className="flex flex-col gap-2 py-2 border-b border-[#f0f0f0] last:border-0"
                      >
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            placeholder="제목"
                            className={`flex-1 px-2 py-1.5 ${textSize === 2 ? 'text-base' : textSize === 1 ? 'text-[15px]' : 'text-sm'} border border-[#e3e2e0] rounded-md focus:outline-none focus:ring-1 focus:ring-[#2eaadc]/50 text-[#37352f]`}
                          />
                          <select
                            value={editEventType}
                            onChange={(e) => setEditEventType(e.target.value)}
                            className={`px-2 py-1.5 ${textSize === 2 ? 'text-base' : textSize === 1 ? 'text-[15px]' : 'text-sm'} border border-[#e3e2e0] rounded-md focus:outline-none focus:ring-1 focus:ring-[#2eaadc]/50 text-[#37352f]`}
                          >
                            {(categories.length > 0 ? categories.map(c => c.name) : ['계약', '중도금', '잔금', '안내', '상담', '일상']).map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500">종료일</span>
                          <input
                            type="date"
                            value={editEndDate}
                            onChange={(e) => setEditEndDate(e.target.value)}
                            min={editDate || ''}
                            className="text-xs border rounded px-2 py-1"
                          />
                          {editEndDate && (
                            <button onClick={() => setEditEndDate('')} className="text-xs text-gray-400">✕</button>
                          )}
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => setEditingEvent(null)}
                            className={`px-3 py-1 ${textSize === 2 ? 'text-sm' : textSize === 1 ? 'text-[13px]' : 'text-xs'} text-[#787774] bg-[#f7f7f5] rounded-md hover:bg-[#efefef] transition-colors`}
                          >
                            취소
                          </button>
                          <button
                            onClick={handleEditSave}
                            className={`px-3 py-1 ${textSize === 2 ? 'text-sm' : textSize === 1 ? 'text-[13px]' : 'text-xs'} text-white bg-[#2eaadc] rounded-md hover:bg-[#2696c4] transition-colors`}
                          >
                            저장
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* ── Event Row (카드형) ── */
                      <div
                        key={event.id}
                        className={`flex gap-2 py-2.5 border-b border-[#f0f0f0] last:border-0 transition-opacity ${
                          event.completed ? 'opacity-40' : ''
                        }`}
                      >
                        {/* 체크박스 */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleComplete(event.id, !event.completed);
                          }}
                          className={`${textSize === 2 ? 'w-6 h-6' : textSize === 1 ? 'w-[22px] h-[22px]' : 'w-5 h-5'} rounded border flex-shrink-0 self-start mt-0.5 flex items-center justify-center transition-colors ${
                            event.completed
                              ? 'bg-green-500 border-green-500 text-white'
                              : 'border-gray-300 hover:border-gray-400'
                          }`}
                        >
                          {event.completed && (
                            <svg className={`${textSize === 2 ? 'w-4 h-4' : textSize === 1 ? 'w-[15px] h-[15px]' : 'w-3.5 h-3.5'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                        {/* 콘텐츠 영역 */}
                        <div className="flex-1 min-w-0">
                          {/* 1줄: 카테고리 배지 + 시간 + 제목 */}
                          <div className="flex items-start gap-1.5">
                            <span
                              className={`${textSize === 2 ? 'text-sm' : textSize === 1 ? 'text-[13px]' : 'text-xs'} font-semibold flex-shrink-0${getCategoryColor(event.event_type).bg === 'transparent' ? '' : ' px-1.5 py-0.5 rounded'}`}
                              style={{ backgroundColor: getCategoryColor(event.event_type).bg === 'transparent' ? 'transparent' : getCategoryColor(event.event_type).bg, color: getCategoryColor(event.event_type).text }}
                            >
                              {event.event_type}
                            </span>
                            {event.event_time && (
                              <span className={`${textSize === 2 ? 'text-sm' : textSize === 1 ? 'text-[13px]' : 'text-xs'} font-mono font-medium flex-shrink-0 ${event.completed ? 'text-[#c0bfbc]' : 'text-[#55534e]'}`}>{formatEventTime(event.event_time)}</span>
                            )}
                            <span className={`${textSize === 2 ? 'text-base' : textSize === 1 ? 'text-[15px]' : 'text-sm'} font-medium break-words ${
                              event.completed ? 'line-through text-[#c0bfbc]' : 'text-[#37352f]'
                            }`}>{event.title}</span>
                          </div>
                          {/* 2줄: 고객명 · 금액 + 수정/삭제 */}
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {event.customer_name && (
                                <span className={`${textSize === 2 ? 'text-sm' : textSize === 1 ? 'text-[13px]' : 'text-xs'} font-medium ${event.completed ? 'line-through text-[#c0bfbc]' : 'text-[#787774]'}`}>{event.customer_name}</span>
                              )}
                              {event.amount && (
                                <span className={`${textSize === 2 ? 'text-sm' : textSize === 1 ? 'text-[13px]' : 'text-xs'} font-medium ${event.completed ? 'line-through text-[#c0bfbc]' : 'text-[#55534e]'}`}>{formatAmount(event.amount)}</span>
                              )}
                              <span className="flex-1" />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEdit(event);
                                }}
                                className={`${textSize === 2 ? 'text-sm' : textSize === 1 ? 'text-[13px]' : 'text-xs'} text-[#2eaadc] hover:text-[#2696c4] flex-shrink-0 transition-colors`}
                              >
                                수정
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(event.id);
                                }}
                                className={`${textSize === 2 ? 'text-sm' : textSize === 1 ? 'text-[13px]' : 'text-xs'} text-red-400 hover:text-red-500 flex-shrink-0 transition-colors`}
                              >
                                삭제
                              </button>
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </>
              )}
            </div>
          )}
          </div>
        </div>

        {/* ── ICS Import Modal (overlay) ── */}
        {showIcsImport && (
          <div className="absolute inset-0 z-50 flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/30"
              onClick={() => { setShowIcsImport(false); setIcsFile(null); setIcsResult(null); setIcsError(null); }}
            />
            <div className="relative bg-gradient-to-b from-[#faf5ff] to-white rounded-2xl shadow-2xl w-[90%] max-w-sm max-h-[85vh] flex flex-col overflow-hidden border border-[#e9d5ff]">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#e9d5ff] bg-gradient-to-r from-[#f5f3ff] to-[#fdf2f8]">
                <h3 className="text-base font-bold text-[#7c3aed]">📥 일정 가져오기</h3>
                <button
                  onClick={() => { setShowIcsImport(false); setIcsFile(null); setIcsResult(null); setIcsError(null); }}
                  className="w-7 h-7 flex items-center justify-center rounded-full text-[#c4b5fd] hover:text-[#8b5cf6] hover:bg-[#f5f3ff] transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {/* Body */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {/* 안내 텍스트 */}
                <div className="text-sm text-[#55534e] space-y-2">
                  <p className="font-medium text-[#37352f]">구글 캘린더, 네이버 캘린더에서 내보낸 .ics 파일을 업로드하세요.</p>
                  <div className="bg-[#f5f3ff] rounded-xl px-3 py-2.5 space-y-1.5 border border-[#e9d5ff]">
                    <p className="text-xs"><span className="font-bold text-[#7c3aed]">구글:</span> 설정 → 가져오기/내보내기 → 내보내기</p>
                    <p className="text-xs"><span className="font-bold text-[#7c3aed]">네이버:</span> 환경설정 → 일정설정 → 내보내기</p>
                  </div>
                </div>

                {/* 파일 선택 */}
                <div>
                  <label className="block w-full cursor-pointer">
                    <div className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed transition-all duration-200 ${
                      icsFile ? 'border-[#8b5cf6] bg-[#f5f3ff]' : 'border-[#d4d4d8] hover:border-[#8b5cf6] hover:bg-[#faf5ff]'
                    }`}>
                      <svg className="w-5 h-5 text-[#8b5cf6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      {icsFile ? (
                        <span className="text-sm font-medium text-[#7c3aed] truncate max-w-[200px]">{icsFile.name}</span>
                      ) : (
                        <span className="text-sm text-[#787774]">.ics 파일 선택</span>
                      )}
                    </div>
                    <input
                      type="file"
                      accept=".ics"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setIcsFile(file);
                        setIcsResult(null);
                        setIcsError(null);
                      }}
                    />
                  </label>
                </div>

                {/* 결과/에러 표시 */}
                {icsResult && (
                  <div className="bg-[#dcfce7] rounded-xl px-3 py-2.5 border border-[#bbf7d0]">
                    <p className="text-sm font-bold text-[#166534]">{icsResult.imported}건의 일정을 가져왔습니다!</p>
                    {icsResult.skipped > 0 && (
                      <p className="text-xs text-[#15803d] mt-0.5">중복 {icsResult.skipped}건 스킵</p>
                    )}
                    {icsResult.batchId && icsResult.imported > 0 && (
                      <button
                        disabled={icsUndoing}
                        onClick={async () => {
                          if (!icsResult.batchId) return;
                          const confirmMsg = `가져온 일정 ${icsResult.imported}건을 삭제합니다. 기존 일정은 유지됩니다.`;
                          if (!window.confirm(confirmMsg)) return;
                          setIcsUndoing(true);
                          try {
                            const res = await fetch(`/api/calendar/import?batchId=${encodeURIComponent(icsResult.batchId)}`, {
                              method: 'DELETE',
                            });
                            const json = await res.json();
                            if (json.success) {
                              setIcsResult(null);
                              setIcsFile(null);
                              setIcsError(null);
                              eventsCacheRef.current = {};
                              await fetchEvents(true);
                            } else {
                              setIcsError(json.error || '취소 실패');
                            }
                          } catch (err) {
                            console.error('ICS undo error:', err);
                            setIcsError('가져오기 취소 중 오류가 발생했습니다.');
                          } finally {
                            setIcsUndoing(false);
                          }
                        }}
                        className={`mt-2 w-full py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                          icsUndoing
                            ? 'bg-[#e5e5e5] text-[#a3a3a3] cursor-not-allowed'
                            : 'bg-white text-[#dc2626] border border-[#fca5a5] hover:bg-[#fef2f2] active:scale-[0.97]'
                        }`}
                      >
                        {icsUndoing ? '취소하는 중...' : '가져오기 취소 (되돌리기)'}
                      </button>
                    )}
                  </div>
                )}
                {icsError && (
                  <div className="bg-[#fee2e2] rounded-xl px-3 py-2.5 border border-[#fecaca]">
                    <p className="text-sm font-medium text-[#991b1b]">{icsError}</p>
                  </div>
                )}
              </div>
              {/* Footer */}
              <div className="px-4 py-3 border-t border-[#e9d5ff] bg-[#faf5ff]">
                <button
                  disabled={!icsFile || icsImporting}
                  onClick={async () => {
                    if (!icsFile) return;
                    setIcsImporting(true);
                    setIcsResult(null);
                    setIcsError(null);
                    try {
                      const text = await icsFile.text();
                      // 대상 폴더 결정: personal 우선, 없으면 첫 번째 폴더
                      const targetFolder = userRootFolders.find(f => f.type === 'personal')?.id
                        || userRootFolders[0]?.id
                        || folderId;
                      if (!targetFolder) {
                        setIcsError('저장할 폴더를 찾을 수 없습니다.');
                        return;
                      }
                      const res = await fetch('/api/calendar/import', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ icsText: text, folderId: targetFolder }),
                      });
                      const json = await res.json();
                      if (json.success) {
                        setIcsResult(json.data);
                        // 캐시 클리어 + 리페치
                        eventsCacheRef.current = {};
                        await fetchEvents(true);
                      } else {
                        setIcsError(json.error || '가져오기 실패');
                      }
                    } catch (err) {
                      console.error('ICS import error:', err);
                      setIcsError('파일을 읽는 중 오류가 발생했습니다.');
                    } finally {
                      setIcsImporting(false);
                    }
                  }}
                  className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all duration-200 active:scale-[0.97] ${
                    !icsFile || icsImporting
                      ? 'bg-[#e5e5e5] text-[#a3a3a3] cursor-not-allowed'
                      : 'bg-gradient-to-r from-[#8b5cf6] to-[#7c3aed] text-white shadow-md hover:shadow-lg'
                  }`}
                >
                  {icsImporting ? '가져오는 중...' : '가져오기'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Category Manager Modal (overlay) ── */}
        {showCategoryManager && (
          <div className="absolute inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/30"
              onClick={() => {
                setShowCategoryManager(false);
                setEditingCategoryId(null);
                setAddingNewCategory(false);
              }}
            />
            {/* Modal */}
            <div className="relative bg-gradient-to-b from-[#faf5ff] to-white rounded-2xl shadow-2xl w-[90%] max-w-sm max-h-[85vh] flex flex-col overflow-hidden border border-[#e9d5ff]">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#e9d5ff] bg-gradient-to-r from-[#f5f3ff] to-[#fdf2f8]">
                <h3 className="text-base font-bold text-[#7c3aed]">🎨 컬러태그</h3>
                <button
                  onClick={() => {
                    setShowCategoryManager(false);
                    setEditingCategoryId(null);
                    setAddingNewCategory(false);
                  }}
                  className="w-7 h-7 flex items-center justify-center rounded-full text-[#c4b5fd] hover:text-[#8b5cf6] hover:bg-[#f5f3ff] transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {/* Body */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                {/* Category list */}
                {categories.map((cat) => (
                  <div key={cat.id}>
                    {editingCategoryId === cat.id ? (
                      /* Selected highlight - edit form is in footer */
                      <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#f5f3ff] border-2 border-[#8b5cf6] transition-all duration-200">
                        <div className="flex-1 min-w-0">
                          <span
                            className="text-sm font-bold px-3 py-1 rounded-full inline-block shadow-sm"
                            style={{ backgroundColor: cat.colorBg, color: cat.colorText }}
                          >
                            {cat.name}
                          </span>
                          <p className="text-xs text-[#8b5cf6] mt-1 ml-0.5">✏️ 아래에서 편집 중</p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingCategoryId(null); }}
                          className="text-xs text-[#8b5cf6] font-medium hover:text-[#7c3aed]"
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      /* Display mode */
                      <div
                        className="flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-[#faf5ff] cursor-pointer transition-all duration-200 group hover:shadow-sm"
                        onClick={() => {
                          setEditingCategoryId(cat.id);
                          setCatEditName(cat.name);
                          setCatEditBg(cat.colorBg);
                          setCatEditText(cat.colorText);
                          setCatEditKeywords(cat.keywords || '');
                          setAddingNewCategory(false);
                        }}
                      >
                        <div className="flex-1 min-w-0">
                          <span
                            className="text-sm font-bold px-3 py-1 rounded-full inline-block shadow-sm"
                            style={{ backgroundColor: cat.colorBg, color: cat.colorText }}
                          >
                            {cat.name}
                          </span>
                          <p className="text-xs text-[#787774] mt-1 ml-0.5 truncate">
                            {cat.keywords ? `키워드: ${cat.keywords}` : '키워드 없음'}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingCategoryId(cat.id);
                            setCatEditName(cat.name);
                            setCatEditBg(cat.colorBg);
                            setCatEditText(cat.colorText);
                            setCatEditKeywords(cat.keywords || '');
                            setAddingNewCategory(false);
                          }}
                          className="text-xs text-[#a78bfa] hover:text-[#8b5cf6] transition-all font-medium"
                        >
                          편집
                        </button>
                        {cat.name !== '일상' && (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (!window.confirm(`'${cat.name}' 태그를 삭제하시겠습니까?\n이 태그의 일정은 '일상'으로 변경됩니다.`)) return;
                              try {
                                await fetch('/api/calendar/categories', {
                                  method: 'DELETE',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ id: cat.id }),
                                });
                                await fetchCategories();
                              } catch (err) {
                                console.error('Failed to delete category:', err);
                              }
                            }}
                            className="text-xs text-red-400 hover:text-red-500 transition-all"
                          >
                            삭제
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {categories.length === 0 && !addingNewCategory && (
                  <p className="text-sm text-[#a78bfa] py-4 text-center">🌈 아직 태그가 없어요!<br/><span className="text-xs text-[#c4b5fd]">아래에서 나만의 태그를 만들어 보세요</span></p>
                )}
              </div>
              {/* Footer: Add new category - sticky at bottom */}
              <div className="px-4 py-3 border-t border-[#e9d5ff] bg-gradient-to-r from-[#faf5ff] to-[#fdf2f8] flex-shrink-0">
                {editingCategoryId ? (() => {
                  const editCat = categories.find(c => c.id === editingCategoryId);
                  if (!editCat) return null;
                  return (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-[#8b5cf6]">✏️ 편집:</span>
                        <span className="text-sm font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: catEditBg, color: catEditText }}>{catEditName || editCat.name}</span>
                      </div>
                      <input
                        type="text"
                        value={catEditName}
                        onChange={(e) => setCatEditName(e.target.value)}
                        placeholder="태그 이름"
                        className="w-full px-3 py-2 text-sm border border-[#ddd6fe] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#c084fc]/40 focus:border-[#c084fc] text-[#37352f] bg-white/80 placeholder:text-[#c4b5fd]"
                        autoFocus
                      />
                      <div className="grid grid-cols-6 gap-1.5">
                        {COLOR_PRESETS.map((preset, i) => (
                          <button
                            key={i}
                            onClick={async () => {
                              setCatEditBg(preset.bg); setCatEditText(preset.text);
                              // 색상은 클릭만으로 즉시 저장
                              try {
                                await fetch('/api/calendar/categories', {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ id: editCat.id, colorBg: preset.bg, colorText: preset.text }),
                                });
                                await fetchCategories();
                                eventsCacheRef.current = {};
                                await fetchEvents(true, true);
                              } catch (err) {
                                console.error('Failed to update color:', err);
                              }
                            }}
                            className={`w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center text-[10px] font-bold shadow-sm hover:scale-110 ${catEditBg === preset.bg && catEditText === preset.text ? 'border-[#8b5cf6] scale-110' : preset.bg === 'transparent' ? 'border-gray-300' : 'border-transparent'}`}
                            style={{ backgroundColor: preset.bg === 'transparent' ? '#ffffff' : preset.bg, color: preset.text, position: 'relative', overflow: 'hidden' }}
                          >
                            {preset.bg === 'transparent' ? (
                              <svg viewBox="0 0 32 32" width="28" height="28" style={{ position: 'absolute', top: 0, left: 0 }}><line x1="4" y1="28" x2="28" y2="4" stroke="#d1d5db" strokeWidth="2" /></svg>
                            ) : '가'}
                          </button>
                        ))}
                      </div>
                      <input
                        type="text"
                        value={catEditKeywords}
                        onChange={(e) => setCatEditKeywords(e.target.value)}
                        placeholder="반응 키워드 (쉼표로 구분)"
                        className="w-full px-3 py-2 text-sm border border-[#ddd6fe] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#c084fc]/40 focus:border-[#c084fc] text-[#37352f] bg-white/80 placeholder:text-[#c4b5fd]"
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => setEditingCategoryId(null)}
                          className="px-4 py-1.5 text-xs font-medium text-[#8b5cf6] bg-white border border-[#ddd6fe] rounded-full hover:bg-[#f5f3ff] transition-all"
                        >
                          취소
                        </button>
                        <button
                          onClick={async () => {
                            if (!catEditName.trim() || catSaving) return;
                            setCatSaving(true);
                            try {
                              await fetch('/api/calendar/categories', {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ id: editCat.id, name: catEditName.trim(), colorBg: catEditBg, colorText: catEditText, keywords: catEditKeywords }),
                              });
                              await fetchCategories();
                              eventsCacheRef.current = {};
                              await fetchEvents(true, true);
                              setEditingCategoryId(null);
                            } catch (err) {
                              console.error('Failed to update category:', err);
                            } finally {
                              setCatSaving(false);
                            }
                          }}
                          disabled={catSaving || !catEditName.trim()}
                          className="px-4 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-[#8b5cf6] to-[#a78bfa] rounded-full hover:from-[#7c3aed] hover:to-[#8b5cf6] transition-all disabled:opacity-50 shadow-sm"
                        >
                          {catSaving ? '저장 중...' : '저장'}
                        </button>
                      </div>
                    </div>
                  );
                })() : addingNewCategory ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      placeholder="새 태그 이름"
                      className="w-full px-3 py-2 text-sm border border-[#ddd6fe] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#c084fc]/40 focus:border-[#c084fc] text-[#37352f] bg-white/80 placeholder:text-[#c4b5fd]"
                      autoFocus
                    />
                    <div className="grid grid-cols-6 gap-1.5">
                      {COLOR_PRESETS.map((preset, i) => (
                        <button
                          key={i}
                          onClick={() => { setNewCatBg(preset.bg); setNewCatText(preset.text); }}
                          className={`w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center text-[10px] font-bold shadow-sm hover:scale-110 ${newCatBg === preset.bg && newCatText === preset.text ? 'border-[#8b5cf6] scale-110' : preset.bg === 'transparent' ? 'border-gray-300' : 'border-transparent'}`}
                          style={{ backgroundColor: preset.bg === 'transparent' ? '#ffffff' : preset.bg, color: preset.text, position: 'relative', overflow: 'hidden' }}
                        >
                          {preset.bg === 'transparent' ? (
                            <svg viewBox="0 0 32 32" width="28" height="28" style={{ position: 'absolute', top: 0, left: 0 }}><line x1="4" y1="28" x2="28" y2="4" stroke="#d1d5db" strokeWidth="2" /></svg>
                          ) : '가'}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={newCatKeywords}
                      onChange={(e) => setNewCatKeywords(e.target.value)}
                      placeholder="반응 키워드 (쉼표로 구분)"
                      className="w-full px-3 py-2 text-sm border border-[#ddd6fe] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#c084fc]/40 focus:border-[#c084fc] text-[#37352f] bg-white/80 placeholder:text-[#c4b5fd]"
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => { setAddingNewCategory(false); setNewCatName(''); setNewCatKeywords(''); }}
                        className="px-4 py-1.5 text-xs font-medium text-[#8b5cf6] bg-white border border-[#ddd6fe] rounded-full hover:bg-[#f5f3ff] transition-all"
                      >
                        취소
                      </button>
                      <button
                        onClick={async () => {
                          if (!newCatName.trim() || catSaving) return;
                          setCatSaving(true);
                          try {
                            await fetch('/api/calendar/categories', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ name: newCatName.trim(), colorBg: newCatBg, colorText: newCatText, keywords: newCatKeywords }),
                            });
                            await fetchCategories();
                            setAddingNewCategory(false);
                            setNewCatName('');
                            setNewCatKeywords('');
                            setNewCatBg('#f3f4f6');
                            setNewCatText('#374151');
                          } catch (err) {
                            console.error('Failed to create category:', err);
                          } finally {
                            setCatSaving(false);
                          }
                        }}
                        disabled={catSaving || !newCatName.trim()}
                        className="px-4 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-[#8b5cf6] to-[#a78bfa] rounded-full hover:from-[#7c3aed] hover:to-[#8b5cf6] transition-all disabled:opacity-50 shadow-sm"
                      >
                        {catSaving ? '추가 중...' : '추가'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setAddingNewCategory(true); setEditingCategoryId(null); }}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-bold text-[#8b5cf6] hover:text-[#7c3aed] border-2 border-dashed border-[#ddd6fe] rounded-xl hover:bg-[#f5f3ff] hover:border-[#c084fc] transition-all"
                  >
                    <span className="text-sm">✨</span>
                    새 태그 만들기
                  </button>
                )}
              </div>
            </div>
          </div>
        )}


      </div>

      {/* Floating AI Button (draggable) - outside modal content, inside fixed wrapper */}
      {(folderId || userRootFolders.length > 0) && (
        <button
          ref={aiBtnRef}
          onTouchStart={handleAiBtnTouchStart}
          onTouchMove={handleAiBtnTouchMove}
          onTouchEnd={handleAiBtnTouchEnd}
          onMouseDown={handleAiBtnMouseDown}
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
          className={`fixed w-14 h-14 rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] text-white shadow-lg flex items-center justify-center z-[99999] select-none transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${showAiPanel ? "opacity-0 scale-75 pointer-events-none" : "opacity-100 scale-100"}`}
          style={{
            right: `${aiBtnPos.right}px`,
            bottom: `${aiBtnPos.bottom}px`,
            touchAction: 'none',
            animation: 'aiPulse 2s ease-in-out infinite',
            willChange: 'transform',
            boxShadow: '0 0 20px rgba(139, 92, 246, 0.4)'
          }}
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
          </svg>
        </button>
      )}

      {/* Floating AI Panel - outside modal content, inside fixed wrapper */}
      {(folderId || userRootFolders.length > 0) && showAiPanel && (
        <div className={`fixed inset-0 z-[99999] flex items-start justify-center pt-[12vh] sm:items-center sm:pt-0`} style={{ animation: 'aiBackdropIn 300ms ease-out forwards' }}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/20" onClick={() => setShowAiPanel(false)} style={{ animation: 'aiFadeIn 300ms ease-out forwards' }} />
          <div className="relative w-[94%] max-w-lg" style={{ animation: 'aiPanelIn 400ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}>
            <div className="bg-white rounded-2xl shadow-2xl border border-[#e3e2e0] overflow-hidden" style={{ boxShadow: '0 0 40px rgba(139, 92, 246, 0.15), 0 20px 60px rgba(0, 0, 0, 0.12)' }}>
              {/* AI 패널 헤더 */}
              <div className="px-5 py-3.5 flex items-center justify-between relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a78bfa 100%)' }}>
                <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)', backgroundSize: '200% 100%', animation: 'aiHeaderShimmer 2s ease-in-out infinite' }} />
                <span className="text-sm text-white font-semibold flex items-center gap-2">
                  <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                  AI 캘린더 도우미
                </span>
                <button onClick={() => setShowAiPanel(false)} className="relative z-10 text-white/80 hover:text-white p-2 -mr-1">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {/* AI 입력 */}
              <div className="p-4">
                <div className="flex gap-2">
                  <input
                    ref={aiInputRef}
                    type="text"
                    placeholder="예: '내일 3시 김철수 상담 추가해줘'"
                    className="flex-1 px-4 py-3 text-base bg-[#f7f7f5] border border-[#e3e2e0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]/30 text-[#37352f]"
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleAiSubmit();
                    }}
                  />
                  <button
                    onClick={handleAiSubmit}
                    disabled={aiLoading || !aiInput.trim()}
                    className="px-4 py-3 bg-[#8b5cf6] text-white rounded-xl disabled:opacity-40 active:scale-[0.92] transition-all duration-150"
                  >
                    {aiLoading ? (
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                      </svg>
                    )}
                  </button>
                </div>

                {/* AI Delete Confirmation UI */}
                {pendingDeleteIds.length > 0 && (
                  <div className="mt-2 rounded-xl text-sm overflow-hidden shadow-lg border border-red-200">
                    <div className="flex items-center justify-between px-4 py-2 bg-red-500">
                      <div className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-white/90 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-[11px] font-bold text-white tracking-wide">삭제할 일정 {pendingDeleteIds.length}건</span>
                      </div>
                    </div>
                    <div className="px-4 py-3 bg-red-50">
                      <div className="space-y-1.5 mb-3">
                        {pendingDeleteIds.map((id) => {
                          const evt = events.find((e) => e.id === id);
                          return (
                            <div key={id} className="flex items-center gap-2 text-xs text-gray-700">
                              <span className="text-red-400">&#x2022;</span>
                              {evt ? (
                                <>
                                  <span className={`flex-shrink-0${getCategoryColor(evt.event_type).bg === 'transparent' ? '' : ' px-1.5 py-0.5 rounded'}`} style={{ backgroundColor: getCategoryColor(evt.event_type).bg === 'transparent' ? 'transparent' : getCategoryColor(evt.event_type).bg, color: getCategoryColor(evt.event_type).text }}>
                                    {evt.event_type}
                                  </span>
                                  <span className="text-gray-500 flex-shrink-0">{evt.event_date}</span>
                                  <span className="font-medium truncate">{evt.title}</span>
                                </>
                              ) : (
                                <span className="text-gray-400">알 수 없는 일정 (ID: {id.slice(0, 8)}...)</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={handleCancelDelete}
                          className="px-3 py-1.5 text-xs text-[#787774] bg-white border border-[#e3e2e0] rounded-md hover:bg-[#efefef] transition-colors"
                        >
                          취소
                        </button>
                        <button
                          onClick={handleConfirmDelete}
                          className="px-3 py-1.5 text-xs text-white bg-red-500 rounded-md hover:bg-red-600 transition-colors"
                        >
                          삭제 확인
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* AI Result Display */}
                {aiResult && pendingDeleteIds.length === 0 && (
                  <div className={`mt-2 rounded-xl text-sm overflow-hidden ${
                    aiResult.length > 30
                      ? 'shadow-lg border border-indigo-200'
                      : 'text-xs text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg'
                  }`}>
                    {aiResult.length > 30 ? (
                      <>
                        <div className="flex items-center justify-between px-4 py-2" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a78bfa 100%)' }}>
                          <div className="flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5 text-white/90 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                            </svg>
                            <span className="text-[11px] font-bold text-white tracking-wide">날개의답변</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(aiResult);
                                const btn = document.getElementById('ai-copy-btn');
                                if (btn) { btn.textContent = '복사됨'; setTimeout(() => { btn.textContent = '복사'; }, 1500); }
                              }}
                              id="ai-copy-btn"
                              className="text-[10px] text-white/80 hover:text-white transition-colors px-2 py-0.5 rounded-md hover:bg-white/20"
                            >복사</button>
                            <button
                              onClick={() => setAiResult('')}
                              className="text-[10px] text-white/60 hover:text-white transition-colors px-2 py-0.5 rounded-md hover:bg-white/20"
                            >닫기</button>
                          </div>
                        </div>
                        <div className="px-4 py-3 bg-gradient-to-b from-indigo-50 to-white max-h-[40vh] overflow-y-auto">
                          <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-gray-800 font-medium">{aiResult}</div>
                        </div>
                      </>
                    ) : (
                      <div className="whitespace-pre-wrap">{aiResult}</div>
                    )}
                  </div>
                )}

                {/* AI Space Picker */}
                {spacePickerMode && pendingAiEvents && (
                  <div className="mt-2 p-3 bg-gradient-to-b from-indigo-50 to-white rounded-xl border border-indigo-200 shadow-sm">
                    <p className="text-sm text-[#37352f] font-medium mb-3">일정 추가할 스페이스(팀or개인)를 선택해주세요.</p>
                    <div className="flex gap-2">
                      {userRootFolders.filter(f => f.type === 'team').length > 0 && (
                        <button
                          onClick={async () => {
                            const teamFolder = userRootFolders.find(f => f.type === 'team');
                            if (teamFolder && pendingAiEvents) {
                              for (const evt of pendingAiEvents) {
                                // eventType 자동 감지 (수기 입력과 동일 로직)
                                let autoEventType = detectEventType(evt.title || '');
                                for (const cat of categories) {
                                  if (!cat.keywords) continue;
                                  const kwList = cat.keywords.split(',').map((k: string) => k.trim()).filter(Boolean);
                                  if (kwList.some((kw: string) => (evt.title || '').includes(kw))) {
                                    autoEventType = cat.name;
                                    break;
                                  }
                                }
                                await fetch('/api/calendar/events', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ folderId: teamFolder.id, ...evt, eventType: autoEventType !== '일상' ? autoEventType : (evt.eventType || '일상') }),
                                });
                              }
                              setAiResult(`팀 스페이스 - ${pendingAiEvents.length}건 일정이 추가되었습니다.`);
                              setPendingAiEvents(null);
                              setSpacePickerMode(false);
                              await fetchEvents(true);
                            }
                          }}
                          className="flex-1 px-4 py-2.5 text-sm font-medium bg-[#7c3aed] text-white rounded-lg hover:bg-[#6d28d9] transition-colors"
                        >
                          팀 스페이스
                        </button>
                      )}
                      {userRootFolders.filter(f => f.type === 'personal').length > 0 && (
                        <button
                          onClick={async () => {
                            const personalFolder = userRootFolders.find(f => f.type === 'personal');
                            if (personalFolder && pendingAiEvents) {
                              for (const evt of pendingAiEvents) {
                                // eventType 자동 감지 (수기 입력과 동일 로직)
                                let autoEventType = detectEventType(evt.title || '');
                                for (const cat of categories) {
                                  if (!cat.keywords) continue;
                                  const kwList = cat.keywords.split(',').map((k: string) => k.trim()).filter(Boolean);
                                  if (kwList.some((kw: string) => (evt.title || '').includes(kw))) {
                                    autoEventType = cat.name;
                                    break;
                                  }
                                }
                                await fetch('/api/calendar/events', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ folderId: personalFolder.id, ...evt, eventType: autoEventType !== '일상' ? autoEventType : (evt.eventType || '일상') }),
                                });
                              }
                              setAiResult(`개인 스페이스 - ${pendingAiEvents.length}건 일정이 추가되었습니다.`);
                              setPendingAiEvents(null);
                              setSpacePickerMode(false);
                              await fetchEvents(true);
                            }
                          }}
                          className="flex-1 px-4 py-2.5 text-sm font-medium bg-[#2eaadc] text-white rounded-lg hover:bg-[#2696c4] transition-colors"
                        >
                          개인 스페이스
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CSS Animations */}
      <style jsx global>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes aiPulse {
          0%, 100% { box-shadow: 0 0 15px rgba(139, 92, 246, 0.3); }
          50% { box-shadow: 0 0 30px rgba(139, 92, 246, 0.6), 0 0 60px rgba(139, 92, 246, 0.2); }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px) scaleY(0.95); }
          to { opacity: 1; transform: translateY(0) scaleY(1); }
        }
        @keyframes aiBackdropIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes aiFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes aiPanelIn {
          0% { opacity: 0; transform: scale(0.85) translateY(20px); }
          60% { opacity: 1; transform: scale(1.02) translateY(-4px); }
          80% { transform: scale(0.99) translateY(1px); }
          100% { transform: scale(1) translateY(0); }
        }
        @keyframes aiHeaderShimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {/* Category picker popup for multiple keyword matches */}
      {categoryPickerOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)' }}
          onClick={() => { setCategoryPickerOpen(false); setPendingAddData(null); setCategoryPickerOptions([]); }}>
          <div style={{ background: 'white', borderRadius: 12, padding: '20px 24px', minWidth: 260, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#37352f' }}>컬러태그 선택</h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#787774' }}>여러 카테고리가 매칭되었습니다. 적용할 태그를 선택하세요.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {categoryPickerOptions.map(opt => (
                <button
                  key={opt.name}
                  onClick={() => handleCategoryPickerSelect(opt.name)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', borderRadius: 8,
                    border: '1px solid #e3e2e0', background: '#fafafa',
                    cursor: 'pointer', transition: 'background 0.15s',
                    fontSize: 14, fontWeight: 500, color: '#37352f',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f0f0f0')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#fafafa')}
                >
                  <span style={{
                    display: 'inline-block', width: 18, height: 18, borderRadius: 4,
                    backgroundColor: opt.colorBg, border: opt.colorBg === 'transparent' ? '1px solid #d1d1d1' : 'none',
                  }} />
                  <span>{opt.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
