import { useState, useRef, useCallback, useEffect } from "react";
import { analyzeTableWithVision, TableState, RateLimitError, setVisionProvider, getVisionProvider, VisionProvider } from "@/lib/visionApi";
import { captureFrameAsBase64 } from "@/lib/visionApi";

const GROQ_KEY        = import.meta.env.VITE_GROQ_API_KEY        || "";
const GEMINI_KEY      = import.meta.env.VITE_GEMINI_API_KEY      || "";
const OPENROUTER_KEY  = import.meta.env.VITE_OPENROUTER_API_KEY  || "";
const POLL_INTERVAL = 2000;      // verifica movimento a cada 2s (sem chamar API)
const MIN_SCAN_GAP = 15000;      // mínimo 15s entre chamadas à API
const MOTION_THRESHOLD = 8;      // sensibilidade de detecção de movimento (0-100)

export interface UseAutoScanResult {
  tableState: TableState | null;
  isScanning: boolean;
  isAutoMode: boolean;
  error: string | null;
  rateLimitCountdown: number;
  scanCount: number;
  lastScanTime: Date | null;
  motionDetected: boolean;
  visionProvider: VisionProvider;
  toggleAutoMode: (video: HTMLVideoElement) => void;
  manualScan: (video: HTMLVideoElement) => Promise<void>;
  reset: () => void;
  switchProvider: (p: VisionProvider) => void;
}

function hasStateChanged(prev: TableState | null, next: TableState): boolean {
  if (!prev) return true;
  if (prev.board.join() !== next.board.join()) return true;
  if (prev.holeCards.join() !== next.holeCards.join()) return true;
  if (prev.pot !== next.pot) return true;
  if (prev.toCall !== next.toCall) return true;
  if (prev.myTurn !== next.myTurn) return true;
  if (prev.street !== next.street) return true;
  if (prev.lastActions.join() !== next.lastActions.join()) return true;
  return false;
}

/**
 * Compara dois frames e retorna % de pixels diferentes (0-100)
 * Usa canvas downscalado para ser rápido
 */
function computeFrameDiff(
  prev: ImageData,
  curr: ImageData,
  threshold: number = 30
): number {
  const len = prev.data.length;
  let diffCount = 0;
  // Percorre de 4 em 4 (RGBA) e pula de stride em stride para ser rápido
  for (let i = 0; i < len; i += 16) {
    const dr = Math.abs(prev.data[i]     - curr.data[i]);
    const dg = Math.abs(prev.data[i + 1] - curr.data[i + 1]);
    const db = Math.abs(prev.data[i + 2] - curr.data[i + 2]);
    if (dr + dg + db > threshold) diffCount++;
  }
  return (diffCount / (len / 16)) * 100;
}

function captureSmallFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement
): ImageData | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

