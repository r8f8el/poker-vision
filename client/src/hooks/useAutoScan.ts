import { useState, useRef, useCallback, useEffect } from "react";
import { analyzeTableWithGemini, TableState } from "@/lib/geminiVision";
import { captureFrameAsBase64 } from "@/lib/geminiVision";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const AUTO_SCAN_INTERVAL = 4000; // ms entre scans automáticos

export interface UseAutoScanResult {
  tableState: TableState | null;
  isScanning: boolean;
  isAutoMode: boolean;
  error: string | null;
  scanCount: number;
  lastScanTime: Date | null;
  toggleAutoMode: (video: HTMLVideoElement) => void;
  manualScan: (video: HTMLVideoElement) => Promise<void>;
  reset: () => void;
}

/** Verifica se dois estados de mesa são significativamente diferentes */
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
  const [scanCount, setScanCount] = useState(0);
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isProcessingRef = useRef(false);
  const prevStateRef = useRef<TableState | null>(null);

  const runScan = useCallback(async (video: HTMLVideoElement) => {
    if (isProcessingRef.current) return; // evita sobreposição de scans
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

      if (result.error) {
        setError(result.error);
        return;
      }

      if (!result.tableState || result.tableState.confidence < 20) {
        // Confiança muito baixa, ignora
        return;
      }

      // Só atualiza se houver mudança real
      if (hasStateChanged(prevStateRef.current, result.tableState)) {
        prevStateRef.current = result.tableState;
        setTableState(result.tableState);
        setScanCount(c => c + 1);

        // Vibra hapticamente quando detecta mudança (mobile)
        if (navigator.vibrate) navigator.vibrate(50);
      }

      setLastScanTime(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro no scan");
    } finally {
      setIsScanning(false);
      isProcessingRef.current = false;
    }
  }, []);

  const toggleAutoMode = useCallback((video: HTMLVideoElement) => {
    videoRef.current = video;

    if (isAutoMode) {
      // Desliga auto-scan
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      setIsAutoMode(false);
    } else {
      // Liga auto-scan
      setIsAutoMode(true);
      runScan(video); // scan imediato
      intervalRef.current = setInterval(() => {
        if (videoRef.current) runScan(videoRef.current);
      }, AUTO_SCAN_INTERVAL);
    }
  }, [isAutoMode, runScan]);

  const manualScan = useCallback(async (video: HTMLVideoElement) => {
    await runScan(video);
  }, [runScan]);

  const reset = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setTableState(null);
    setIsAutoMode(false);
    setIsScanning(false);
    setError(null);
    setScanCount(0);
    setLastScanTime(null);
    prevStateRef.current = null;
    isProcessingRef.current = false;
  }, []);

  // Cleanup no unmount
  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  return { tableState, isScanning, isAutoMode, error, scanCount, lastScanTime, toggleAutoMode, manualScan, reset };
}
