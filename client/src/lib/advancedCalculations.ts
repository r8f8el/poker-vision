/**
 * Cálculos Avançados de Poker
 * Pot odds, implied odds, expected value, etc.
 */

export interface PotOddsResult {
  potOdds: number; // Razão do pote
  odds: string; // Ex: "2:1"
  percentage: number; // % em forma decimal
  recommendation: "call" | "fold" | "marginal";
  reason: string;
}

export interface EquityCalculation {
  myEquity: number;
  opponentEquity: number;
  ties: number;
  expectedValue: number;
}

export interface HandStrength {
  current: number; // Força atual (0-100)
  potential: number; // Potencial de melhora (0-100)
  category: "made" | "draw" | "weak";
}

/**
 * Calcula pot odds
 * @param potSize - Tamanho atual do pote
 * @param betToCall - Quanto você precisa pagar
 * @returns Resultado com pot odds e recomendação
 */
export function calculatePotOdds(potSize: number, betToCall: number): PotOddsResult {
  if (betToCall === 0) {
    return {
      potOdds: 0,
      odds: "∞:1",
      percentage: 100,
      recommendation: "call",
      reason: "Você pode passar ou apostar sem risco",
    };
  }

  const totalPot = potSize + betToCall;
  const potOdds = totalPot / betToCall;
  const percentage = (betToCall / totalPot) * 100;

  // Converte para formato X:1
  const odds = `${potOdds.toFixed(1)}:1`;

  // Recomendação baseada em pot odds vs equity
  let recommendation: "call" | "fold" | "marginal" = "marginal";
  let reason = "";

  if (percentage < 20) {
    recommendation = "call";
    reason = "Pot odds muito favoráveis";
  } else if (percentage > 40) {
    recommendation = "fold";
    reason = "Pot odds desfavoráveis";
  } else {
    recommendation = "marginal";
    reason = "Depende da sua equity e posição";
  }

  return {
    potOdds,
    odds,
    percentage,
    recommendation,
    reason,
  };
}

/**
 * Calcula implied odds (pot odds considerando ganhos futuros)
 * @param potSize - Tamanho atual do pote
 * @param betToCall - Quanto você precisa pagar
 * @param potentialWin - Quanto você pode ganhar se melhorar
 * @returns Implied odds
 */
export function calculateImpliedOdds(
  potSize: number,
  betToCall: number,
  potentialWin: number
): number {
  if (betToCall === 0) return 0;

  const impliedPot = potSize + potentialWin;
  return (impliedPot + betToCall) / betToCall;
}

/**
 * Calcula expected value (EV)
 * @param winProbability - Probabilidade de vitória (0-1)
 * @param winAmount - Quanto você ganha se vencer
 * @param lossAmount - Quanto você perde se perder
 * @returns Expected value
 */
export function calculateEV(
  winProbability: number,
  winAmount: number,
  lossAmount: number
): number {
  return winProbability * winAmount - (1 - winProbability) * lossAmount;
}

/**
 * Classifica a força da mão (made hand vs draw)
 */
export function classifyHandStrength(
  currentEquity: number,
  outs: number,
  boardCards: number
): HandStrength {
  let category: "made" | "draw" | "weak";
  let potential = 0;

  if (currentEquity > 60) {
    category = "made";
    potential = Math.min(100, currentEquity + outs * 2);
  } else if (outs > 4) {
    category = "draw";
    // Calcula potencial de melhora
    potential = Math.min(100, currentEquity + outs * 3);
  } else {
    category = "weak";
    potential = currentEquity;
  }

  return {
    current: currentEquity,
    potential,
    category,
  };
}

/**
 * Calcula quantas cartas melhoram sua mão (simplificado)
 */
export function estimateOuts(
  currentEquity: number,
  boardSize: number
): number {
  // Estimativa simplificada baseada em equity
  if (currentEquity > 70) return 0; // Mão muito forte, poucos outs
  if (currentEquity > 50) return 3; // Mão boa, alguns outs
  if (currentEquity > 30) return 8; // Mão fraca, muitos outs
  return 12; // Mão muito fraca, muitos outs
}

/**
 * Calcula break-even percentage (qual equity você precisa para chamar)
 */
export function calculateBreakEvenEquity(potSize: number, betToCall: number): number {
  if (potSize + betToCall === 0) return 0;
  return (betToCall / (potSize + betToCall)) * 100;
}

/**
 * Compara sua equity com as pot odds
 */
export function compareEquityToPotOdds(
  myEquity: number,
  potSize: number,
  betToCall: number
): {
  recommendation: "call" | "fold" | "marginal";
  margin: number; // Diferença entre equity e break-even
  reason: string;
} {
  const breakEven = calculateBreakEvenEquity(potSize, betToCall);
  const margin = myEquity - breakEven;

  let recommendation: "call" | "fold" | "marginal" = "marginal";
  let reason = "";

  if (margin > 5) {
    recommendation = "call";
    reason = `Sua equity (${myEquity.toFixed(1)}%) é ${margin.toFixed(1)}% melhor que o break-even`;
  } else if (margin < -5) {
    recommendation = "fold";
    reason = `Sua equity (${myEquity.toFixed(1)}%) é ${Math.abs(margin).toFixed(1)}% pior que o break-even`;
  } else {
    recommendation = "marginal";
    reason = "Equity muito próxima do break-even, depende de outros fatores";
  }

  return {
    recommendation,
    margin,
    reason,
  };
}

/**
 * Calcula o tamanho ideal de aposta (pot-sized bet)
 */
export function calculatePotSizedBet(potSize: number): number {
  return potSize;
}

/**
 * Calcula o tamanho de aposta para extrair valor
 */
export function calculateValueBet(potSize: number, equity: number): number {
  // Quanto maior a equity, maior pode ser a aposta
  const betMultiplier = Math.min(1, equity / 50); // 50% equity = 1x pot
  return potSize * betMultiplier;
}

/**
 * Calcula o tamanho de aposta para blefar
 */
export function calculateBluffBet(potSize: number, equity: number): number {
  // Quanto menor a equity, menor deve ser a aposta
  const betMultiplier = Math.max(0.25, 1 - equity / 100);
  return potSize * betMultiplier;
}

/**
 * Gera recomendação estratégica baseada em múltiplos fatores
 */
export function generateStrategyRecommendation(
  myEquity: number,
  outs: number,
  potSize: number,
  betToCall: number,
  position: "early" | "middle" | "late" | "blind"
): string {
  const breakEven = calculateBreakEvenEquity(potSize, betToCall);
  const margin = myEquity - breakEven;

  // Posição influencia decisão
  const positionBonus = {
    early: -5,
    middle: 0,
    late: 5,
    blind: -10,
  }[position];

  const adjustedMargin = margin + positionBonus;

  if (myEquity > 70) {
    return "Mão forte. Considere aumentar a aposta para extrair valor.";
  } else if (myEquity > 50 && adjustedMargin > 0) {
    return "Mão boa com pot odds favoráveis. Chame para ver mais cartas.";
  } else if (outs > 8 && myEquity > 30) {
    return "Draw forte com bons outs. Chame se as pot odds justificarem.";
  } else if (myEquity < 30 && adjustedMargin < 0) {
    return "Mão fraca com pot odds desfavoráveis. Fold é geralmente a melhor opção.";
  } else if (position === "late" && myEquity > 40) {
    return "Você está em posição tardia. Pode chamar para ver o flop.";
  } else {
    return "Situação marginal. Considere sua imagem na mesa e histórico de mãos.";
  }
}
