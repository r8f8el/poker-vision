/**
 * Preflop GTO Charts — 6-max No-Limit Hold'em
 * Lookup tables de ranges por posição e situação
 * Baseado em estratégia GTO simplificada
 */

export type PreflopAction = "open" | "3bet" | "call" | "fold";

export interface PreflopAdvice {
  action: PreflopAction;
  frequency?: number; // % do tempo que devemos fazer essa ação (GTO mix)
  reasoning: string;
  betSize?: string; // Ex: "2.5x", "3x"
}

// Representação de cartas preflop em notação de range
// s = suited (mesmo naipe), o = offsuit (naipes diferentes)
// Sem sufixo = par (pocket pair)

const POCKET_PAIRS = ["AA","KK","QQ","JJ","TT","99","88","77","66","55","44","33","22"];

const BROADWAY_SUITED = ["AKs","AQs","AJs","ATs","KQs","KJs","KTs","QJs","QTs","JTs"];
const BROADWAY_OFFSUIT = ["AKo","AQo","AJo","ATo","KQo","KJo","KTo","QJo","QTo","JTo"];

const MEDIUM_SUITED = ["A9s","A8s","A7s","A6s","A5s","A4s","A3s","A2s","K9s","K8s","K7s","K6s","K5s","Q9s","Q8s","J9s","J8s","T9s","T8s","98s","97s","87s","86s","76s","75s","65s","64s","54s","53s"];
const MEDIUM_OFFSUIT = ["A9o","A8o","A7o","A6o","A5o","A4o","A3o","A2o","K9o","K8o","Q9o","J9o","T9o","98o","87o","76o","65o","54o"];

// Ranges por posição (6-max, 100BB deep)
// Open Ranges — % de mãos que devemos abrir
const OPEN_RANGES: Record<string, Set<string>> = {
  BTN: new Set([
    ...POCKET_PAIRS,
    ...BROADWAY_SUITED, ...BROADWAY_OFFSUIT,
    ...MEDIUM_SUITED,
    "K4s","K3s","K2s","Q7s","Q6s","Q5s","Q4s","Q3s","Q2s",
    "J7s","J6s","J5s","T7s","T6s","96s","95s","85s","84s","74s","73s","63s","52s","43s","42s",
    "A9o","A8o","A7o","A6o","A5o","A4o","A3o","A2o","K9o","K8o","K7o","K6o","K5o",
    "Q8o","Q7o","J8o","T8o","97o","86o","75o","64o","53o",
  ]),
  CO: new Set([
    ...POCKET_PAIRS,
    ...BROADWAY_SUITED, ...BROADWAY_OFFSUIT,
    ...MEDIUM_SUITED,
    "K4s","K3s","Q7s","Q6s","Q5s","J7s","J6s","T7s","T6s","96s","85s","74s","63s","52s","43s",
    "A9o","A8o","A7o","A6o","A5o","A4o","A3o","K9o","K8o","K7o","K6o",
    "Q9o","Q8o","J9o","J8o","T9o","T8o","98o","87o","76o","65o","54o",
  ]),
  HJ: new Set([
    ...POCKET_PAIRS,
    ...BROADWAY_SUITED, ...BROADWAY_OFFSUIT,
    "A9s","A8s","A7s","A6s","A5s","A4s","A3s","A2s",
    "K9s","K8s","K7s","K6s","K5s","Q9s","Q8s","J9s","J8s","T9s","T8s","98s","97s","87s","86s","76s","75s","65s","54s",
    "A9o","A8o","A7o","A6o","A5o","K9o","K8o","K7o",
    "Q9o","Q8o","J9o","T9o","98o","87o","76o","65o",
  ]),
  MP: new Set([
    "AA","KK","QQ","JJ","TT","99","88","77","66","55","44",
    ...BROADWAY_SUITED, "A9s","A8s","A7s","A6s","A5s","A4s","A3s","A2s",
    "K9s","K8s","K7s","K6s","Q9s","Q8s","J9s","J8s","T9s","T8s","98s","97s","87s","76s","65s","54s",
    "AKo","AQo","AJo","ATo","A9o","A8o","A7o","A6o","A5o",
    "KQo","KJo","KTo","K9o","QJo","QTo","Q9o","JTo","J9o","T9o","98o","87o","76o",
  ]),
  UTG: new Set([
    "AA","KK","QQ","JJ","TT","99","88","77","66","55",
    "AKs","AQs","AJs","ATs","A9s","A8s","A7s","A6s","A5s","A4s","A3s","A2s",
    "KQs","KJs","KTs","K9s","QJs","QTs","Q9s","JTs","J9s","T9s","T8s","98s","87s","76s","65s","54s",
    "AKo","AQo","AJo","ATo","A9o","A8o",
    "KQo","KJo","KTo","QJo","QTo","JTo",
  ]),
  SB: new Set([
    // SB abre mais largo vs BB (steal + positional advantage)
    ...POCKET_PAIRS,
    ...BROADWAY_SUITED, ...BROADWAY_OFFSUIT,
    ...MEDIUM_SUITED,
    "K4s","K3s","K2s","Q7s","Q6s","Q5s","Q4s","Q3s","J7s","J6s","T7s","T6s","96s","95s","85s","84s","74s","63s","52s","43s",
    "A9o","A8o","A7o","A6o","A5o","A4o","A3o","A2o",
    "K9o","K8o","K7o","K6o","K5o","K4o","K3o",
    "Q9o","Q8o","Q7o","J9o","J8o","T9o","T8o","98o","97o","87o","86o","76o","75o","65o","64o","54o","53o",
  ]),
  BB: new Set([]), // BB defende quando há raise — calculado separadamente
};

