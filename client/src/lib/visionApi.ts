/**
 * Vision API — Multi-provider poker table analysis
 * Providers: Groq (Llama 4 Scout) | Google Gemini 2.5 Flash | OpenRouter (Qwen VL / Claude)
 */

// ── Types ─────────────────────────────────────────────────────────────────────
export type VisionProvider = "groq" | "gemini" | "openrouter";

export class RateLimitError extends Error {
  waitSeconds: number;
  constructor(message: string, waitSeconds: number) {
    super(message);
    this.name = "RateLimitError";
    this.waitSeconds = waitSeconds;
  }
}

export interface TableState {
  holeCards: string[];
  board: string[];
  pot: number;
  toCall: number;
  myStack: number;
  myPosition: string;
  myTurn: boolean;
  activePlayers: number;
  lastActions: string[];
  street: "preflop" | "flop" | "turn" | "river" | "showdown" | "unknown";
  platform: string;
  confidence: number;
  playerFolded: boolean;
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

// ── Maps ──────────────────────────────────────────────────────────────────────
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

// ── Image Capture ─────────────────────────────────────────────────────────────
export function captureFrameAsBase64(video: HTMLVideoElement): string | null {
  try {
    const srcW = video.videoWidth || 640;
    const srcH = video.videoHeight || 480;

    // Upscaling para mínimo 1280px de largura
    const scale = srcW < 1280 ? Math.min(2.0, 1280 / srcW) : 1.0;
    const outW = Math.round(srcW * scale);
    const outH = Math.round(srcH * scale);

    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Filtro: contraste + brilho + saturação
    ctx.filter = "contrast(1.25) brightness(1.1) saturate(1.15)";
    ctx.drawImage(video, 0, 0, outW, outH);
    ctx.filter = "none";

    // Anotações de região — guia o modelo
    const hcX = Math.round(outW * 0.20);
    const hcY = Math.round(outH * 0.68);
    const hcW = Math.round(outW * 0.60);
    const hcH = Math.round(outH * 0.30);

    ctx.strokeStyle = "rgba(0, 255, 100, 0.85)";
    ctx.lineWidth = Math.max(2, outW / 320);
    ctx.setLineDash([8, 4]);
    ctx.strokeRect(hcX, hcY, hcW, hcH);
    ctx.fillStyle = "rgba(0, 200, 80, 0.85)";
    ctx.font = `bold ${Math.round(outH * 0.022)}px sans-serif`;
    ctx.fillText("YOUR HOLE CARDS", hcX + 4, hcY - 6);

    const bdX = Math.round(outW * 0.15);
    const bdY = Math.round(outH * 0.30);
    const bdW = Math.round(outW * 0.70);
    const bdH = Math.round(outH * 0.28);

    ctx.strokeStyle = "rgba(80, 160, 255, 0.80)";
    ctx.lineWidth = Math.max(2, outW / 320);
    ctx.setLineDash([6, 3]);
    ctx.strokeRect(bdX, bdY, bdW, bdH);
    ctx.fillStyle = "rgba(80, 160, 255, 0.85)";
    ctx.fillText("BOARD / COMMUNITY CARDS", bdX + 4, bdY - 6);
    ctx.setLineDash([]);

    return canvas.toDataURL("image/jpeg", 0.95).split(",")[1];
  } catch {
    return null;
  }
}

// ── Card Parsers ──────────────────────────────────────────────────────────────
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

function extractJson(text: string): any | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

function parseTableState(parsed: any): { tableState: TableState; cards: GeminiDetectedCard[] } {
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
    playerFolded: Boolean(parsed.playerFolded),
  };

  const cards: GeminiDetectedCard[] = [...holeCards, ...board].map((c, i) => ({
    rank: c[0],
    suit: c[1],
    display: `${c[0]}${SUIT_SYMBOL[c[1]] || c[1]}`,
    confidence: tableState.confidence - i,
  }));

  return { tableState, cards };
}

