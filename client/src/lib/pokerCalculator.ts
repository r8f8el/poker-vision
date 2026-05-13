import {
  evaluate,
  getCardCode,
  rank,
  HandRank,
  rankDescription,
} from "@pokertools/evaluator";

/**
 * Poker Hand Calculator
 * Usa @pokertools/evaluator para cálculos ultra-rápidos de mãos de poker
 */

export interface PokerHand {
  holeCards: string[]; // Ex: ["As", "Kh"]
  boardCards: string[]; // Ex: ["Qs", "Js", "Ts"]
}

export interface HandAnalysis {
  handRank: string;
  strength: number;
  equity: number; // 0-100
  outs: number;
  potOdds: number;
  recommendation: "fold" | "call" | "raise" | "check";
  confidence: "high" | "medium" | "low";
}

/**
 * Converte string de carta para código inteiro
 * Ex: "As" -> código inteiro
 */
function cardToCode(card: string): number {
  return getCardCode(card);
}

/**
 * Avalia uma mão de poker e retorna análise completa
 */
export function analyzeHand(hand: PokerHand): HandAnalysis {
  try {
    // Combina hole cards com board cards
    const allCards = [...hand.holeCards, ...hand.boardCards];

    // Converte para códigos inteiros (mais rápido)
    const cardCodes = allCards.map(cardToCode);

    // Avalia a mão
    const strength = evaluate(cardCodes);

    // Obtém o rank (tipo de mão)
    const handRank = rank(cardCodes);
    const handRankName = rankDescription(handRank);

    // Calcula equity (simplificado para MVP)
    // Em uma versão completa, isso seria Monte Carlo simulation
    const equity = calculateEquity(strength);

    // Calcula outs (cartas que melhoram a mão)
    const outs = calculateOuts(hand);

    // Calcula pot odds (simplificado)
    const potOdds = 0; // Será preenchido pela interface

    // Gera recomendação baseada em equity
    const recommendation = getRecommendation(equity, outs);

    // Calcula confiança
    const confidence = getConfidence(equity, outs);

    return {
      handRank: handRankName,
      strength,
      equity,
      outs,
      potOdds,
      recommendation,
      confidence,
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
    };
  }
}

/**
 * Converte score de força para equity (0-100%)
 * Score mais baixo = mão mais forte
 * Royal Flush = 1, Worst High Card = 7462
 */
function calculateEquity(strength: number): number {
  // Normaliza o score para 0-100
  // Score 1 (melhor) = 100%, Score 7462 (pior) = 0%
  const maxScore = 7462;
  const equity = Math.round(((maxScore - strength) / maxScore) * 100);
  return Math.max(0, Math.min(100, equity));
}

/**
 * Calcula número de outs (cartas que melhoram a mão)
 * Simplificado para MVP - em produção seria mais complexo
 */
function calculateOuts(hand: PokerHand): number {
  // Contagem simplificada de outs
  // Em uma versão completa, analisaria todas as cartas restantes
  const boardSize = hand.boardCards.length;

  if (boardSize === 3) {
    // Flop: ~8 outs em média para draw
    return 8;
  } else if (boardSize === 4) {
    // Turn: ~4 outs em média
    return 4;
  } else if (boardSize === 5) {
    // River: sem outs (mão finalizada)
    return 0;
  }

  return 0;
}

/**
 * Gera recomendação de ação baseada em equity
 */
function getRecommendation(
  equity: number,
  outs: number
): "fold" | "call" | "raise" | "check" {
  if (equity > 70) {
    return "raise";
  } else if (equity > 50) {
    return "call";
  } else if (equity > 30 && outs > 4) {
    return "call"; // Draw com bons outs
  } else {
    return "fold";
  }
}

/**
 * Calcula nível de confiança na recomendação
 */
function getConfidence(equity: number, outs: number): "high" | "medium" | "low" {
  if (equity > 75 || equity < 25) {
    return "high";
  } else if (equity > 40 && equity < 60) {
    if (outs > 6) {
      return "medium";
    }
    return "low";
  }
  return "medium";
}

/**
 * Calcula pot odds
 * potSize: tamanho atual do pote
 * betToCall: quanto você precisa pagar para continuar
 */
export function calculatePotOdds(potSize: number, betToCall: number): number {
  if (betToCall === 0) return 0;
  return (potSize / betToCall) * 100;
}

/**
 * Compara duas mãos e retorna a mais forte
 */
export function compareHands(hand1: PokerHand, hand2: PokerHand): number {
  const allCards1 = [...hand1.holeCards, ...hand1.boardCards];
  const allCards2 = [...hand2.holeCards, ...hand2.boardCards];

  const codes1 = allCards1.map(cardToCode);
  const codes2 = allCards2.map(cardToCode);

  const strength1 = evaluate(codes1);
  const strength2 = evaluate(codes2);

  // Retorna: 1 se hand1 é melhor, -1 se hand2 é melhor, 0 se empate
  if (strength1 < strength2) return 1;
  if (strength1 > strength2) return -1;
  return 0;
}

/**
 * Valida se as cartas são válidas
 */
export function isValidCard(card: string): boolean {
  const validRanks = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];
  const validSuits = ["s", "h", "d", "c"];

  if (card.length !== 2) return false;

  const rank = card[0];
  const suit = card[1];

  return validRanks.includes(rank) && validSuits.includes(suit);
}

/**
 * Formata card code de volta para string
 */
export function codeToCard(code: number): string {
  const ranks = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];
  const suits = ["s", "h", "d", "c"];

  // Decodifica o código para rank e suit
  // Formato: (rank * 4) + suit
  const suit = code % 4;
  const rankIdx = Math.floor(code / 4);

  return ranks[rankIdx] + suits[suit];
}
