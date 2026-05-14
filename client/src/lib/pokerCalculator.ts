import {
  evaluate,
  getCardCode,
  rank,
  rankDescription,
} from "@pokertools/evaluator";

/**
 * Poker Hand Calculator — Motor completo
 * • Equity via Monte Carlo (~600 simulações, <80ms)
 * • Outs reais: flush draw, straight draw (OESD/gutshot), overcards, set mining
 * • Recomendação com contexto de SPR e outs
 */

export interface PokerHand {
  holeCards: string[];  // ["As","Kh"]
  boardCards: string[]; // ["Qs","Js","Ts"]
}

export interface HandAnalysis {
  handRank: string;
  strength: number;
  equity: number;        // 0-100 (Monte Carlo)
  outs: number;          // outs reais calculados
  potOdds: number;
  recommendation: "fold" | "call" | "raise" | "check";
  confidence: "high" | "medium" | "low";
  outsDescription: string[]; // ex: ["Flush draw (9 outs)"]
}

// ── Deck completo ──────────────────────────────────────────────────────────────
const ALL_RANKS = ["A","K","Q","J","T","9","8","7","6","5","4","3","2"] as const;
const ALL_SUITS = ["s","h","d","c"] as const;
const FULL_DECK: string[] = [];
for (const r of ALL_RANKS) for (const s of ALL_SUITS) FULL_DECK.push(`${r}${s}`);

const RANK_ORDER: Record<string, number> = {
  A:14,K:13,Q:12,J:11,T:10,"9":9,"8":8,"7":7,"6":6,"5":5,"4":4,"3":3,"2":2,
};

function rankOf(card: string) { return RANK_ORDER[card[0]] ?? 0; }
function suitOf(card: string) { return card[1]; }

/** Fisher-Yates shuffle in-place */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ── Monte Carlo Equity ─────────────────────────────────────────────────────────
/**
 * Calcula equity real via simulação Monte Carlo
 * @param holeCards  suas 2 cartas de mão
 * @param boardCards cartas da mesa (3-5)
 * @param simCount   número de simulações (padrão 600)
 */
export function monteCarloEquity(
  holeCards: string[],
  boardCards: string[],
  simCount = 600
): number {
  if (holeCards.length < 2) return 0;

  const usedSet = new Set([...holeCards, ...boardCards]);
  const deck = FULL_DECK.filter(c => !usedSet.has(c));
  const cardsNeeded = 5 - boardCards.length; // quantas cartas faltam na mesa

  let wins = 0;
  let ties = 0;

  for (let i = 0; i < simCount; i++) {
    shuffle(deck);

    // Completa o board
    const simBoard = [...boardCards, ...deck.slice(0, cardsNeeded)];

    // Mão do oponente (próximas 2 cartas do deck embaralhado)
    const oppHole = [deck[cardsNeeded], deck[cardsNeeded + 1]];

    // Avalia as duas mãos (5-7 cartas)
    let myStrength: number, oppStrength: number;
    try {
      myStrength = evaluate([...holeCards, ...simBoard].map(c => getCardCode(c)));
      oppStrength = evaluate([...oppHole, ...simBoard].map(c => getCardCode(c)));
    } catch {
      continue; // carta inválida — ignora essa simulação
    }

    // Score menor = mão mais forte no evaluator
    if (myStrength < oppStrength) wins++;
    else if (myStrength === oppStrength) ties++;
  }

  const equity = ((wins + ties * 0.5) / simCount) * 100;
  return Math.round(equity);
}

// ── Outs Calculator Real ──────────────────────────────────────────────────────
export interface OutsResult {
  total: number;
  descriptions: string[];
}

/**
 * Calcula outs reais baseado nas cartas visíveis
 * Detecta: flush draw, OESD, gutshot, overcards, backdoor draws
 */
