import { useState, useRef, useCallback, useEffect } from "react";
import { analyzeTableWithGemini, TableState, RateLimitError } from "@/lib/geminiVision";
import { captureFrameAsBase64 } from "@/lib/geminiVision";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const AUTO_SCAN_INTERVAL = 10000; // 10s entre scans (plano gratuito: 15 req/min)
const MIN_SCAN_INTERVAL = 10000;

export interface UseAutoScanResult {
  tableState: TableState | null;
  isScanning: boolean;
  isAutoMode: boolean;
  error: string | null;
  rateLimitCountdown: number; // segundos restantes do backoff
  scanCount: number;
  lastScanTime: Date | null;
  toggleAutoMode: (video: HTMLVideoElement) => void;
  manualScan: (video: HTMLVideoElement) => Promise<void>;
  reset: () => void;
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

export function useAutoScan(): UseAutoScanResult {
  const [tableState, setTableState] = useState<TableState | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimitCountdown, setRateLimitCountdown] = useState(0);
  const [scanCount, setScanCount] = useState(0);
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isProcessingRef = useRef(false);
  const prevStateRef = useRef<TableState | null>(null);
  const blockedUntilRef = useRef<number>(0); // timestamp até quando está bloqueado

  const clearCountdown = useCallback(() => {
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    setRateLimitCountdown(0);
  }, []);

  const startCountdown = useCallback((seconds: number) => {
    clearCountdown();
    setRateLimitCountdown(seconds);
    blockedUntilRef.current = Date.now() + seconds * 1000;
    countdownRef.current = setInterval(() => {
      const remaining = Math.ceil((blockedUntilRef.current - Date.now()) / 1000);
      if (remaining <= 0) {
        clearCountdown();
        setError(null);
      } else {
        setRateLimitCountdown(remaining);
      }
    }, 1000);
  }, [clearCountdown]);

  const runScan = useCallback(async (video: HTMLVideoElement) => {
    if (isProcessingRef.current) return;
    if (Date.now() < blockedUntilRef.current) return; // ainda em backoff
    if (!GEMINI_API_KEY) {
      setError("API Key do Gemini não configurada.");
      return;
    }

    isProcessingRef.current = true;
    setIsScanning(true);
    setError(null);

    try {
      const base64 = captureFrameAsBase64(video);
      if (!base64) { setError("Falha ao capturar frame."); return; }

      const result = await analyzeTableWithGemini(base64, GEMINI_API_KEY);

      if (result.error) { setError(result.error); return; }
      if (!result.tableState || result.tableState.confidence < 20) return;

      if (hasStateChanged(prevStateRef.current, result.tableState)) {
        prevStateRef.current = result.tableState;
        setTableState(result.tableState);
        setScanCount(c => c + 1);
        if (navigator.vibrate) navigator.vibrate(50);
      }
      setLastScanTime(new Date());

    } catch (e) {
      if (e instanceof RateLimitError) {
        const wait = e.waitSeconds || 30;
        setError(`⏳ Rate limit — aguardando ${wait}s para retomar`);
        startCountdown(wait);
      } else {
        setError(e instanceof Error ? e.message : "Erro no scan");
      }
    } finally {
      setIsScanning(false);
      isProcessingRef.current = false;
    }
  }, [startCountdown]);

  const toggleAutoMode = useCallback((video: HTMLVideoElement) => {
    videoRef.current = video;
    if (isAutoMode) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      setIsAutoMode(false);
    } else {
      setIsAutoMode(true);
      runScan(video);
      intervalRef.current = setInterval(() => {
        if (videoRef.current) runScan(videoRef.current);
      }, AUTO_SCAN_INTERVAL);
    }
  }, [isAutoMode, runScan]);

  const manualScan = useCallback(async (video: HTMLVideoElement) => {
    if (Date.now() < blockedUntilRef.current) {
      const remaining = Math.ceil((blockedUntilRef.current - Date.now()) / 1000);
      setError(`⏳ Aguarde ${remaining}s (rate limit)`);
      return;
    }
    await runScan(video);
  }, [runScan]);

  const reset = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    clearCountdown();
    blockedUntilRef.current = 0;
    setTableState(null);
    setIsAutoMode(false);
    setIsScanning(false);
    setError(null);
    setScanCount(0);
    setLastScanTime(null);
    prevStateRef.current = null;
    isProcessingRef.current = false;
  }, [clearCountdown]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  return { tableState, isScanning, isAutoMode, error, rateLimitCountdown, scanCount, lastScanTime, toggleAutoMode, manualScan, reset };
}