// ── Prompt ────────────────────────────────────────────────────────────────────
function buildPrompt(): string {
  return `You are an expert poker computer vision system analyzing a screenshot of an online poker table (like SupremaPoker).

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
  "platform": "SupremaPoker",
  "confidence": 85,
  "playerFolded": false
}

FOLD DETECTION (most important rule for this app):
- Look at the BOTTOM of the screen — that is the main player's position
- If you see the word "Fold", "FOLDED", "FOLD OUT", "SAIU" displayed ON or NEAR the bottom player's avatar, set "playerFolded": true
- If the main player's cards are GRAYED OUT, darkened, face-down, or missing, set "playerFolded": true
- If the player's cards are clearly visible face-up in FULL COLOR, set "playerFolded": false
- Default: "playerFolded": false

SUIT IDENTIFICATION — 2-STEP RULE (critical, follow exactly):

STEP 1 — DETERMINE THE COLOR of the suit symbol:
  → If the suit symbol is RED (any shade of red/pink/orange): it can ONLY be "h" (hearts ♥) or "d" (diamonds ♦)
  → If the suit symbol is BLACK (dark/black/gray): it can ONLY be "s" (spades ♠) or "c" (clubs ♣)
  → A red card NEVER has spades or clubs. A black card NEVER has hearts or diamonds.

STEP 2 — DETERMINE WHICH SUIT within that color:
  RED suits:
    - "h" = HEARTS ♥ → heart shape: two bumps on top, point at bottom (like a valentine heart)
    - "d" = DIAMONDS ♦ → diamond/rhombus shape: rotated square, 4 equal sides, pointed top and bottom
  BLACK suits:
    - "s" = SPADES ♠ → pointed top (like an upside-down heart with a long stem below)
    - "c" = CLUBS ♣ → three round bubbles/circles on top (like a 3-leaf clover with a short stem)

EXAMPLES:
  - Red heart shape → "h" (hearts)
  - Red diamond shape → "d" (diamonds)
  - Black pointed shape → "s" (spades)
  - Black clover/round shape → "c" (clubs)
  - Card rank format: rank + suit. Example: Ace of hearts = "Ah", King of spades = "Ks"
  - IMPORTANT: The number "10" on a card must be returned as "T" (10♥ → "Th", 10♠ → "Ts", etc.)

BOARD RULES:
- "board" = community cards in the center of the table (0 to 5 cards)
- Return only clearly visible board cards, skip face-down cards

GENERAL RULES:
- "pot": numeric chip value shown (e.g., if you see "136.5 BB", pot is 136.5)
- "toCall": amount needed to call. Look at the green call button (e.g., "Pagar 43.7 BB" means toCall is 43.7). If it's a check, 0.
- "myStack": player's chip stack under the bottom name (e.g., "156 BB" means 156)
- "myPosition": BTN, SB, BB, UTG, MP, CO, HJ or "unknown"
- "myTurn": true ONLY if large action buttons are visible at the very bottom (e.g., "Desistir", "Pagar", "Aumentar", "Fold", "Call", "Raise").
- "activePlayers": players still in the hand
- "lastActions": list of recent visible player actions as strings
- "street": preflop, flop, turn, river, showdown, or unknown
- "platform": SupremaPoker, PokerStars, GGPoker, 888poker, partypoker, or "unknown"
- "confidence": your overall confidence 0-100 (be conservative)

If no poker game is visible: {"confidence": 0, "holeCards": [], "board": [], "pot": 0, "toCall": 0, "myStack": 0, "myPosition": "unknown", "myTurn": false, "activePlayers": 0, "lastActions": [], "street": "unknown", "platform": "unknown", "playerFolded": false}`;
}

// ── Provider State ─────────────────────────────────────────────────────────────
let currentProvider: VisionProvider =
  (localStorage.getItem("pv_vision_provider") as VisionProvider) || "groq";

export function setVisionProvider(p: VisionProvider) {
  currentProvider = p;
  localStorage.setItem("pv_vision_provider", p);
}

export function getVisionProvider(): VisionProvider {
  return currentProvider;
}