export function calculateRealOuts(holeCards: string[], boardCards: string[]): OutsResult {
  if (boardCards.length === 0 || boardCards.length > 4) {
    return { total: 0, descriptions: [] };
  }

  const allCards = [...holeCards, ...boardCards];
  const usedSet = new Set(allCards);
  const deck = FULL_DECK.filter(c => !usedSet.has(c));
  const descriptions: string[] = [];

  // Avalia força atual
  let currentStrength: number;
  try {
    // Se tiver menos de 5 cartas totais, pad com cartas neutras provisórias
    const padded = allCards.length >= 5
      ? allCards
      : [...allCards, ...deck.slice(0, 5 - allCards.length)];
    currentStrength = evaluate(padded.map(c => getCardCode(c)));
  } catch {
    return { total: 0, descriptions: [] };
  }

  // Conta cartas que melhoram a mão (outs únicos por draw)
  const improvingCards = new Set<string>();

  for (const card of deck) {
    const testHand = [...holeCards, ...boardCards, card];
    // Só avalia se tivermos ≥ 5 cartas
    if (testHand.length < 5) continue;

    // Para turno: avaliar turn card
    // Para flop: avaliar cada out individual
    const evalCards = testHand.length > 5
      ? testHand.slice(0, 5)   // river: já com 6 — usa as primeiras 5
      : testHand;

    try {
      const newStrength = evaluate(evalCards.map(c => getCardCode(c)));
      if (newStrength < currentStrength) {
        improvingCards.add(card);
      }
    } catch {
      continue;
    }
  }

  // ── Identifica os tipos de draw ────────────────────────────────────────────
  const suits = allCards.map(suitOf);
  const suitCounts: Record<string, number> = {};
  for (const s of suits) suitCounts[s] = (suitCounts[s] || 0) + 1;

  const holeSuits = holeCards.map(suitOf);

  // Flush draw
  for (const [s, count] of Object.entries(suitCounts)) {
    if (count === 4 && holeSuits.includes(s)) {
      descriptions.push("Flush draw (9 outs)");
      break;
    }
  }

  // Straight draws
  const ranks = allCards.map(rankOf).sort((a, b) => b - a);
  const uniqueRanks = Array.from(new Set(ranks));


  // OESD (open-ended straight draw) — 4 ranks consecutivos
  let oesd = false;
  for (let i = 0; i <= uniqueRanks.length - 4; i++) {
    const window = uniqueRanks.slice(i, i + 4);
    const holeRanks = holeCards.map(rankOf);
    const boardRanks = boardCards.map(rankOf);
    const windowHasHole = window.some(r => holeRanks.includes(r));

    if (
      window[0] - window[3] === 3 && // 4 ranks consecutivos
      windowHasHole // pelo menos 1 hole card contribui
    ) {
      oesd = true;
      descriptions.push("OESD — open-ended straight draw (8 outs)");
      break;
    }
  }

  // Gutshot — 4 ranks com um buraco (only if not OESD)
  if (!oesd) {
    for (let i = 0; i <= uniqueRanks.length - 4; i++) {
      const window = uniqueRanks.slice(i, i + 4);
      const spread = window[0] - window[3];
      const holeRanks = holeCards.map(rankOf);
      const windowHasHole = window.some(r => holeRanks.includes(r));

      if (spread === 4 && window.length === 4 && windowHasHole) {
        descriptions.push("Gutshot straight draw (4 outs)");
        break;
      }
    }
  }

  // Overcards (seus ranks são maiores que todos no board)
  if (boardCards.length >= 3) {
    const boardRanks = boardCards.map(rankOf);
    const maxBoardRank = Math.max(...boardRanks);
    const holeRanks = holeCards.map(rankOf);
    const overcards = holeRanks.filter(r => r > maxBoardRank);
    if (overcards.length === 2) {
      descriptions.push("Dois overcards (6 outs)");
    } else if (overcards.length === 1) {
      descriptions.push("Um overcard (3 outs)");
    }
  }

  // Backdoor flush draw (3 do mesmo naipe)
  for (const [s, count] of Object.entries(suitCounts)) {
    if (count === 3 && holeSuits.includes(s) && !descriptions.some(d => d.includes("Flush"))) {
      descriptions.push("Backdoor flush draw");
      break;
    }
  }

  // Usa o count real de improving cards se disponível
  const realOuts = improvingCards.size;

  return {
    total: realOuts > 0 ? realOuts : 0,
    descriptions,
  };
}

