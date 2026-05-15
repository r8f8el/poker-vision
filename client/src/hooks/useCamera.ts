import { useRef, useEffect, useState, useCallback } from "react";

export interface CameraDevice {
  deviceId: string;
  label: string;
}

export type ResolutionPreset = "480p" | "720p" | "1080p" | "4k";
export type FocusMode = "continuous" | "manual";

const RESOLUTION_MAP: Record<ResolutionPreset, { width: number; height: number }> = {
  "480p":  { width: 854,  height: 480  },
  "720p":  { width: 1280, height: 720  },
  "1080p": { width: 1920, height: 1080 },
  "4k":    { width: 3840, height: 2160 },
};

export interface CameraSettings {
  deviceId: string | null;
  resolution: ResolutionPreset;
  zoom: number;          // 1.0 – 8.0
  focusMode: FocusMode;
  torchOn: boolean;
}

export const DEFAULT_CAMERA_SETTINGS: CameraSettings = {
  deviceId: null,
  resolution: "1080p",
  zoom: 1.0,
  focusMode: "continuous",
  torchOn: false,
};

function loadSettings(): CameraSettings {
  try {
    const raw = localStorage.getItem("pv_camera_settings");
    if (raw) return { ...DEFAULT_CAMERA_SETTINGS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_CAMERA_SETTINGS };
}

function saveSettings(s: CameraSettings) {
  try { localStorage.setItem("pv_camera_settings", JSON.stringify(s)); } catch { /* ignore */ }
}

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [settings, setSettingsState] = useState<CameraSettings>(loadSettings);
  const [capabilities, setCapabilities] = useState<{
    zoom: { min: number; max: number; step: number } | null;
    torch: boolean;
    focus: boolean;
  }>({ zoom: null, torch: false, focus: false });

  // ── Lista câmeras disponíveis ───────────────────────────────────────────────
  const refreshDevices = useCallback(async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const cams = all
        .filter(d => d.kind === "videoinput")
        .map((d, i) => ({
          deviceId: d.deviceId,
          label: d.label || `Câmera ${i + 1}`,
        }));
      setDevices(cams);
    } catch { /* ignore */ }
  }, []);

  // ── Inicia / reinicia a câmera com os settings atuais ─────────────────────
  const startCamera = useCallback(async (cfg: CameraSettings) => {
    // Para stream anterior
    streamRef.current?.getTracks().forEach(t => t.stop());
    setReady(false);
    setError(null);

    const res = RESOLUTION_MAP[cfg.resolution];
    const constraints: MediaStreamConstraints = {
      video: {
        ...(cfg.deviceId ? { deviceId: { exact: cfg.deviceId } } : { facingMode: "environment" }),
        width:  { ideal: res.width  },
        height: { ideal: res.height },
      },
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // ── Aplica capacidades avançadas (zoom, foco, torch) ──────────────────
      const track = stream.getVideoTracks()[0];
      if (track) {
        const cap = track.getCapabilities?.() as any;
        const newCap = {
          zoom:  cap?.zoom  ? { min: cap.zoom.min,  max: cap.zoom.max,  step: cap.zoom.step  } : null,
          torch: !!cap?.torch,
          focus: !!cap?.focusMode,
        };
        setCapabilities(newCap);

        // Aplica constraints avançadas
        const advanced: any = {};
        if (newCap.zoom && cfg.zoom > 1) advanced.zoom = Math.min(cfg.zoom, cap.zoom.max);
        if (newCap.torch) advanced.torch = cfg.torchOn;
        if (newCap.focus) advanced.focusMode = cfg.focusMode;
        if (Object.keys(advanced).length > 0) {
          await track.applyConstraints({ advanced: [advanced] } as any).catch(() => {});
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setReady(true);
        };
      }

      await refreshDevices();
    } catch (err) {
      setError(`Câmera indisponível: ${err instanceof Error ? err.message : "Permissão negada"}`);
    }
  }, [refreshDevices]);

  // ── Inicializa na montagem ──────────────────────────────────────────────────
  useEffect(() => {
    startCamera(settings);
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Atualiza settings e reinicia câmera ────────────────────────────────────
  const updateSettings = useCallback((partial: Partial<CameraSettings>) => {
    setSettingsState(prev => {
      const next = { ...prev, ...partial };
      saveSettings(next);
      startCamera(next);
      return next;
    });
  }, [startCamera]);

  // ── Tap-to-focus: clique no vídeo foca naquele ponto ──────────────────────
  const tapToFocus = useCallback(async (x: number, y: number, videoW: number, videoH: number) => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !capabilities.focus) return;
    try {
      await (track.applyConstraints as any)({
        advanced: [{
          focusMode: "manual",
          pointsOfInterest: [{ x: x / videoW, y: y / videoH }],
        }],
      });
    } catch { /* device may not support POI */ }
  }, [capabilities.focus]);

  return {
    videoRef,
    ready,
    error,
    devices,
    settings,
    capabilities,
    updateSettings,
    tapToFocus,
    refreshDevices,
  };
}