// Ranges de 3-bet (vs open raise)
const THREEBET_RANGES: Record<string, Set<string>> = {
  BTN: new Set(["AA","KK","QQ","JJ","AKs","AKo","AQs","AQo","KQs","A5s","A4s","76s","65s","54s"]),
  CO: new Set(["AA","KK","QQ","JJ","AKs","AKo","AQs","AQo","KQs","A5s","A4s"]),
  HJ: new Set(["AA","KK","QQ","JJ","TT","AKs","AKo","AQs","AQo","KQs"]),
  MP: new Set(["AA","KK","QQ","JJ","TT","AKs","AKo","AQs"]),
  UTG: new Set(["AA","KK","QQ","JJ","TT","AKs","AKo"]),
  SB: new Set(["AA","KK","QQ","JJ","TT","AKs","AKo","AQs","AQo","KQs","A5s","A4s","A3s","76s","65s","54s"]),
  BB: new Set(["AA","KK","QQ","JJ","TT","AKs","AKo","AQs","AQo","KQs","A5s","A4s","A3s","A2s","76s","65s","54s","43s"]),
};

// Normaliza as cartas para notação de range
function normalizeHand(card1: string, card2: string): string {
  if (!card1 || !card2 || card1.length < 2 || card2.length < 2) return "";

  const rankOrder = "AKQJT98765432";
  const r1 = card1[0].toUpperCase();
  const r2 = card2[0].toUpperCase();
  const s1 = card1[1].toLowerCase();
  const s2 = card2[1].toLowerCase();

  // Garante que o rank maior vem primeiro
  const r1Idx = rankOrder.indexOf(r1);
  const r2Idx = rankOrder.indexOf(r2);

  let hi: string, lo: string, hiS: string, loS: string;
  if (r1Idx <= r2Idx) {
    hi = r1; lo = r2; hiS = s1; loS = s2;
  } else {
    hi = r2; lo = r1; hiS = s2; loS = s1;
  }

  // Par (pocket pair)
  if (hi === lo) return `${hi}${lo}`;

  // Suited ou offsuit
  if (hiS === loS) return `${hi}${lo}s`;
  return `${hi}${lo}o`;
}

/**
 * Analisa a melhor ação preflop baseado nas hole cards e posição
 */
