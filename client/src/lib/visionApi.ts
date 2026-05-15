/**
 * Gemini Vision Service - Full Table Analysis
 * Analisa a mesa completa de poker a partir de um frame da câmera
 */

export class RateLimitError extends Error {
  waitSeconds: number;
  constructor(message: string, waitSeconds: number) {
    super(message);
    this.name = "RateLimitError";
    this.waitSeconds = waitSeconds;
  }
}

export interface TableState {
  holeCards: string[];        // ["As", "Kh"]
  board: string[];            // ["Qs", "Js", "Ts"]
  pot: number;                // tamanho do pot
  toCall: number;             // quanto precisa pagar
  myStack: number;            // meu stack
  myPosition: string;         // "BTN", "BB", "SB", "UTG", etc.
  myTurn: boolean;            // é minha vez?
  activePlayers: number;      // jogadores ainda na mão
  lastActions: string[];      // ["raise 120", "fold", "call 120"]
  street: "preflop" | "flop" | "turn" | "river" | "showdown" | "unknown";
  platform: string;           // "PokerStars", "GGPoker", etc.
  confidence: number;         // 0-100 confiança da leitura
}

export interface GeminiDetectedCard {
  rank: string;
  suit: string;
  display: string;
  confidence: number;
}

export interface GeminiDetectionResult {
  cards: GeminiDetectedCard[];
  tableState: TableState | null;
  rawResponse: string;
  error?: string;
}

const SUIT_MAP: Record<string, string> = {
  "♠": "s", S: "s", s: "s", spades: "s", espadas: "s",
  "♥": "h", H: "h", h: "h", hearts: "h", copas: "h",
  "♦": "d", D: "d", d: "d", diamonds: "d", ouros: "d",
  "♣": "c", C: "c", c: "c", clubs: "c", paus: "c",
};

const SUIT_SYMBOL: Record<string, string> = {
  s: "♠", h: "♥", d: "♦", c: "♣",
};

const RANK_MAP: Record<string, string> = {
  A: "A", "1": "A", K: "K", Q: "Q", J: "J",
  T: "T", "10": "T", "9": "9", "8": "8", "7": "7",
  "6": "6", "5": "5", "4": "4", "3": "3", "2": "2",
};

export function captureFrameAsBase64(video: HTMLVideoElement): string | null {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
  } catch {
    return null;
  }
}

function normalizeCard(rank: string, suit: string): string | null {
  const r = RANK_MAP[rank?.toUpperCase()?.trim()];
  const s = SUIT_MAP[suit?.toLowerCase()?.trim()];
  if (!r || !s) return null;
  return `${r}${s}`;
}

function parseCards(arr: any[]): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((c: any) => {
      if (typeof c === "string") return c;
      return normalizeCard(c?.rank, c?.suit);
    })
    .filter(Boolean) as string[];
}

/**
 * Analisa a mesa completa de poker via Gemini Vision
 */
