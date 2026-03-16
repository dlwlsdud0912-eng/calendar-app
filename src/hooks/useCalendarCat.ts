import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

// SSR-safe useLayoutEffect
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

// ── Constants ──

const CAT_MESSAGES = [
  '오늘 하루도 반짝반짝 빛날 거야! ✨',
  '좋은 일이 슬금슬금 다가오고 있어!',
  '네가 웃으면 세상이 더 예뻐져!',
  '오늘의 행운은 이미 네 주머니 속에 있어!',
  '작은 것에서 행복을 찾는 오늘이 되길!',
  '오늘 마신 커피가 유독 맛있게 느껴질 거야 ☕',
  '네 미소가 오늘 하루를 완성시켜!',
  '괜찮아, 잘 되고 있어. 정말로!',
  '오늘은 뭔가 두근두근한 일이 생길 것 같아!',
  '하늘이 특히 예쁜 날, 행운도 예쁘게 내려와!',
  '천천히 해도 괜찮아, 네 페이스가 딱 맞아!',
  '오늘 먹는 밥이 세상에서 제일 맛있을 거야 🍚',
  '누군가 오늘 너를 생각하며 미소짓고 있어!',
  '네가 노력한 것들, 다 쌓이고 있어!',
  '오늘 뜻밖의 좋은 소식이 찾아올 거야!',
  '잠깐 쉬어도 돼, 충전하는 것도 실력이야!',
  '오늘 하늘 한번 쳐다봐, 기분이 달라질 거야!',
  '네 존재 자체가 오늘 하루의 선물이야 🎁',
  '작은 용기 하나가 오늘을 특별하게 만들어!',
  '오늘 우연히 마주친 것들, 다 인연이야!',
  '따뜻한 말 한마디가 오늘 네게 돌아올 거야!',
  '오늘 걷는 길이 꽃길이 될 준비 중이야 🌸',
  '힘들었던 만큼, 곧 환하게 피어날 거야!',
  '오늘 네가 한 선택, 분명 잘한 거야!',
  '좋아하는 노래 한 곡이 기분을 바꿔줄 거야 🎵',
  '오늘은 뭐든 잘 풀리는 날이야!',
  '네가 그냥 있는 것만으로도 주변이 따뜻해져!',
  '오늘의 나는 어제보다 한 뼘 더 성장했어!',
  '작은 행복들이 오늘 하루를 꽉 채울 거야!',
  '걱정은 내려놓고, 오늘은 그냥 흘러가 보자!',
  '네가 최선을 다하는 모습, 정말 멋있어!',
  '오늘 마음속에 따뜻한 바람이 불고 있어 🌬️',
  '늦어도 괜찮아, 네 타이밍이 딱 맞게 와!',
  '오늘 하루도 수고했어, 진심으로!',
  '별처럼 빛나는 순간이 오늘 찾아올 거야 ⭐',
  '네 꿈은 분명히 이루어지는 중이야!',
  '오늘 마주치는 사람들, 모두 좋은 인연이야!',
  '지금 이 순간도 충분히 아름다워!',
  '오늘 하루 수고한 나에게 작은 선물 하나 어때?',
  '내일은 더 좋은 일이 기다리고 있을 거야 🌈',
];

// ── Physics Constants ──

const PHYSICS = {
  WALK_ACCEL: 120,
  WALK_MAX_SPEED: 80,
  RUN_ACCEL: 200,
  RUN_MAX_SPEED: 150,
  FRICTION: 0.92,
  GRAVITY: 300,
  LAND_DAMPING: 0.3,
  CORNER_SPEED_MULT: 0.7,
};

// ── Types ──

export type CatState =
  | 'idle_sit'
  | 'idle_loaf'
  | 'walk'
  | 'groom'
  | 'pet_react'
  | 'startled_run'
  | 'scruff_drag'
  | 'drop_land'
  | 'bubble_show';

interface Vec2 {
  x: number;
  y: number;
}

interface SurfaceEdge {
  id: string;
  start: Vec2;
  end: Vec2;
  normal: Vec2;
  neighbors: string[];
}

interface CatPhysicsState {
  position: Vec2;
  velocity: Vec2;
  acceleration: Vec2;
  facing: 'left' | 'right';
  contactSurfaceId: string | null;
  contactPoint: number;
  targetSurfacePath: SurfaceEdge[];
  targetEdgeId: string | null;
  targetContactPoint: number;
}

export interface UseCalendarCatReturn {
  registerCell: (weekIdx: number, dayIdx: number, element: HTMLElement | null) => void;
  setContainerRef: (el: HTMLElement | null) => void;
  catPixelPos: { x: number; y: number };
  catState: CatState;
  catDirection: 'left' | 'right';
  bubble: string | null;
  showHeart: boolean;
  handleCatClick: (e: React.MouseEvent) => void;
  handleDragStart: (e: React.MouseEvent | React.TouchEvent) => void;
  reducedMotion: boolean;
}

// ── Vector helpers ──

function vecSub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