// ── Provider: Groq ────────────────────────────────────────────────────────────
async function analyzeWithGroq(
  imageBase64: string,
  apiKey: string,
  prompt: string
): Promise<GeminiDetectionResult> {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      response_format: { type: "json_object" },
      messages: [{
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
        ],
      }],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      const waitSec = parseInt(response.headers.get("Retry-After") || "30");
      throw new RateLimitError(`Groq: rate limit — aguarde ${waitSec}s`, waitSec);
    }
    throw new Error(`Groq error ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  const text: string = data.choices[0]?.message?.content || "{}";
  const parsed = extractJson(text);
  if (!parsed) return { cards: [], tableState: null, rawResponse: text };
  const { tableState, cards } = parseTableState(parsed);
  return { cards, tableState, rawResponse: text };
}

// ── Provider: Google Gemini ───────────────────────────────────────────────────
async function analyzeWithGemini(
  imageBase64: string,
  apiKey: string,
  prompt: string
): Promise<GeminiDetectionResult> {
  const model = "gemini-1.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: "image/jpeg", data: imageBase64 } },
        ],
      }],
      generationConfig: { response_mime_type: "application/json", temperature: 0.1 },
    }),
  });

  if (!response.ok) {
    if (response.status === 429) throw new RateLimitError("Gemini: rate limit — aguarde 30s", 30);
    throw new Error(`Gemini error ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  const parsed = extractJson(text);
  if (!parsed) return { cards: [], tableState: null, rawResponse: text };
  const { tableState, cards } = parseTableState(parsed);
  return { cards, tableState, rawResponse: text };
}

// ── Provider: OpenRouter ──────────────────────────────────────────────────────
// Usa qwen/qwen2.5-vl-72b-instruct — excelente visão, gratuito via OpenRouter
async function analyzeWithOpenRouter(
  imageBase64: string,
  apiKey: string,
  prompt: string
): Promise<GeminiDetectionResult> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": "https://poker-vision-theta.vercel.app",
      "X-Title": "PokerVision",
    },
    body: JSON.stringify({
      model: "qwen/qwen2.5-vl-72b-instruct:free",
      messages: [{
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
        ],
      }],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    if (response.status === 429) throw new RateLimitError("OpenRouter: rate limit — aguarde 30s", 30);
    throw new Error(`OpenRouter error ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  const text: string = data.choices[0]?.message?.content || "{}";
  const parsed = extractJson(text);
  if (!parsed) return { cards: [], tableState: null, rawResponse: text };
  const { tableState, cards } = parseTableState(parsed);
  return { cards, tableState, rawResponse: text };
}

// ── Public API: tenta provider ativo, faz fallback automático ─────────────────
export async function analyzeTableWithVision(
  imageBase64: string,
  groqKey: string,
  geminiKey?: string,
  openRouterKey?: string,
): Promise<GeminiDetectionResult> {
  const prompt = buildPrompt();
  const provider = currentProvider;

  const tryGroq       = () => groqKey       ? analyzeWithGroq(imageBase64, groqKey, prompt)             : Promise.reject(new Error("Sem chave Groq"));
  const tryGemini     = () => geminiKey     ? analyzeWithGemini(imageBase64, geminiKey, prompt)         : Promise.reject(new Error("Sem chave Gemini"));
  const tryOpenRouter = () => openRouterKey ? analyzeWithOpenRouter(imageBase64, openRouterKey, prompt) : Promise.reject(new Error("Sem chave OpenRouter"));

  const ORDER: Record<VisionProvider, VisionProvider[]> = {
    groq:       ["groq", "gemini", "openrouter"],
    gemini:     ["gemini", "openrouter", "groq"],
    openrouter: ["openrouter", "gemini", "groq"],
  };

  const chain = ORDER[provider];
  let lastError = "";

  for (let i = 0; i < chain.length; i++) {
    const currentAttempt = chain[i];
    try {
      let result;
      if (currentAttempt === "groq") {
        if (!groqKey) throw new Error("Sem chave Groq (VITE_GROQ_API_KEY)");
        result = await analyzeWithGroq(imageBase64, groqKey, prompt);
      } else if (currentAttempt === "gemini") {
        if (!geminiKey) throw new Error("Sem chave Gemini (VITE_GEMINI_API_KEY)");
        result = await analyzeWithGemini(imageBase64, geminiKey, prompt);
      } else if (currentAttempt === "openrouter") {
        if (!openRouterKey) throw new Error("Sem chave OpenRouter (VITE_OPENROUTER_API_KEY)");
        result = await analyzeWithOpenRouter(imageBase64, openRouterKey, prompt);
      }
      
      // Se deu certo num fallback (i > 0), muda a IA ativa no sistema
      if (i > 0) setVisionProvider(currentAttempt);
      return result as GeminiDetectionResult;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.warn(`[Vision API] Provider '${currentAttempt}' falhou: ${lastError}. Tentando próximo...`);
    }
  }

  return { cards: [], tableState: null, rawResponse: "", error: `Todos os providers falharam. Último erro: ${lastError}` };
}

export function formatCardForCalculator(card: GeminiDetectedCard): string {
  return `${card.rank}${card.suit}`;
}
