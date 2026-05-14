import { useState, useRef, useCallback } from "react";
import { captureFrameAsBase64, analyzeTableWithVision, TableState, GeminiDetectedCard } from "@/lib/visionApi";

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || "";

export interface UseGeminiDetectionResult {
  cards: GeminiDetectedCard[];
  isDetecting: boolean;
  error: string | null;
  detect: (video: HTMLVideoElement) => Promise<void>;
  clear: () => void;
}

export function useGeminiDetection(): UseGeminiDetectionResult {
  const [cards, setCards] = useState<GeminiDetectedCard[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detect = useCallback(async (video: HTMLVideoElement) => {
    if (!GROQ_API_KEY) {
      setError("API Key da Groq não configurada. Crie o arquivo .env com VITE_GROQ_API_KEY.");
      return;
    }
    setIsDetecting(true);
    setError(null);
    try {
      const base64 = captureFrameAsBase64(video);
      if (!base64) { setError("Não foi possível capturar o frame."); return; }
      const result = await analyzeTableWithVision(base64, GROQ_API_KEY);
      if (result.error) { setError(result.error); return; }
      setCards(result.cards);
      if (result.cards.length === 0) setError("Nenhuma carta detectada. Tente novamente.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro na detecção");
    } finally {
      setIsDetecting(false);
    }
  }, []);

  const clear = useCallback(() => { setCards([]); setError(null); }, []);

  return { cards, isDetecting, error, detect, clear };
}