export function useAutoScan(): UseAutoScanResult {
  const [tableState, setTableState] = useState<TableState | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimitCountdown, setRateLimitCountdown] = useState(0);
  const [scanCount, setScanCount] = useState(0);
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null);
  const [motionDetected, setMotionDetected] = useState(false);
  const [visionProvider, setVisionProviderState] = useState<VisionProvider>(getVisionProvider);

  const switchProvider = useCallback((p: VisionProvider) => {
    setVisionProvider(p);
    setVisionProviderState(p);
  }, []);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isProcessingRef = useRef(false);
  const prevStateRef = useRef<TableState | null>(null);
  const prevFrameRef = useRef<ImageData | null>(null);
  const lastApiCallRef = useRef<number>(0);
  const blockedUntilRef = useRef<number>(0);
  // Canvas pequeno (80x45) para diff rápido
  const diffCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const getDiffCanvas = useCallback(() => {
    if (!diffCanvasRef.current) {
      const c = document.createElement("canvas");
      c.width = 80; c.height = 45;
      diffCanvasRef.current = c;
    }
    return diffCanvasRef.current;
  }, []);

  const clearCountdown = useCallback(() => {
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    setRateLimitCountdown(0);
  }, []);

  const startCountdown = useCallback((seconds: number) => {
    clearCountdown();
    blockedUntilRef.current = Date.now() + seconds * 1000;
    setRateLimitCountdown(seconds);
    countdownRef.current = setInterval(() => {
      const remaining = Math.ceil((blockedUntilRef.current - Date.now()) / 1000);
      if (remaining <= 0) { clearCountdown(); setError(null); }
      else setRateLimitCountdown(remaining);
    }, 1000);
  }, [clearCountdown]);

  const runApiScan = useCallback(async (video: HTMLVideoElement) => {
    if (isProcessingRef.current) return;
    if (Date.now() < blockedUntilRef.current) return;
    if (!GROQ_KEY && !GEMINI_KEY) { setError("Nenhuma API Key configurada."); return; }

    const now = Date.now();
    if (now - lastApiCallRef.current < MIN_SCAN_GAP) return;
    lastApiCallRef.current = now;

    isProcessingRef.current = true;
    setIsScanning(true);
    setError(null);

    try {
      const base64 = captureFrameAsBase64(video);
      if (!base64) return;

      const result = await analyzeTableWithVision(base64, GROQ_KEY, GEMINI_KEY, OPENROUTER_KEY);
      // Sincroniza o provider ativo após possível auto-fallback
      setVisionProviderState(getVisionProvider());
      if (result.error) { setError(result.error); return; }
      if (!result.tableState || result.tableState.confidence < 20) return;

      if (hasStateChanged(prevStateRef.current, result.tableState)) {
        prevStateRef.current = result.tableState;
        setTableState(result.tableState);
        setScanCount(c => c + 1);
        if (navigator.vibrate) navigator.vibrate(50);
      }
      setLastScanTime(new Date());
      setMotionDetected(false);
    } catch (e) {
      if (e instanceof RateLimitError) {
        const wait = Math.max(e.waitSeconds || 30, 30);
        setError(`⏳ Muitas requisições — aguardando ${wait}s`);
        startCountdown(wait);
      } else {
        setError(e instanceof Error ? e.message : "Erro no scan");
      }
    } finally {
      setIsScanning(false);
      isProcessingRef.current = false;
    }
  }, [startCountdown]);

  /** Verifica movimento no frame — chama API só se houver mudança significativa */
  const pollMotion = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.readyState || Date.now() < blockedUntilRef.current) return;

    const canvas = getDiffCanvas();
    const currFrame = captureSmallFrame(video, canvas);
    if (!currFrame) return;

    const prev = prevFrameRef.current;
    prevFrameRef.current = currFrame;

    if (!prev) return; // primeiro frame, sem comparação ainda

    const diff = computeFrameDiff(prev, currFrame);
    const hasMotion = diff > MOTION_THRESHOLD;
    setMotionDetected(hasMotion);

    // Chama API se: há movimento E passaram os 15s mínimos
    if (hasMotion && Date.now() - lastApiCallRef.current >= MIN_SCAN_GAP) {
      runApiScan(video);
    }
  }, [getDiffCanvas, runApiScan]);

  const toggleAutoMode = useCallback((video: HTMLVideoElement) => {
    videoRef.current = video;
    if (isAutoMode) {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
      setIsAutoMode(false);
      setMotionDetected(false);
    } else {
      setIsAutoMode(true);
      prevFrameRef.current = null;
      lastApiCallRef.current = 0;
      // Primeiro scan imediato
      runApiScan(video);
      // Polling leve de movimento a cada 2s
      pollIntervalRef.current = setInterval(pollMotion, POLL_INTERVAL);
    }
  }, [isAutoMode, runApiScan, pollMotion]);

  const manualScan = useCallback(async (video: HTMLVideoElement) => {
    if (Date.now() < blockedUntilRef.current) {
      const remaining = Math.ceil((blockedUntilRef.current - Date.now()) / 1000);
      setError(`⏳ Aguarde ${remaining}s (rate limit)`);
      return;
    }
    lastApiCallRef.current = 0; // força scan manual ignorar o gap
    await runApiScan(video);
  }, [runApiScan]);

  const reset = useCallback(() => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    clearCountdown();
    blockedUntilRef.current = 0;
    lastApiCallRef.current = 0;
    prevFrameRef.current = null;
    setTableState(null);
    setIsAutoMode(false);
    setIsScanning(false);
    setError(null);
    setScanCount(0);
    setLastScanTime(null);
    setMotionDetected(false);
    prevStateRef.current = null;
    isProcessingRef.current = false;
  }, [clearCountdown]);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  return {
    tableState, isScanning, isAutoMode, error, rateLimitCountdown,
    scanCount, lastScanTime, motionDetected,
    visionProvider,
    toggleAutoMode, manualScan, reset, switchProvider,
  };
}
