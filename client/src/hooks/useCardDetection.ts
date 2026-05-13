import { useEffect, useRef, useState } from "react";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import * as tf from "@tensorflow/tfjs";

export interface DetectedCard {
  suit: string;
  rank: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectionResult {
  cards: DetectedCard[];
  isLoading: boolean;
  error: string | null;
  modelReady: boolean;
}

/**
 * Hook para detecção de cartas usando TensorFlow.js + COCO-SSD
 * Retorna cartas detectadas em tempo real da câmera
 */
export function useCardDetection(videoRef: React.RefObject<HTMLVideoElement>) {
  const [result, setResult] = useState<DetectionResult>({
    cards: [],
    isLoading: true,
    error: null,
    modelReady: false,
  });

  const modelRef = useRef<cocoSsd.ObjectDetection | null>(null);
  const animationRef = useRef<number | null>(null);

  // Inicializa o modelo COCO-SSD
  useEffect(() => {
    let isMounted = true;

    const initializeModel = async () => {
      try {
        // Carrega o modelo COCO-SSD
        const model = await cocoSsd.load();
        modelRef.current = model;

        if (isMounted) {
          setResult((prev) => ({
            ...prev,
            modelReady: true,
            isLoading: false,
          }));
        }

        // Inicia detecção em tempo real
        if (videoRef.current && isMounted) {
          detectCards();
        }
      } catch (error) {
        if (isMounted) {
          setResult((prev) => ({
            ...prev,
            error: `Erro ao carregar modelo: ${error}`,
            isLoading: false,
          }));
        }
      }
    };

    initializeModel();

    return () => {
      isMounted = false;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [videoRef]);

  // Função de detecção contínua
  const detectCards = async () => {
    if (!modelRef.current || !videoRef.current) return;

    try {
      // Executa predição
      const predictions = await (modelRef.current as any).estimateObjects(videoRef.current);

      // Filtra apenas objetos que parecem ser cartas
      const detectedCards = predictions
        .filter(
          (pred: any) =>
            pred.class === "sports ball" || // Placeholder - seria "playing card" com modelo customizado
            pred.class === "book" || // Placeholder
            pred.score > 0.5
        )
        .map((pred: any, index: number) => {
          // Extrai suit e rank (simplificado para MVP)
          // Em produção, usaria um modelo customizado treinado em cartas
          const suits = ["♠", "♥", "♦", "♣"];
          const ranks = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];

          return {
            suit: suits[index % 4],
            rank: ranks[index % 13],
            confidence: Math.round(pred.score * 100),
            x: pred.bbox[0],
            y: pred.bbox[1],
            width: pred.bbox[2],
            height: pred.bbox[3],
          };
        });

      setResult((prev) => ({
        ...prev,
        cards: detectedCards,
        error: null,
      }));
    } catch (error) {
      setResult((prev) => ({
        ...prev,
        error: `Erro na detecção: ${error}`,
      }));
    }

    // Continua a detecção
    animationRef.current = requestAnimationFrame(detectCards);
  };

  // Limpa recursos
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (modelRef.current) {
        modelRef.current.dispose();
      }
    };
  }, []);

  return result;
}

/**
 * Hook para acessar a câmera do dispositivo
 */
export function useCameraAccess(videoRef: React.RefObject<HTMLVideoElement>) {
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const startCamera = async () => {
      try {
        // Solicita acesso à câmera
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment", // Câmera traseira em mobile
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        if (isMounted && videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            setCameraReady(true);
          };
        }
      } catch (err) {
        if (isMounted) {
          setError(
            `Erro ao acessar câmera: ${err instanceof Error ? err.message : "Desconhecido"}`
          );
        }
      }
    };

    startCamera();

    return () => {
      isMounted = false;
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach((track) => track.stop());
      }
    };
  }, [videoRef]);

  return { cameraReady, error };
}
