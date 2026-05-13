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
export async function analyzeTableWithGemini(
  imageBase64: string,
  apiKey: string
): Promise<GeminiDetectionResult> {
  const prompt = `Você é um especialista em poker online com visão computacional avançada.
Analise esta imagem de uma mesa de poker e extraia TODAS as informações visíveis.

Retorne APENAS um objeto JSON válido com esta estrutura exata (sem markdown, sem explicações):
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

Regras:
- holeCards: suas 2 cartas de mão (use rank+naipe: A=ás, K=rei, Q=dama, J=valete, T=10, s=espadas, h=copas, d=ouros, c=paus)
- board: cartas comunitárias visíveis (0-5 cartas)
- pot: valor numérico do pote (0 se não visível)
- toCall: quanto você precisa pagar para continuar (0 se não visível)
- myStack: seu stack atual (0 se não visível)
- myPosition: posição na mesa (BTN, SB, BB, UTG, MP, CO, HJ ou "unknown")
- myTurn: true se for sua vez de agir
- activePlayers: número de jogadores ainda na mão
- lastActions: lista das últimas ações visíveis dos jogadores
- street: fase atual (preflop, flop, turn, river, showdown, unknown)
- platform: nome da plataforma se identificável
- confidence: sua confiança na leitura (0-100)

Se não houver jogo de poker visível, retorne: {"confidence": 0, "holeCards": [], "board": [], "pot": 0, "toCall": 0, "myStack": 0, "myPosition": "unknown", "myTurn": false, "activePlayers": 0, "lastActions": [], "street": "unknown", "platform": "unknown"}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { inline_data: { mime_type: "image/jpeg", data: imageBase64 } },
                { text: prompt },
              ],
            },
          ],
          generationConfig: { temperature: 0.1, maxOutputTokens: 512 },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        const waitSec = retryAfter ? parseInt(retryAfter) : 30;
        throw new RateLimitError(`Limite de requisições atingido. Aguarde ${waitSec}s.`, waitSec);
      }
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

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