export function analyzePreflopHand(
  holeCards: string[],
  position: string,
  facingAction: "none" | "raise" | "3bet" = "none"
): PreflopAdvice {
  if (!holeCards || holeCards.length < 2 || !holeCards[0] || !holeCards[1]) {
    return {
      action: "fold",
      reasoning: "Cartas não identificadas",
    };
  }

  const handNotation = normalizeHand(holeCards[0], holeCards[1]);
  if (!handNotation) {
    return {
      action: "fold",
      reasoning: "Cartas inválidas",
    };
  }

  const pos = position?.toUpperCase();
  const openRange = OPEN_RANGES[pos];
  const threebetRange = THREEBET_RANGES[pos];

  // Sem ação (primeiro a agir)
  if (facingAction === "none") {
    if (!openRange) {
      return { action: "fold", reasoning: "Posição não reconhecida" };
    }

    if (openRange.has(handNotation)) {
      const isPremium = ["AA","KK","QQ","JJ","AKs","AKo"].includes(handNotation);
      const isBtnCoOpen = (pos === "BTN" || pos === "CO") && MEDIUM_SUITED.includes(handNotation);

      return {
        action: "open",
        betSize: pos === "SB" ? "3x" : "2.5x",
        frequency: isPremium ? 100 : isBtnCoOpen ? 75 : 90,
        reasoning: `${handNotation} está no range de abertura do ${pos}. ${isPremium ? "Mão premium — abra sempre." : pos === "BTN" || pos === "CO" ? "Bom steal spot." : ""}`,
      };
    }

    return {
      action: "fold",
      reasoning: `${handNotation} não está no range de abertura do ${pos}. Fold.`,
    };
  }

  // Facing a raise (decidindo entre call/3bet/fold)
  if (facingAction === "raise") {
    if (threebetRange && threebetRange.has(handNotation)) {
      return {
        action: "3bet",
        betSize: "3x raise",
        frequency: ["AA","KK","AKs","AKo"].includes(handNotation) ? 100 : 80,
        reasoning: `${handNotation} está no range de 3-bet do ${pos}. Reraize para construir o pot.`,
      };
    }

    if (openRange && openRange.has(handNotation)) {
      // Suited connectors e pares médios fazem call (implied odds)
      const isSC = handNotation.endsWith("s") && "T9s 98s 87s 76s 65s 54s".includes(handNotation);
      const isMedPair = ["88","77","66","55","44","33","22"].includes(handNotation);

      if (isSC || isMedPair) {
        return {
          action: "call",
          reasoning: `${handNotation} tem implied odds para chamar. Jogue por set mining ou conectivos.`,
        };
      }

      return {
        action: "fold",
        reasoning: `${handNotation} não é forte o suficiente para 3-bet ou call fora de posição. Fold.`,
      };
    }

    return {
      action: "fold",
      reasoning: `${handNotation} é muito fraco para continuar contra um raise. Fold.`,
    };
  }

  // Facing a 3-bet (decidindo entre 4-bet/call/fold)
  if (facingAction === "3bet") {
    const ultraPremium = new Set(["AA","KK","QQ","AKs","AKo"]);
    if (ultraPremium.has(handNotation)) {
      return {
        action: "3bet", // 4-bet nesse contexto
        betSize: "2.5x 3-bet",
        frequency: handNotation === "AA" || handNotation === "KK" ? 100 : 80,
        reasoning: `${handNotation} é forte o suficiente para 4-bet. Reraize para isolar.`,
      };
    }

    const callVs3bet = new Set(["JJ","TT","99","AQs","KQs","AQo"]);
    if (callVs3bet.has(handNotation)) {
      return {
        action: "call",
        reasoning: `${handNotation} tem equity para chamar o 3-bet, mas não é forte para 4-bet.`,
      };
    }

    return {
      action: "fold",
      reasoning: `${handNotation} não tem equity suficiente contra o range de 3-bet. Fold.`,
    };
  }

  return { action: "fold", reasoning: "Situação não reconhecida" };
}

/**
 * Retorna o tier da mão preflop (premium, strong, playable, weak)
 */
export function getPreflopHandTier(holeCards: string[]): {
  tier: "premium" | "strong" | "playable" | "weak";
  label: string;
} {
  if (!holeCards || holeCards.length < 2) return { tier: "weak", label: "Fraca" };

  const hand = normalizeHand(holeCards[0], holeCards[1]);

  const premium = new Set(["AA","KK","QQ","JJ","AKs","AKo"]);
  const strong = new Set(["TT","99","88","AQs","AQo","AJs","ATs","KQs","KQo","QJs","JTs"]);
  const playable = new Set([
    "77","66","55","44","33","22",
    "AJo","ATo","A9s","A8s","A7s","A6s","A5s","A4s","A3s","A2s",
    "KJs","KTs","K9s","KJo","KTo","QTs","Q9s","QJo","J9s","T9s","T8s","98s","87s","76s","65s","54s",
  ]);

  if (premium.has(hand)) return { tier: "premium", label: "Premium 🔥" };
  if (strong.has(hand)) return { tier: "strong", label: "Forte 💪" };
  if (playable.has(hand)) return { tier: "playable", label: "Jogável ✅" };
  return { tier: "weak", label: "Fraca ❌" };
}
