/**
 * Hand History — persistência de mãos analisadas no localStorage
 * Mantém até MAX_HANDS mãos, com rotação automática (FIFO)
 */

export interface HandRecord {
  id: string;
  timestamp: number;        // Date.now()
  holeCards: string[];      // ["As","Kh"]
  board: string[];          // ["Qs","Js","Ts"]
  handRank: string;         // "Flush", "Straight", etc.
  equity: number;           // 0-100
  outs: number;
  recommendation: string;   // "fold" | "call" | "raise" | "check"
  confidence: string;       // "high" | "medium" | "low"
  pot: number;
  toCall: number;
  myStack: number;
  position: string;
  street: string;
  platform: string;
  aiConfidence: number;     // confiança do Gemini 0-100
}

const STORAGE_KEY = "pokervision_hand_history";
const MAX_HANDS = 500;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Retorna todas as mãos salvas (mais recentes primeiro) */
export function loadHandHistory(): HandRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Salva uma nova mão no histórico */
export function saveHand(record: Omit<HandRecord, "id" | "timestamp">): HandRecord {
  const hands = loadHandHistory();
  const newRecord: HandRecord = {
    ...record,
    id: generateId(),
    timestamp: Date.now(),
  };

  // Insere no início (mais recente primeiro)
  hands.unshift(newRecord);

  // Rotação: mantém apenas MAX_HANDS
  if (hands.length > MAX_HANDS) hands.splice(MAX_HANDS);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(hands));
  } catch (e) {
    // localStorage cheio — remove as mais antigas e tenta de novo
    const trimmed = hands.slice(0, MAX_HANDS / 2);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  }

  return newRecord;
}

/** Remove uma mão pelo ID */
export function deleteHand(id: string): void {
  const hands = loadHandHistory().filter(h => h.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(hands));
}

/** Limpa todo o histórico */
export function clearHistory(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// ── Cálculos de estatísticas ──────────────────────────────────────────────────

export interface HandStats {
  total: number;
  avgEquity: number;
  avgAiConfidence: number;
  byRecommendation: { fold: number; call: number; raise: number; check: number };
  byHandRank: Record<string, number>;
  byStreet: { preflop: number; flop: number; turn: number; river: number };
  byPosition: Record<string, number>;
  equityBuckets: { range: string; count: number }[];
  recentHands: HandRecord[];  // últimas 10
  winRateByPosition: Record<string, number>; // equity média por posição
}

export function computeStats(hands: HandRecord[]): HandStats {
  const total = hands.length;

  if (total === 0) {
    return {
      total: 0,
      avgEquity: 0,
      avgAiConfidence: 0,
      byRecommendation: { fold: 0, call: 0, raise: 0, check: 0 },
      byHandRank: {},
      byStreet: { preflop: 0, flop: 0, turn: 0, river: 0 },
      byPosition: {},
      equityBuckets: [
        { range: "0-20%", count: 0 },
        { range: "20-40%", count: 0 },
        { range: "40-60%", count: 0 },
        { range: "60-80%", count: 0 },
        { range: "80-100%", count: 0 },
      ],
      recentHands: [],
      winRateByPosition: {},
    };
  }

  const avgEquity = Math.round(hands.reduce((s, h) => s + h.equity, 0) / total);
  const avgAiConfidence = Math.round(hands.reduce((s, h) => s + (h.aiConfidence || 0), 0) / total);

  const byRecommendation = { fold: 0, call: 0, raise: 0, check: 0 };
  const byHandRank: Record<string, number> = {};
  const byStreet = { preflop: 0, flop: 0, turn: 0, river: 0 };
  const byPosition: Record<string, number> = {};
  const winRateByPosition: Record<string, { total: number; equitySum: number }> = {};

  const equityBuckets = [
    { range: "0-20%", count: 0 },
    { range: "20-40%", count: 0 },
    { range: "40-60%", count: 0 },
    { range: "60-80%", count: 0 },
    { range: "80-100%", count: 0 },
  ];

  for (const h of hands) {
    // Recomendação
    const rec = h.recommendation as keyof typeof byRecommendation;
    if (rec in byRecommendation) byRecommendation[rec]++;

    // Hand rank
    if (h.handRank) {
      byHandRank[h.handRank] = (byHandRank[h.handRank] || 0) + 1;
    }

    // Street
    const st = h.street as keyof typeof byStreet;
    if (st in byStreet) byStreet[st]++;

    // Position
    if (h.position && h.position !== "unknown") {
      byPosition[h.position] = (byPosition[h.position] || 0) + 1;

      if (!winRateByPosition[h.position]) {
        winRateByPosition[h.position] = { total: 0, equitySum: 0 };
      }
      winRateByPosition[h.position].total++;
      winRateByPosition[h.position].equitySum += h.equity;
    }

    // Equity bucket
    const bucketIdx = Math.min(Math.floor(h.equity / 20), 4);
    equityBuckets[bucketIdx].count++;
  }

  // Equity média por posição
  const posAvgEquity: Record<string, number> = {};
  for (const [pos, data] of Object.entries(winRateByPosition)) {
    posAvgEquity[pos] = Math.round(data.equitySum / data.total);
  }

  return {
    total,
    avgEquity,
    avgAiConfidence,
    byRecommendation,
    byHandRank,
    byStreet,
    byPosition,
    equityBuckets,
    recentHands: hands.slice(0, 10),
    winRateByPosition: posAvgEquity,
  };
}