// ── Recomendação com SPR ───────────────────────────────────────────────────────
function getRecommendation(
  equity: number,
  outs: number,
  spr: number | null,
  boardSize: number
): "fold" | "call" | "raise" | "check" {
  // Preflop sem board — usa equity diretamente
  if (boardSize === 0) {
    if (equity > 65) return "raise";
    if (equity > 45) return "call";
    return "fold";
  }

  // Com SPR conhecida
  if (spr !== null) {
    if (spr < 3) {
      // Stack curto — qualquer equity razoável é raise/call
      if (equity > 35) return "raise";
      return "fold";
    }
    if (spr > 15) {
      // Stack profundo — precisa de mão mais forte para comprometer
      if (equity > 72) return "raise";
      if (equity > 52) return "call";
      if (outs > 8) return "call";
      return "fold";
    }
  }

  // Default sem SPR
  if (equity > 68) return "raise";
  if (equity > 50) return "call";
  if (equity > 32 && outs > 6) return "call";
  if (boardSize === 5 && equity > 45) return "check";
  return "fold";
}

function getConfidence(equity: number, boardSize: number, aiConfidence?: number): "high" | "medium" | "low" {
  // Se a IA não está confiante, rebaixa
  if (aiConfidence !== undefined && aiConfidence < 40) return "low";

  if (equity > 72 || equity < 22) return "high";
  if (equity > 45 && equity < 58) return "medium";
  return "medium";
}

// ── API pública ────────────────────────────────────────────────────────────────
export function analyzeHand(
  hand: PokerHand,
  context?: { myStack?: number; pot?: number; aiConfidence?: number }
): HandAnalysis {
  try {
    const allCards = [...hand.holeCards, ...hand.boardCards];

    // Precisa de pelo menos hole cards para avaliar
    if (hand.holeCards.length < 2) throw new Error("Hole cards insuficientes");

    // Avalia força da mão atual
    const padCards = allCards.length >= 5
      ? allCards
      : [...allCards, ...FULL_DECK.filter(c => !new Set(allCards).has(c)).slice(0, 5 - allCards.length)];

    const strength = evaluate(padCards.map(c => getCardCode(c)));
    const handRankEnum = rank(padCards.map(c => getCardCode(c)));
    const handRankName = rankDescription(handRankEnum);

    // Monte Carlo equity
    const equity = hand.boardCards.length >= 3
      ? monteCarloEquity(hand.holeCards, hand.boardCards, 600)
      : monteCarloEquity(hand.holeCards, [], 600); // preflop

    // Outs reais
    const outsResult = calculateRealOuts(hand.holeCards, hand.boardCards);

    // SPR
    let spr: number | null = null;
    if (context?.myStack && context?.pot && context.pot > 0) {
      spr = context.myStack / context.pot;
    }

    const recommendation = getRecommendation(
      equity,
      outsResult.total,
      spr,
      hand.boardCards.length
    );

    const confidence = getConfidence(equity, hand.boardCards.length, context?.aiConfidence);

    return {
      handRank: handRankName,
      strength,
      equity,
      outs: outsResult.total,
      potOdds: 0,
      recommendation,
      confidence,
      outsDescription: outsResult.descriptions,
    };
  } catch (error) {
    console.error("Erro ao analisar mão:", error);
    return {
      handRank: "Erro",
      strength: 0,
      equity: 0,
      outs: 0,
      potOdds: 0,
      recommendation: "fold",
      confidence: "low",
      outsDescription: [],
    };
  }
}

export function isValidCard(card: string): boolean {
  const validRanks = ["A","K","Q","J","T","9","8","7","6","5","4","3","2"];
  const validSuits = ["s","h","d","c"];
  if (card.length !== 2) return false;
  return validRanks.includes(card[0]) && validSuits.includes(card[1]);
}

export function calculatePotOdds(potSize: number, betToCall: number): number {
  if (betToCall === 0) return 0;
  return (potSize / betToCall) * 100;
}

export function compareHands(hand1: PokerHand, hand2: PokerHand): number {
  const codes1 = [...hand1.holeCards, ...hand1.boardCards].map(c => getCardCode(c));
  const codes2 = [...hand2.holeCards, ...hand2.boardCards].map(c => getCardCode(c));
  const s1 = evaluate(codes1);
  const s2 = evaluate(codes2);
  if (s1 < s2) return 1;
  if (s1 > s2) return -1;
  return 0;
}

export function codeToCard(code: number): string {
  const ranks = ["A","K","Q","J","T","9","8","7","6","5","4","3","2"];
  const suits = ["s","h","d","c"];
  return ranks[Math.floor(code / 4)] + suits[code % 4];
}