function vecAdd(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

function vecScale(v: Vec2, s: number): Vec2 {
  return { x: v.x * s, y: v.y * s };
}

function vecLen(v: Vec2): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

function vecNormalize(v: Vec2): Vec2 {
  const len = vecLen(v);
  if (len < 0.0001) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

function vecDot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

// ── Surface Graph ──

function edgeLength(edge: SurfaceEdge): number {
  return vecLen(vecSub(edge.end, edge.start));
}

function pointOnEdge(edge: SurfaceEdge, t: number): Vec2 {
  const clamped = clamp(t, 0, 1);
  return {
    x: edge.start.x + (edge.end.x - edge.start.x) * clamped,
    y: edge.start.y + (edge.end.y - edge.start.y) * clamped,
  };
}

function edgeTangent(edge: SurfaceEdge): Vec2 {
  return vecNormalize(vecSub(edge.end, edge.start));
}

/**
 * Build the surface graph from registered cells.
 * Every cell keeps all 4 edges (no shared-edge merging).
 * Edge IDs are predictable: `${row}-${col}-${side}`.
 * Neighbor connections are built via shared corner points.
 */
function buildSurfaceGraph(
  cellMap: Map<string, HTMLElement>,
  containerRect: DOMRect,
): Map<string, SurfaceEdge> {
  const graph = new Map<string, SurfaceEdge>();
  const cornerMap = new Map<string, string[]>();

  const roundKey = (x: number, y: number) =>
    `${Math.round(x)},${Math.round(y)}`;

  const addCorner = (cornerKey: string, edgeId: string) => {
    const list = cornerMap.get(cornerKey);
    if (list) {
      list.push(edgeId);
    } else {
      cornerMap.set(cornerKey, [edgeId]);
    }
  };

  // No merging -- every cell gets all 4 edges
  cellMap.forEach((el, key) => {
    const rect = el.getBoundingClientRect();
    const left = rect.left - containerRect.left;
    const top = rect.top - containerRect.top;
    const right = left + rect.width;
    const bottom = top + rect.height;

    const sides: { side: string; start: Vec2; end: Vec2; normal: Vec2 }[] = [
      {
        side: 'top',
        start: { x: left, y: top },
        end: { x: right, y: top },
        normal: { x: 0, y: -1 },
      },
      {
        side: 'right',
        start: { x: right, y: top },
        end: { x: right, y: bottom },
        normal: { x: 1, y: 0 },
      },
      {
        side: 'bottom',
        start: { x: left, y: bottom },
        end: { x: right, y: bottom },
        normal: { x: 0, y: 1 },
      },
      {
        side: 'left',
        start: { x: left, y: top },
        end: { x: left, y: bottom },
        normal: { x: -1, y: 0 },
      },
    ];

    for (const s of sides) {
      const edgeId = `${key}-${s.side}`;

      graph.set(edgeId, {
        id: edgeId,
        start: s.start,
        end: s.end,
        normal: s.normal,
        neighbors: [],
      });

      addCorner(roundKey(s.start.x, s.start.y), edgeId);
      addCorner(roundKey(s.end.x, s.end.y), edgeId);
    }
  });

  // Build neighbor links via shared corners
  cornerMap.forEach((edgeIds) => {
    for (let i = 0; i < edgeIds.length; i++) {
      for (let j = i + 1; j < edgeIds.length; j++) {
        const a = graph.get(edgeIds[i]);
        const b = graph.get(edgeIds[j]);
        if (a && b) {
          if (!a.neighbors.includes(b.id)) a.neighbors.push(b.id);
          if (!b.neighbors.includes(a.id)) b.neighbors.push(a.id);
        }
      }
    }
  });

  return graph;
}

// ── BFS Path Finding ──

function findSurfacePath(
  graph: Map<string, SurfaceEdge>,
  fromEdgeId: string,
  toEdgeId: string,
): SurfaceEdge[] {
  if (fromEdgeId === toEdgeId) {
    const edge = graph.get(fromEdgeId);
    return edge ? [edge] : [];
  }

  const visited = new Set<string>();
  const parent = new Map<string, string>();
  const queue: string[] = [fromEdgeId];
  visited.add(fromEdgeId);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const edge = graph.get(current);
    if (!edge) continue;

    for (const nId of edge.neighbors) {
      if (visited.has(nId)) continue;
      visited.add(nId);
      parent.set(nId, current);

      if (nId === toEdgeId) {
        // Reconstruct path
        const path: SurfaceEdge[] = [];
        let cur: string | undefined = nId;
        while (cur !== undefined) {
          const e = graph.get(cur);
          if (e) path.unshift(e);
          cur = parent.get(cur);
        }
        return path;
      }

      queue.push(nId);
    }
  }

  // No path found - return just the from edge
  const fromEdge = graph.get(fromEdgeId);
  return fromEdge ? [fromEdge] : [];
}

// ── Surface Projection ──

function projectToNearestSurface(
  point: Vec2,
  graph: Map<string, SurfaceEdge>,
  horizontalOnly?: boolean,
  belowY?: number,
): { edgeId: string; contactPoint: number; projectedPos: Vec2 } | null {
  let bestDist = Infinity;
  let bestEdgeId = '';
  let bestT = 0;
  let bestPos: Vec2 = { x: 0, y: 0 };

  graph.forEach((edge) => {
    // horizontalOnly: top/bottom edge만 (normal.y !== 0인 edge)
    if (horizontalOnly) {
      if (Math.abs(edge.normal.y) < 0.5) return; // left/right edge 스킵
    }

    // belowY: 이 Y값 이상(아래)에 있는 edge만 고려
    if (belowY !== undefined) {
      const edgeMidY = (edge.start.y + edge.end.y) / 2;
      if (edgeMidY < belowY - 5) return; // 고양이보다 위에 있는 edge 스킵
    }

    const ab = vecSub(edge.end, edge.start);
    const ap = vecSub(point, edge.start);
    const len2 = vecDot(ab, ab);
    if (len2 < 0.0001) return;

    const t = clamp(vecDot(ap, ab) / len2, 0, 1);
    const proj = pointOnEdge(edge, t);
    const dist = vecLen(vecSub(point, proj));

    if (dist < bestDist) {
      bestDist = dist;
      bestEdgeId = edge.id;
      bestT = t;
      bestPos = proj;
    }
  });

  if (!bestEdgeId) return null;
  return { edgeId: bestEdgeId, contactPoint: bestT, projectedPos: bestPos };
}

// ── Hook ──

export function useCalendarCat(totalWeeks: number, currentYear: number, currentMonth: number): UseCalendarCatReturn {
  // --- Cell registry ---
  const cellMapRef = useRef<Map<string, HTMLElement>>(new Map());
  const containerRef = useRef<HTMLElement | null>(null);

  // --- Surface graph ---
  const surfaceGraphRef = useRef<Map<string, SurfaceEdge>>(new Map());

  // --- Physics state ---
  const physicsRef = useRef<CatPhysicsState>({
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    acceleration: { x: 0, y: 0 },
    facing: 'right',
    contactSurfaceId: null,
    contactPoint: 0.5,
    targetSurfacePath: [],
    targetEdgeId: null,
    targetContactPoint: 0.5,
  });

  // --- React state for rendering ---
  const [pixelPos, setPixelPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [catState, setCatState] = useState<CatState>('idle_sit');
  const catStateRef = useRef<CatState>('idle_sit');
  const [catDirection, setCatDirection] = useState<'left' | 'right'>('right');
  const catDirectionRef = useRef<'left' | 'right'>('right');
  const [bubble, setBubble] = useState<string | null>(null);
  const [showHeart, setShowHeart] = useState(false);
  const [reducedMotionState, setReducedMotionState] = useState(false);

  // --- Animation refs ---
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const stateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef<Vec2>({ x: 0, y: 0 });
  const dragMoveRef = useRef<((ev: MouseEvent | TouchEvent) => void) | null>(null);
  const dragEndRef = useRef<(() => void) | null>(null);
  const initializedRef = useRef(false);
  const reducedMotionRef = useRef(false);
  const scheduleIdleActionRef = useRef<() => void>(() => {});

  // --- Drop physics state ---
  const isDropFallingRef = useRef(false);
  const dropVelocityRef = useRef<Vec2>({ x: 0, y: 0 });

  // --- Reduced motion ---
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotionRef.current = mq.matches;
    setReducedMotionState(mq.matches);
    const handler = (e: MediaQueryListEvent) => {
      reducedMotionRef.current = e.matches;
      setReducedMotionState(e.matches);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // --- Helpers ---

  const setStateAndRef = useCallback((s: CatState) => {
    catStateRef.current = s;
    setCatState(s);
  }, []);

  const setDirectionAndRef = useCallback((d: 'left' | 'right') => {
    catDirectionRef.current = d;
    setCatDirection(d);
  }, []);

  const getContainerRect = useCallback((): DOMRect | null => {
    if (!containerRef.current) return null;
    return containerRef.current.getBoundingClientRect();
  }, []);

  const rebuildSurfaceGraph = useCallback(() => {
    const contRect = getContainerRect();
    if (!contRect || cellMapRef.current.size === 0) return;
    surfaceGraphRef.current = buildSurfaceGraph(cellMapRef.current, contRect);
  }, [getContainerRect]);

  /** Place cat on a specific edge + contact point, instantly */
  const placeCatOnSurface = useCallback((edgeId: string, contactPoint: number) => {
    const graph = surfaceGraphRef.current;
    const edge = graph.get(edgeId);
    if (!edge) return;

    const pos = pointOnEdge(edge, contactPoint);
    const ph = physicsRef.current;
    ph.position = pos;
    ph.velocity = { x: 0, y: 0 };
    ph.acceleration = { x: 0, y: 0 };
    ph.contactSurfaceId = edgeId;
    ph.contactPoint = contactPoint;
    ph.targetSurfacePath = [];
    ph.targetEdgeId = null;
    ph.targetContactPoint = 0.5;
    setPixelPos({ x: pos.x, y: pos.y });
  }, []);

  /** Find the bottom edge of a cell -- always predictable ID now */
  const getCellBottomEdgeId = useCallback((row: number, col: number): string | null => {
    const graph = surfaceGraphRef.current;
    const id = `${row}-${col}-bottom`;
    if (graph.has(id)) return id;
    // No fallback needed since we no longer merge edges,
    // but keep a safety fallback via projection just in case
    const el = cellMapRef.current.get(`${row}-${col}`);
    const contRect = getContainerRect();
    if (!el || !contRect) return null;

    const rect = el.getBoundingClientRect();
    const bottomCenter: Vec2 = {
      x: rect.left - contRect.left + rect.width / 2,
      y: rect.top - contRect.top + rect.height,
    };

    const proj = projectToNearestSurface(bottomCenter, graph);
    return proj ? proj.edgeId : null;
  }, [getContainerRect]);

  /** Set a movement target on the surface graph */
  const setMovementTarget = useCallback((targetEdgeId: string, targetContactPoint: number) => {
    const ph = physicsRef.current;
    const graph = surfaceGraphRef.current;

    if (!ph.contactSurfaceId) return;

    const path = findSurfacePath(graph, ph.contactSurfaceId, targetEdgeId);
    ph.targetSurfacePath = path;
    ph.targetEdgeId = targetEdgeId;
    ph.targetContactPoint = targetContactPoint;

    // Determine direction based on target position
    const targetEdge = graph.get(targetEdgeId);
    if (targetEdge) {
      const targetPos = pointOnEdge(targetEdge, targetContactPoint);
      const dx = targetPos.x - ph.position.x;
      const dy = targetPos.y - ph.position.y;
      // 수평 이동이 주된 경우만 방향 전환
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 2) {
          setDirectionAndRef('right');
          ph.facing = 'right';
        } else if (dx < -2) {
          setDirectionAndRef('left');
          ph.facing = 'left';
        }
      } else {
        // 수직 이동 시 목표가 오른쪽이면 오른쪽을 봄
        if (dx >= 0) {
          setDirectionAndRef('right');
          ph.facing = 'right';
        } else {
          setDirectionAndRef('left');
          ph.facing = 'left';
        }
      }
    }
  }, [setDirectionAndRef]);

  /** Move cat to a cell's bottom surface */
  const moveToCell = useCallback((row: number, col: number, instant?: boolean) => {
    rebuildSurfaceGraph();
    const edgeId = getCellBottomEdgeId(row, col);
    if (!edgeId) return;

    const contactT = 0.2 + Math.random() * 0.6; // edge 위 랜덤 지점

    if (instant || reducedMotionRef.current) {
      placeCatOnSurface(edgeId, contactT);
    } else {
      setMovementTarget(edgeId, contactT);
    }
  }, [rebuildSurfaceGraph, getCellBottomEdgeId, placeCatOnSurface, setMovementTarget]);

  // --- Clear all timers ---
  const clearAllTimers = useCallback(() => {
    if (stateTimerRef.current) { clearTimeout(stateTimerRef.current); stateTimerRef.current = null; }
    if (idleTimerRef.current) { clearTimeout(idleTimerRef.current); idleTimerRef.current = null; }
    if (bubbleTimerRef.current) { clearTimeout(bubbleTimerRef.current); bubbleTimerRef.current = null; }
    if (heartTimerRef.current) { clearTimeout(heartTimerRef.current); heartTimerRef.current = null; }
  }, []);

  // --- Pick random cells ---
  const pickAdjacentCell = useCallback((fromRow: number, fromCol: number): { row: number; col: number } => {
    const directions = [
      { dr: 0, dc: 1 }, { dr: 0, dc: -1 },
      { dr: 1, dc: 0 }, { dr: -1, dc: 0 },
      { dr: 0, dc: 2 }, { dr: 0, dc: -2 },
      { dr: 1, dc: 1 }, { dr: -1, dc: -1 },
      { dr: 1, dc: -1 }, { dr: -1, dc: 1 },
      { dr: 2, dc: 0 }, { dr: -2, dc: 0 },
      { dr: 1, dc: 2 }, { dr: -1, dc: 2 },
      { dr: 2, dc: 1 }, { dr: 2, dc: -1 },
    ];
    const shuffled = directions.sort(() => Math.random() - 0.5);
    for (const d of shuffled) {
      const nr = fromRow + d.dr;
      const nc = fromCol + d.dc;
      if (nr >= 0 && nr < totalWeeks && nc >= 0 && nc < 7) {
        if (cellMapRef.current.has(`${nr}-${nc}`)) {
          return { row: nr, col: nc };
        }
      }
    }
    return { row: fromRow, col: fromCol };
  }, [totalWeeks]);

  const pickFarCell = useCallback((fromRow: number, fromCol: number): { row: number; col: number } => {
    let bestRow = 0;
    let bestCol = 0;
    let bestDist = -1;
    for (let attempt = 0; attempt < 5; attempt++) {
      const r = Math.floor(Math.random() * totalWeeks);
      const c = Math.floor(Math.random() * 7);
      const dist = Math.abs(r - fromRow) + Math.abs(c - fromCol);
      if (dist > bestDist && cellMapRef.current.has(`${r}-${c}`)) {
        bestRow = r;
        bestCol = c;
        bestDist = dist;
      }
    }
    return { row: bestRow, col: bestCol };
  }, [totalWeeks]);

  /** Guess which cell the cat is currently on from the contact surface id */
  const getCurrentCell = useCallback((): { row: number; col: number } => {
    const surfId = physicsRef.current.contactSurfaceId;
    if (surfId) {
      const parts = surfId.split('-');
      if (parts.length >= 2) {
        const r = parseInt(parts[0], 10);
        const c = parseInt(parts[1], 10);
        if (!isNaN(r) && !isNaN(c)) return { row: r, col: c };
      }
    }
    return { row: 0, col: 0 };
  }, []);

  // --- Schedule next idle action ---
  const scheduleIdleAction = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    // 3-8 second delay for faster feedback
    const baseDelay = reducedMotionRef.current ? 30000 : (300 + Math.random() * 700);
    idleTimerRef.current = setTimeout(() => {
      const current = catStateRef.current;
      // More permissive state check: also allow bubble_show
      if (
        current !== 'idle_sit' &&
        current !== 'idle_loaf' &&
        current !== 'groom' &&
        current !== 'bubble_show'
      ) return;

      const { row, col } = getCurrentCell();
      const roll = Math.random();

      if (roll < 0.85) {
        // Walk to adjacent cell (85%)
        const target = pickAdjacentCell(row, col);
        setStateAndRef('walk');
        setBubble(null);
        moveToCell(target.row, target.col);
      } else if (roll < 0.90) {
        // Loaf (5%)
        setStateAndRef('idle_loaf');
        stateTimerRef.current = setTimeout(() => {
          setStateAndRef('idle_sit');
          scheduleIdleActionRef.current();
        }, 2000 + Math.random() * 2000);
      } else if (roll < 0.95) {
        // Groom (5%)
        setStateAndRef('groom');
        stateTimerRef.current = setTimeout(() => {
          setStateAndRef('idle_sit');
          scheduleIdleActionRef.current();
        }, 1500 + Math.random() * 1500);
      } else {
        // 자동 응원메시지 (5%)
        const msg = CAT_MESSAGES[Math.floor(Math.random() * CAT_MESSAGES.length)];
        setBubble(msg);
        setStateAndRef('bubble_show');
        if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
        bubbleTimerRef.current = setTimeout(() => {
          setBubble(null);
          setStateAndRef('idle_sit');
          scheduleIdleActionRef.current();
        }, 4000);
      }
    }, baseDelay);
  }, [getCurrentCell, pickAdjacentCell, moveToCell, setStateAndRef]);

  // Keep ref in sync with latest scheduleIdleAction
  scheduleIdleActionRef.current = scheduleIdleAction;

  // --- Physics animation loop ---
  useEffect(() => {
    const animate = (timestamp: number) => {
      if (lastTimeRef.current === 0) lastTimeRef.current = timestamp;
      const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = timestamp;

      const ph = physicsRef.current;
      const state = catStateRef.current;
      const graph = surfaceGraphRef.current;

      // --- Drop/fall physics ---
      if (isDropFallingRef.current && state === 'drop_land') {
        const dv = dropVelocityRef.current;
        dv.y += PHYSICS.GRAVITY * dt;
        ph.position.x += dv.x * dt;
        ph.position.y += dv.y * dt;
        dv.x *= Math.pow(PHYSICS.FRICTION, dt * 60);

        // 컨테이너 경계 클램핑 - 고양이가 화면 밖으로 사라지지 않도록
        const contRectAnim = containerRef.current?.getBoundingClientRect();
        if (contRectAnim) {
          const maxW = contRectAnim.width;
          const maxH = contRectAnim.height;
          ph.position.x = clamp(ph.position.x, 0, maxW);
          ph.position.y = clamp(ph.position.y, 0, maxH);
          // 바닥이나 벽에 닿으면 즉시 가까운 표면으로 스냅
          if (ph.position.y >= maxH - 2 || ph.position.x <= 2 || ph.position.x >= maxW - 2) {
            if (graph.size > 0) {
              const snapProj = projectToNearestSurface(ph.position, graph, true);
              if (snapProj) {
                isDropFallingRef.current = false;
                dv.x = 0;
                dv.y = 0;
                ph.position = snapProj.projectedPos;
                ph.contactSurfaceId = snapProj.edgeId;
                ph.contactPoint = snapProj.contactPoint;
                ph.velocity = { x: 0, y: 0 };
                setPixelPos({ x: snapProj.projectedPos.x, y: snapProj.projectedPos.y });
                if (stateTimerRef.current) { clearTimeout(stateTimerRef.current); stateTimerRef.current = null; }
                stateTimerRef.current = setTimeout(() => {
                  setStateAndRef('idle_sit');
                  scheduleIdleActionRef.current();
                }, 300);
                rafRef.current = requestAnimationFrame(animate);
                return;
              }
            }
          }
        }

        // Check if we've hit a surface
        if (graph.size > 0) {
          let proj = projectToNearestSurface(ph.position, graph, true, ph.position.y - 10);
          if (!proj) {
            // belowY 필터로 표면을 찾지 못하면 필터 없이 재시도 (fallback)
            proj = projectToNearestSurface(ph.position, graph, true);
          }
          if (proj) {
            const edge = graph.get(proj.edgeId);
            if (edge) {
              const distToSurface = vecLen(vecSub(ph.position, proj.projectedPos));
              // Check if we've crossed or are very close to the surface
              if (distToSurface < 8 || ph.position.y >= proj.projectedPos.y - 2) {
                // Land on surface
                if (!reducedMotionRef.current) {
                  // Bounce
                  dv.y *= -PHYSICS.LAND_DAMPING;
                  if (Math.abs(dv.y) < 5) {
                    // Stop bouncing
                    isDropFallingRef.current = false;
                    dv.x = 0;
                    dv.y = 0;
                    ph.position = proj.projectedPos;
                    ph.contactSurfaceId = proj.edgeId;
                    ph.contactPoint = proj.contactPoint;
                    ph.velocity = { x: 0, y: 0 };
                  }
                } else {
                  // Instant land for reduced motion
                  isDropFallingRef.current = false;
                  dv.x = 0;
                  dv.y = 0;
                  ph.position = proj.projectedPos;
                  ph.contactSurfaceId = proj.edgeId;
                  ph.contactPoint = proj.contactPoint;
                  ph.velocity = { x: 0, y: 0 };
                }
              }
            }
          }
        }

        setPixelPos({ x: ph.position.x, y: ph.position.y });
        rafRef.current = requestAnimationFrame(animate);
        return;
      }

      // --- Surface-following movement physics ---
      if (!isDraggingRef.current && (state === 'walk' || state === 'startled_run')) {
        const isRunning = state === 'startled_run';
        const maxSpeed = isRunning ? PHYSICS.RUN_MAX_SPEED : PHYSICS.WALK_MAX_SPEED;
        const accel = isRunning ? PHYSICS.RUN_ACCEL : PHYSICS.WALK_ACCEL;
        const effectiveMaxSpeed = reducedMotionRef.current ? maxSpeed * 0.3 : maxSpeed;

        if (ph.targetEdgeId && ph.contactSurfaceId && graph.size > 0) {
          const currentEdge = graph.get(ph.contactSurfaceId);

          if (currentEdge) {
            // Are we on the target edge?
            if (ph.contactSurfaceId === ph.targetEdgeId) {
              // Move along this edge toward target contact point
              const diff = ph.targetContactPoint - ph.contactPoint;
              const eLen = edgeLength(currentEdge);

              if (Math.abs(diff * eLen) < 1.5) {
                // Arrived -- stop completely
                ph.contactPoint = ph.targetContactPoint;
                ph.position = pointOnEdge(currentEdge, ph.contactPoint);
                ph.velocity = { x: 0, y: 0 };
                ph.targetEdgeId = null;
                ph.targetSurfacePath = [];

                // Transition to idle
                setStateAndRef('idle_sit');
                scheduleIdleActionRef.current();
              } else {
                // Accelerate along edge toward target point
                const dir = diff > 0 ? 1 : -1;
                const tangent = edgeTangent(currentEdge);
                const moveDir = vecScale(tangent, dir);

                // Apply acceleration
                const speed = vecLen(ph.velocity);
                if (speed < effectiveMaxSpeed) {
                  ph.velocity = vecAdd(ph.velocity, vecScale(moveDir, accel * dt));
                }
                // Clamp speed
                const newSpeed = vecLen(ph.velocity);
                if (newSpeed > effectiveMaxSpeed) {
                  ph.velocity = vecScale(vecNormalize(ph.velocity), effectiveMaxSpeed);
                }
                // Apply friction
                ph.velocity = vecScale(ph.velocity, Math.pow(PHYSICS.FRICTION, dt * 60));

                // Move along edge
                const travel = vecDot(ph.velocity, tangent) * dt;
                const travelT = eLen > 0 ? travel / eLen : 0;
                ph.contactPoint += travelT;
                ph.contactPoint = clamp(ph.contactPoint, 0, 1);
                ph.position = pointOnEdge(currentEdge, ph.contactPoint);

                // Update facing direction
                if (moveDir.x > 0.1) {
                  ph.facing = 'right';
                  setDirectionAndRef('right');
                } else if (moveDir.x < -0.1) {
                  ph.facing = 'left';
                  setDirectionAndRef('left');
                }
              }
            } else {
              // Not on target edge yet -- walk along path
              const pathIdx = ph.targetSurfacePath.findIndex(e => e.id === ph.contactSurfaceId);
              const nextEdge = pathIdx >= 0 && pathIdx < ph.targetSurfacePath.length - 1
                ? ph.targetSurfacePath[pathIdx + 1]
                : null;

              if (nextEdge) {
                // Find which end of current edge connects to next edge
                const currentEnd = currentEdge.end;
                const currentStart = currentEdge.start;
                const nextStart = nextEdge.start;
                const nextEnd = nextEdge.end;

                // Check which corner connects them
                const endToNextStart = vecLen(vecSub(currentEnd, nextStart));
                const endToNextEnd = vecLen(vecSub(currentEnd, nextEnd));
                const startToNextStart = vecLen(vecSub(currentStart, nextStart));
                const startToNextEnd = vecLen(vecSub(currentStart, nextEnd));

                const minDist = Math.min(endToNextStart, endToNextEnd, startToNextStart, startToNextEnd);
                const walkTowardT = (minDist === endToNextStart || minDist === endToNextEnd) ? 1 : 0;

                const diff = walkTowardT - ph.contactPoint;
                const eLen = edgeLength(currentEdge);

                // Edge endpoint arrival: 3px tolerance (was 2px)
                if (Math.abs(diff * eLen) < 3) {
                  // Reached edge boundary -> transition to next edge
                  // Reduce speed but don't zero it
                  ph.velocity = vecScale(ph.velocity, PHYSICS.CORNER_SPEED_MULT);
                  ph.contactSurfaceId = nextEdge.id;
                  // Determine starting contact point on next edge (from which end we enter)
                  if (minDist === endToNextStart || minDist === startToNextStart) {
                    ph.contactPoint = 0;
                  } else {
                    ph.contactPoint = 1;
                  }
                  ph.position = pointOnEdge(nextEdge, ph.contactPoint);
                } else {
                  // Walk along current edge toward the connecting corner
                  const dir = diff > 0 ? 1 : -1;
                  const tangent = edgeTangent(currentEdge);
                  const moveDir = vecScale(tangent, dir);

                  const speed = vecLen(ph.velocity);
                  if (speed < effectiveMaxSpeed) {
                    ph.velocity = vecAdd(ph.velocity, vecScale(moveDir, accel * dt));
                  }
                  const newSpeed = vecLen(ph.velocity);
                  if (newSpeed > effectiveMaxSpeed) {
                    ph.velocity = vecScale(vecNormalize(ph.velocity), effectiveMaxSpeed);
                  }
                  ph.velocity = vecScale(ph.velocity, Math.pow(PHYSICS.FRICTION, dt * 60));

                  const travel = vecDot(ph.velocity, tangent) * dt;
                  const travelT = eLen > 0 ? travel / eLen : 0;
                  ph.contactPoint += travelT;
                  ph.contactPoint = clamp(ph.contactPoint, 0, 1);
                  ph.position = pointOnEdge(currentEdge, ph.contactPoint);

                  if (moveDir.x > 0.1) {
                    ph.facing = 'right';
                    setDirectionAndRef('right');
                  } else if (moveDir.x < -0.1) {
                    ph.facing = 'left';
                    setDirectionAndRef('left');
                  }
                }
              } else {
                // No next edge in path -- rebuild path or arrive
                if (ph.targetEdgeId) {
                  const newPath = findSurfacePath(graph, ph.contactSurfaceId, ph.targetEdgeId);
                  ph.targetSurfacePath = newPath;
                  if (newPath.length <= 1) {
                    // Can't reach -- just idle
                    ph.velocity = { x: 0, y: 0 };
                    ph.targetEdgeId = null;
                    ph.targetSurfacePath = [];
                    setStateAndRef('idle_sit');
                    scheduleIdleActionRef.current();
                  }
                }
              }
            }
          }
        } else if (!ph.targetEdgeId) {
          // No target - we've arrived, decelerate
          ph.velocity = vecScale(ph.velocity, Math.pow(PHYSICS.FRICTION, dt * 60));
          if (vecLen(ph.velocity) < 0.5) {
            ph.velocity = { x: 0, y: 0 };
          }
        }

        setPixelPos({ x: ph.position.x, y: ph.position.y });
      }

      // Safety: 드래그 중이 아닌데 contactSurfaceId가 null이면 가장 가까운 bottom edge로 복구
      if (!isDraggingRef.current && !isDropFallingRef.current && !ph.contactSurfaceId && graph.size > 0) {
        const proj = projectToNearestSurface(ph.position, graph, true);
        if (proj) {
          ph.contactSurfaceId = proj.edgeId;
          ph.contactPoint = proj.contactPoint;
          ph.position = proj.projectedPos;
          setPixelPos({ x: proj.projectedPos.x, y: proj.projectedPos.y });
          if (catStateRef.current !== 'idle_sit') {
            setStateAndRef('idle_sit');
            scheduleIdleActionRef.current();
          }
        }
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Cell registration (auto-initialize when enough cells arrive) ---
  const tryInitFromCells = useCallback(() => {
    if (initializedRef.current) return;
    if (cellMapRef.current.size < 7 || !containerRef.current) return; // need at least 1 week

    rebuildSurfaceGraph();
    // Pick a random cell to start
    const keys = Array.from(cellMapRef.current.keys());
    const randomKey = keys[Math.floor(Math.random() * keys.length)];
    const parts = randomKey.split('-');
    const row = parseInt(parts[0], 10);
    const col = parseInt(parts[1], 10);
    const edgeId = getCellBottomEdgeId(row, col);
    if (edgeId) {
      placeCatOnSurface(edgeId, 0.5);
      initializedRef.current = true;
      setStateAndRef('idle_sit');
      // Kick off idle action loop
      scheduleIdleActionRef.current();
    }
  }, [rebuildSurfaceGraph, getCellBottomEdgeId, placeCatOnSurface, setStateAndRef]);

  const registerCell = useCallback((weekIdx: number, dayIdx: number, element: HTMLElement | null) => {
    const key = `${weekIdx}-${dayIdx}`;
    if (element) {
      cellMapRef.current.set(key, element);
      // Auto-initialize once we have enough cells
      if (!initializedRef.current && cellMapRef.current.size >= 7) {
        // 2번 rAF 체이닝으로 레이아웃 완료 후 측정
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            tryInitFromCells();
          });
        });
      }
    } else {
      cellMapRef.current.delete(key);
    }
  }, [tryInitFromCells]);

  const setContainerRef = useCallback((el: HTMLElement | null) => {
    containerRef.current = el;
  }, []);

  // --- Initialize position on first cell registration / month change ---
  useEffect(() => {
    initializedRef.current = false;
    // 월 변경 시 기존 그래프와 타이머 초기화
    if (idleTimerRef.current) { clearTimeout(idleTimerRef.current); idleTimerRef.current = null; }
    if (stateTimerRef.current) { clearTimeout(stateTimerRef.current); stateTimerRef.current = null; }
    surfaceGraphRef.current = new Map();
    physicsRef.current.contactSurfaceId = null;
    physicsRef.current.targetEdgeId = null;
    physicsRef.current.targetSurfacePath = [];
    physicsRef.current.velocity = { x: 0, y: 0 };
  }, [currentYear, currentMonth]);

  // Use useLayoutEffect for initial measurement to prevent flicker
  useIsomorphicLayoutEffect(() => {
    if (initializedRef.current) return;

    const tryInit = () => {
      if (cellMapRef.current.size > 0 && containerRef.current) {
        rebuildSurfaceGraph();

        const firstKey = cellMapRef.current.keys().next().value;
        if (firstKey) {
          const parts = (firstKey as string).split('-');
          const row = parseInt(parts[0], 10);
          const col = parseInt(parts[1], 10);
          const edgeId = getCellBottomEdgeId(row, col);
          if (edgeId) {
            placeCatOnSurface(edgeId, 0.5);
            initializedRef.current = true;
            setStateAndRef('idle_sit');
            scheduleIdleActionRef.current();
          }
        }
      }
    };

    // rAF 체이닝으로 DOM 레이아웃 완료 보장
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        tryInit();
      });
    });
    const t1 = setTimeout(tryInit, 200);
    const t2 = setTimeout(tryInit, 500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [currentYear, currentMonth, rebuildSurfaceGraph, getCellBottomEdgeId, placeCatOnSurface, setStateAndRef]);

  // --- ResizeObserver: recalculate surface graph ---
  useEffect(() => {
    const recalculate = () => {
      rebuildSurfaceGraph();
      const graph = surfaceGraphRef.current;
      const ph = physicsRef.current;

      // Re-project cat onto nearest surface
      if (graph.size > 0) {
        const proj = projectToNearestSurface(ph.position, graph, true);
        if (proj) {
          ph.contactSurfaceId = proj.edgeId;
          ph.contactPoint = proj.contactPoint;
          ph.position = proj.projectedPos;
          setPixelPos({ x: proj.projectedPos.x, y: proj.projectedPos.y });
        }
      }
    };

    const observer = new ResizeObserver(recalculate);
    if (containerRef.current) observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [rebuildSurfaceGraph]);

  // --- Click handler ---
  const handleCatClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDraggingRef.current) return;

    if (stateTimerRef.current) { clearTimeout(stateTimerRef.current); stateTimerRef.current = null; }
    if (idleTimerRef.current) { clearTimeout(idleTimerRef.current); idleTimerRef.current = null; }

    const { row, col } = getCurrentCell();

    if (Math.random() < 0.2) {
      // Pet reaction
      setStateAndRef('pet_react');
      setShowHeart(true);
      if (heartTimerRef.current) clearTimeout(heartTimerRef.current);
      heartTimerRef.current = setTimeout(() => setShowHeart(false), 1000);

      setBubble(prev => {
        if (prev) return null;
        return CAT_MESSAGES[Math.floor(Math.random() * CAT_MESSAGES.length)];
      });

      stateTimerRef.current = setTimeout(() => {
        setStateAndRef('idle_sit');
        scheduleIdleActionRef.current();
      }, 1500);
    } else {
      // Startled run
      setBubble(null);
      const target = pickFarCell(row, col);
      setStateAndRef('startled_run');
      moveToCell(target.row, target.col);

      // Auto-transition to idle after a timeout in case physics doesn't resolve
      stateTimerRef.current = setTimeout(() => {
        if (catStateRef.current === 'startled_run') {
          physicsRef.current.velocity = { x: 0, y: 0 };
          physicsRef.current.targetEdgeId = null;
          physicsRef.current.targetSurfacePath = [];
          setStateAndRef('idle_sit');
          scheduleIdleActionRef.current();
        }
      }, 3000);
    }
  }, [getCurrentCell, setStateAndRef, pickFarCell, moveToCell]);

  // --- Drag handlers ---
  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    // e.preventDefault() 제거 → click 이벤트 허용

    const ph = physicsRef.current;
    const contRect = getContainerRect();
    if (!contRect) return;

    let clientX: number, clientY: number;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const startX = clientX;
    const startY = clientY;
    let hasDragStarted = false;
    const DRAG_THRESHOLD = 5; // 5px 이상 이동해야 드래그

    let lastMoveX = clientX;
    let lastMoveY = clientY;
    let lastMoveTime = performance.now();

    const handleMove = (ev: MouseEvent | TouchEvent) => {
      let cx: number, cy: number;
      if ('touches' in ev) {
        cx = (ev as TouchEvent).touches[0].clientX;
        cy = (ev as TouchEvent).touches[0].clientY;
      } else {
        cx = (ev as MouseEvent).clientX;
        cy = (ev as MouseEvent).clientY;
      }

      // 임계값 체크
      if (!hasDragStarted) {
        const dx = cx - startX;
        const dy = cy - startY;
        if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return;

        // 드래그 시작!
        hasDragStarted = true;
        isDraggingRef.current = true;
        isDropFallingRef.current = false;
        if (stateTimerRef.current) { clearTimeout(stateTimerRef.current); stateTimerRef.current = null; }
        if (idleTimerRef.current) { clearTimeout(idleTimerRef.current); idleTimerRef.current = null; }
        setBubble(null);
        setStateAndRef('scruff_drag');
        ph.velocity = { x: 0, y: 0 };
        ph.acceleration = { x: 0, y: 0 };
        ph.targetEdgeId = null;
        ph.targetSurfacePath = [];

        dragOffsetRef.current = {
          x: ph.position.x - (startX - contRect.left),
          y: ph.position.y - (startY - contRect.top),
        };
      }

      if (!hasDragStarted) return;

      const rect = getContainerRect();
      if (!rect) return;

      const newX = clamp(cx - rect.left + dragOffsetRef.current.x, 0, rect.width);
      const newY = clamp(cy - rect.top + dragOffsetRef.current.y, 0, rect.height);

      // Track velocity for fling
      const now = performance.now();
      const moveDt = (now - lastMoveTime) / 1000;
      if (moveDt > 0.001) {
        const pixelDx = cx - lastMoveX;
        const pixelDy = cy - lastMoveY;
        dropVelocityRef.current = {
          x: pixelDx / moveDt * 0.3,
          y: pixelDy / moveDt * 0.3,
        };
      }
      lastMoveX = cx;
      lastMoveY = cy;
      lastMoveTime = now;

      ph.position = { x: newX, y: newY };
      ph.contactSurfaceId = null;
      setPixelPos({ x: newX, y: newY });
    };

    const handleEnd = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
      dragMoveRef.current = null;
      dragEndRef.current = null;

      if (!hasDragStarted) {
        // 드래그 안 했으면 클릭으로 처리 → onClick이 처리
        return;
      }

      isDraggingRef.current = false;

      // Start drop physics
      rebuildSurfaceGraph();

      // 드롭 위치를 컨테이너 범위 내로 제한
      const contRectDrop = getContainerRect();
      if (contRectDrop) {
        ph.position.x = clamp(ph.position.x, 0, contRectDrop.width);
        ph.position.y = clamp(ph.position.y, 0, contRectDrop.height);
      }

      setStateAndRef('drop_land');

      if (reducedMotionRef.current) {
        // Instant snap for reduced motion
        const graph = surfaceGraphRef.current;
        if (graph.size > 0) {
          const proj = projectToNearestSurface(ph.position, graph, true);
          if (proj) {
            ph.position = proj.projectedPos;
            ph.contactSurfaceId = proj.edgeId;
            ph.contactPoint = proj.contactPoint;
            ph.velocity = { x: 0, y: 0 };
            setPixelPos({ x: proj.projectedPos.x, y: proj.projectedPos.y });
          }
        }
        dropVelocityRef.current = { x: 0, y: 0 };
        isDropFallingRef.current = false;

        setBubble('고마워~ 🐱');
        if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
        bubbleTimerRef.current = setTimeout(() => setBubble(null), 2000);

        stateTimerRef.current = setTimeout(() => {
          setStateAndRef('idle_sit');
          scheduleIdleActionRef.current();
        }, 300);
      } else {
        // Physics-based drop with gravity
        isDropFallingRef.current = true;
        // Ensure some downward velocity for the drop
        if (dropVelocityRef.current.y < 50) {
          dropVelocityRef.current.y = 50;
        }

        // 즉시 표면 체크 - 짧은 드래그 시 이미 표면 가까이에 있으면 바로 착지
        const immediateGraph = surfaceGraphRef.current;
        if (immediateGraph.size > 0) {
          const immediateProj = projectToNearestSurface(ph.position, immediateGraph, true);
          if (immediateProj) {
            const distToSurface = vecLen(vecSub(ph.position, immediateProj.projectedPos));
            if (distToSurface < 5) {
              isDropFallingRef.current = false;
              ph.position = immediateProj.projectedPos;
              ph.contactSurfaceId = immediateProj.edgeId;
              ph.contactPoint = immediateProj.contactPoint;
              ph.velocity = { x: 0, y: 0 };
              dropVelocityRef.current = { x: 0, y: 0 };
              setPixelPos({ x: immediateProj.projectedPos.x, y: immediateProj.projectedPos.y });

              setBubble('고마워~ 🐱');
              if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
              bubbleTimerRef.current = setTimeout(() => setBubble(null), 2000);

              stateTimerRef.current = setTimeout(() => {
                setStateAndRef('idle_sit');
                scheduleIdleActionRef.current();
              }, 300);
              return;
            }
          }
        }

        setBubble('고마워~ 🐱');
        if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
        bubbleTimerRef.current = setTimeout(() => setBubble(null), 2000);

        // Safety timeout: if drop physics doesn't resolve, snap to surface
        stateTimerRef.current = setTimeout(() => {
          if (isDropFallingRef.current) {
            isDropFallingRef.current = false;
            const graph = surfaceGraphRef.current;
            if (graph.size > 0) {
              const proj = projectToNearestSurface(ph.position, graph, true);
              if (proj) {
                ph.position = proj.projectedPos;
                ph.contactSurfaceId = proj.edgeId;
                ph.contactPoint = proj.contactPoint;
                setPixelPos({ x: proj.projectedPos.x, y: proj.projectedPos.y });
              }
            }
          }
          ph.velocity = { x: 0, y: 0 };
          dropVelocityRef.current = { x: 0, y: 0 };
          setStateAndRef('idle_sit');
          scheduleIdleActionRef.current();
        }, 500);
      }
    };

    dragMoveRef.current = handleMove;
    dragEndRef.current = handleEnd;
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);
  }, [setStateAndRef, getContainerRect, rebuildSurfaceGraph, setDirectionAndRef]);

  // --- Cleanup ---
  useEffect(() => {
    return () => {
      clearAllTimers();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (dragMoveRef.current) {
        window.removeEventListener('mousemove', dragMoveRef.current);
        window.removeEventListener('touchmove', dragMoveRef.current);
        dragMoveRef.current = null;
      }
      if (dragEndRef.current) {
        window.removeEventListener('mouseup', dragEndRef.current);
        window.removeEventListener('touchend', dragEndRef.current);
        dragEndRef.current = null;
      }
    };
  }, [clearAllTimers]);

  return {
    registerCell,
    setContainerRef,
    catPixelPos: pixelPos,
    catState,
    catDirection,
    bubble,
    showHeart,
    handleCatClick,
    handleDragStart,
    reducedMotion: reducedMotionState,
  };
}
