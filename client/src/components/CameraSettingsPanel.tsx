import { useState } from "react";
import { X, Camera, Zap, ZoomIn, Focus, Flashlight, ChevronDown } from "lucide-react";
import { CameraSettings, CameraDevice, ResolutionPreset } from "@/hooks/useCamera";

interface CameraSettingsPanelProps {
  settings: CameraSettings;
  devices: CameraDevice[];
  capabilities: { zoom: { min: number; max: number; step: number } | null; torch: boolean; focus: boolean };
  onUpdate: (partial: Partial<CameraSettings>) => void;
  onClose: () => void;
}

const RESOLUTIONS: { value: ResolutionPreset; label: string; desc: string }[] = [
  { value: "480p",  label: "480p",  desc: "Rápido, menor qualidade" },
  { value: "720p",  label: "720p",  desc: "Balanceado" },
  { value: "1080p", label: "1080p", desc: "Alta qualidade (recomendado)" },
  { value: "4k",    label: "4K",    desc: "Máxima qualidade" },
];

export function CameraSettingsPanel({ settings, devices, capabilities, onUpdate, onClose }: CameraSettingsPanelProps) {
  const [localZoom, setLocalZoom] = useState(settings.zoom);

  const zoomMin = capabilities.zoom?.min ?? 1;
  const zoomMax = Math.min(capabilities.zoom?.max ?? 4, 8);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-slate-900 rounded-t-3xl border-t border-slate-700/50 shadow-2xl pb-safe"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-slate-600 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-blue-400" />
            <span className="text-white font-bold">Configurações da Câmera</span>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5 overflow-y-auto max-h-[70vh]">

          {/* ── Seleção de Câmera ─────────────────────────────────────────────── */}
          {devices.length > 1 && (
            <div>
              <label className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2 block">
                📷 Câmera
              </label>
              <div className="space-y-2">
                {devices.map(d => (
                  <button
                    key={d.deviceId}
                    onClick={() => onUpdate({ deviceId: d.deviceId })}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition-all text-sm
                      ${settings.deviceId === d.deviceId || (!settings.deviceId && devices.indexOf(d) === 0)
                        ? "bg-blue-600/20 border-blue-500/50 text-blue-300"
                        : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                      }`}
                  >
                    <div className="font-medium">{d.label}</div>
                    <div className="text-xs opacity-60 mt-0.5 font-mono">{d.deviceId.slice(0, 20)}...</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Resolução ─────────────────────────────────────────────────────── */}
          <div>
            <label className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2 block">
              🎬 Resolução
            </label>
            <div className="grid grid-cols-4 gap-2">
              {RESOLUTIONS.map(r => (
                <button
                  key={r.value}
                  onClick={() => onUpdate({ resolution: r.value })}
                  className={`py-3 rounded-xl border text-center transition-all
                    ${settings.resolution === r.value
                      ? "bg-blue-600 border-blue-500 text-white"
                      : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                    }`}
                >
                  <div className="font-bold text-sm">{r.label}</div>
                  <div className="text-xs opacity-60 mt-0.5 leading-tight">{r.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* ── Zoom ────────────────────────────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-slate-400 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <ZoomIn className="w-3.5 h-3.5" /> Zoom
              </label>
              <span className="text-white font-mono font-bold text-sm">{localZoom.toFixed(1)}×</span>
            </div>
            {capabilities.zoom ? (
              <>
                <input
                  type="range"
                  min={zoomMin}
                  max={zoomMax}
                  step={capabilities.zoom.step || 0.1}
                  value={localZoom}
                  onChange={e => setLocalZoom(Number(e.target.value))}
                  onMouseUp={() => onUpdate({ zoom: localZoom })}
                  onTouchEnd={() => onUpdate({ zoom: localZoom })}
                  className="w-full h-2 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>{zoomMin}×</span>
                  <span>{zoomMax}×</span>
                </div>
              </>
            ) : (
              <p className="text-slate-500 text-xs bg-slate-800 rounded-xl px-3 py-2">
                Zoom não suportado nesta câmera/browser
              </p>
            )}
          </div>

          {/* ── Foco ────────────────────────────────────────────────────────────── */}
          <div>
            <label className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2 block flex items-center gap-1.5">
              <Focus className="w-3.5 h-3.5" /> Modo de Foco
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(["continuous", "manual"] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => capabilities.focus && onUpdate({ focusMode: mode })}
                  className={`py-3 rounded-xl border text-sm font-medium transition-all
                    ${!capabilities.focus ? "opacity-40 cursor-not-allowed bg-slate-800 border-slate-700 text-slate-500" :
                      settings.focusMode === mode
                        ? "bg-blue-600 border-blue-500 text-white"
                        : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                    }`}
                >
                  {mode === "continuous" ? "🔄 Automático" : "👆 Toque para focar"}
                </button>
              ))}
            </div>
            {!capabilities.focus && (
              <p className="text-slate-500 text-xs mt-1.5">Controle de foco não suportado nesta câmera</p>
            )}
            {capabilities.focus && settings.focusMode === "manual" && (
              <p className="text-blue-400 text-xs mt-1.5">💡 Toque na tela da câmera para focar</p>
            )}
          </div>

          {/* ── Lanterna ────────────────────────────────────────────────────────── */}
          {capabilities.torch && (
            <div>
              <label className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2 block">
                🔦 Lanterna
              </label>
              <button
                onClick={() => onUpdate({ torchOn: !settings.torchOn })}
                className={`w-full py-3 rounded-xl border text-sm font-medium transition-all
                  ${settings.torchOn
                    ? "bg-yellow-600/30 border-yellow-500/50 text-yellow-300"
                    : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                  }`}
              >
                {settings.torchOn ? "🔆 Lanterna ligada" : "🔅 Lanterna desligada"}
              </button>
            </div>
          )}

          {/* ── Dica ────────────────────────────────────────────────────────────── */}
          <div className="bg-slate-800/50 rounded-xl p-3 text-xs text-slate-400 leading-relaxed">
            💡 <strong className="text-slate-300">Dica:</strong> Use 1080p ou 4K para melhor leitura de cartas.
            Se a câmera ficar travada, feche e reabra o app.
            O zoom nativo da câmera mantém qualidade melhor que o zoom digital.
          </div>

        </div>
      </div>
    </div>
  );
}
