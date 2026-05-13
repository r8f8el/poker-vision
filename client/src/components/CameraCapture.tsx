import { useRef, useEffect } from "react";
import { useCameraAccess, useCardDetection, DetectedCard } from "@/hooks/useCardDetection";
import { AlertCircle, Camera } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CameraCaptureProps {
  onCardsDetected?: (cards: DetectedCard[]) => void;
  isActive: boolean;
}

/**
 * Componente de câmera para captura e detecção de cartas
 * Usa TensorFlow.js para detecção em tempo real
 */
export function CameraCapture({ onCardsDetected, isActive }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Acessa câmera do dispositivo
  const { cameraReady, error: cameraError } = useCameraAccess(videoRef as React.RefObject<HTMLVideoElement>);

  // Detecta cartas em tempo real
  const { cards, isLoading, error: detectionError, modelReady } = useCardDetection(
    videoRef as React.RefObject<HTMLVideoElement>
  );

  // Notifica quando cartas são detectadas
  useEffect(() => {
    if (cards.length > 0 && onCardsDetected) {
      onCardsDetected(cards);
    }
  }, [cards, onCardsDetected]);

  // Desenha cartas detectadas no canvas
  useEffect(() => {
    if (!canvasRef.current || !videoRef.current || cards.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Limpa canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Desenha retângulo ao redor de cada carta detectada
    cards.forEach((card) => {
      // Desenha retângulo
      ctx.strokeStyle = "#10B981"; // Verde
      ctx.lineWidth = 3;
      ctx.strokeRect(card.x, card.y, card.width, card.height);

      // Desenha label com suit e rank
      ctx.fillStyle = "#10B981";
      ctx.font = "bold 16px Inter";
      ctx.fillText(`${card.rank}${card.suit}`, card.x + 5, card.y - 5);

      // Desenha confiança
      ctx.fillStyle = "#6B7280";
      ctx.font = "12px Inter";
      ctx.fillText(`${card.confidence}%`, card.x + 5, card.y + card.height + 20);
    });
  }, [cards]);

  if (!isActive) {
    return (
      <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
        <Camera className="w-12 h-12 mx-auto text-gray-400 mb-3" />
        <p className="text-gray-600">Câmera desativada</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Erros */}
      {(cameraError || detectionError) && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{cameraError || detectionError}</AlertDescription>
        </Alert>
      )}

      {/* Status de carregamento */}
      {isLoading && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
          Carregando modelo de detecção...
        </div>
      )}

      {/* Container de câmera */}
      <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
        {/* Vídeo da câmera */}
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          autoPlay
          muted
        />

        {/* Canvas para desenhar detecções */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          width={1280}
          height={720}
        />

        {/* Overlay com instruções */}
        {cameraReady && modelReady && (
          <div className="absolute bottom-4 left-4 right-4 bg-black/50 text-white text-sm p-3 rounded">
            {cards.length > 0
              ? `${cards.length} carta(s) detectada(s)`
              : "Aponte a câmera para as cartas"}
          </div>
        )}

        {/* Indicador de carregamento */}
        {!cameraReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="text-white text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2" />
              <p>Iniciando câmera...</p>
            </div>
          </div>
        )}
      </div>

      {/* Info de cartas detectadas */}
      {cards.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="font-semibold text-green-900 mb-2">Cartas Detectadas:</h3>
          <div className="flex gap-2 flex-wrap">
            {cards.map((card, idx) => (
              <div
                key={idx}
                className="bg-white border border-green-300 rounded px-3 py-1 text-sm font-mono"
              >
                {card.rank}
                {card.suit} <span className="text-gray-500">({card.confidence}%)</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