export async function analyzeTableWithVision(
  imageBase64: string,
  apiKey: string
): Promise<GeminiDetectionResult> {
  const prompt = `You are an expert poker computer vision system analyzing a screenshot of an online poker table.

Extract ALL visible information and return ONLY a valid JSON object (no markdown, no explanation):
{
  "holeCards": ["As", "Kh"],
  "board": ["Qs", "Js", "Ts"],
  "pot": 450,
  "toCall": 120,
  "myStack": 1200,
  "myPosition": "BTN",
  "myTurn": true,
  "activePlayers": 3,
  "lastActions": ["UTG raise 120", "MP fold", "CO call 120"],
  "street": "flop",
  "platform": "PokerStars",
  "confidence": 85
}

SUIT IDENTIFICATION RULES (critical - study the symbol carefully):
- "s" = SPADES ♠ → BLACK suit, looks like an upside-down heart with a stem, pointed at top
- "c" = CLUBS ♣ → BLACK suit, looks like a 3-leaf clover / trefoil shape with a stem
- "h" = HEARTS ♥ → RED suit, looks like a heart shape, rounded top with a point at bottom
- "d" = DIAMONDS ♦ → RED suit, looks like a rotated square / rhombus / diamond shape
- If the suit symbol is BLACK: look carefully — spade (♠) has a pointed top, club (♣) has rounded bumps on top
- If you are unsure between ♠ and ♣, prefer ♠ for angular/pointed shapes and ♣ for round/bumpy shapes
- Card format: rank + suit letter. Rank: A K Q J T 9 8 7 6 5 4 3 2. Suit: s h d c

HOLE CARDS RULES:
- "holeCards" = the 2 private cards dealt face-up to the player (usually at bottom center of screen)
- If NO hole cards are visible (player folded, between hands, or cards are face-down/hidden), return "holeCards": []
- Do NOT guess or invent hole cards if you cannot clearly see them
- If only 1 card is visible, return that 1 card only

BOARD RULES:
- "board" = community cards in the center of the table (0 to 5 cards)
- Return only clearly visible board cards, skip face-down cards

GENERAL RULES:
- "pot": numeric chip value shown (0 if not visible)
- "toCall": amount needed to call (0 if not visible or it's a check)  
- "myStack": player's chip stack (0 if not visible)
- "myPosition": BTN, SB, BB, UTG, MP, CO, HJ or "unknown"
- "myTurn": true ONLY if there is a timer/clock or action buttons visible for the player
- "activePlayers": players still in the hand
- "lastActions": list of recent visible player actions as strings
- "street": preflop, flop, turn, river, showdown, or unknown
- "platform": PokerStars, GGPoker, 888poker, partypoker, or "unknown"
- "confidence": your overall confidence 0-100 (be conservative — only give 80+ if you are very certain)

If no poker game is visible: {"confidence": 0, "holeCards": [], "board": [], "pot": 0, "toCall": 0, "myStack": 0, "myPosition": "unknown", "myTurn": false, "activePlayers": 0, "lastActions": [], "street": "unknown", "platform": "unknown"}`;


  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
            ]
          }
        ],
        temperature: 0.1
      })
    });

    if (!response.ok) {
      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        const waitSec = retryAfter ? parseInt(retryAfter) : 30;
        throw new RateLimitError(`Limite de requisições atingido. Aguarde ${waitSec}s.`, waitSec);
      }
      const errText = await response.text();
      throw new Error(`API error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    const text = data.choices[0]?.message?.content || "{}";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { cards: [], tableState: null, rawResponse: text };

    const parsed = JSON.parse(jsonMatch[0]);

    const holeCards = parseCards(parsed.holeCards || []);
    const board = parseCards(parsed.board || []);

    const tableState: TableState = {
      holeCards,
      board,
      pot: Number(parsed.pot) || 0,
      toCall: Number(parsed.toCall) || 0,
      myStack: Number(parsed.myStack) || 0,
      myPosition: parsed.myPosition || "unknown",
      myTurn: Boolean(parsed.myTurn),
      activePlayers: Number(parsed.activePlayers) || 0,
      lastActions: Array.isArray(parsed.lastActions) ? parsed.lastActions : [],
      street: parsed.street || "unknown",
      platform: parsed.platform || "unknown",
      confidence: Number(parsed.confidence) || 0,
    };

    // Também retorna cards no formato antigo para compatibilidade
    const cards: GeminiDetectedCard[] = [...holeCards, ...board].map((c, i) => ({
      rank: c[0],
      suit: c[1],
      display: `${c[0]}${SUIT_SYMBOL[c[1]] || c[1]}`,
      confidence: tableState.confidence - i,
    }));

    return { cards, tableState, rawResponse: text };
  } catch (error) {
    return {
      cards: [],
      tableState: null,
      rawResponse: "",
      error: error instanceof Error ? error.message : "Erro desconhecido",
    };
  }
}

export function formatCardForCalculator(card: GeminiDetectedCard): string {
  return `${card.rank}${card.suit}`;
}
