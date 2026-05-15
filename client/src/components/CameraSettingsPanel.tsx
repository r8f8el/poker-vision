import { useState } from "react";
import { X, Camera, ZoomIn, Focus, Brain } from "lucide-react";
import { CameraSettings, CameraDevice, ResolutionPreset } from "@/hooks/useCamera";
import { VisionProvider } from "@/lib/visionApi";

interface CameraSettingsPanelProps {
  settings: CameraSettings;
  devices: CameraDevice[];
  capabilities: { zoom: { min: number; max: number; step: number } | null; torch: boolean; focus: boolean };
  onUpdate: (partial: Partial<CameraSettings>) => void;
  onClose: () => void;
  visionProvider: VisionProvider;
  onSwitchProvider: (p: VisionProvider) => void;
}

const RESOLUTIONS: { value: ResolutionPreset; label: string; desc: string }[] = [
  { value: "480p",  label: "480p",  desc: "Rápido" },
  { value: "720p",  label: "720p",  desc: "Médio" },
  { value: "1080p", label: "1080p", desc: "Recomendado" },
  { value: "4k",    label: "4K",    desc: "Máximo" },
];

const AI_PROVIDERS: { id: VisionProvider; name: string; model: string; desc: string; color: string }[] = [
  {
    id: "groq",
    name: "Groq",
    model: "Llama 4 Scout",
    desc: "Ultra-rápido • 30 req/min grátis",
    color: "orange",
  },
  {
    id: "gemini",
    name: "Google Gemini",
    model: "Gemini 2.5 Flash",
    desc: "Alta precisão • 15 req/min grátis",
    color: "blue",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    model: "Gemini 2.0 Flash Lite",
    desc: "100+ modelos • Rápido e Grátis",
    color: "purple",
  },
];

export function CameraSettingsPanel({
  settings, devices, capabilities, onUpdate, onClose,
  visionProvider, onSwitchProvider,
}: CameraSettingsPanelProps) {
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
            <span className="text-white font-bold">Configurações</span>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5 overflow-y-auto max-h-[75vh]">

          {/* ── IA de Visão ───────────────────────────────────────────────────── */}
          <div>
            <label className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Brain className="w-3.5 h-3.5" /> IA de Visão
            </label>
            <div className="grid grid-cols-3 gap-2">
              {AI_PROVIDERS.map(p => {
                const active = visionProvider === p.id;
                const colorMap: Record<string, { bg: string; border: string; text: string; badge: string }> = {
                  orange: { bg: "bg-orange-600/20", border: "border-orange-500/60", text: "text-orange-300", badge: "bg-orange-500/30 text-orange-300" },
                  blue:   { bg: "bg-blue-600/20",   border: "border-blue-500/60",   text: "text-blue-300",   badge: "bg-blue-500/30 text-blue-300"   },
                  purple: { bg: "bg-purple-600/20",  border: "border-purple-500/60", text: "text-purple-300", badge: "bg-purple-500/30 text-purple-300" },
                };
                const c = colorMap[p.color] ?? colorMap.blue;
                return (
                  <button
                    key={p.id}
                    onClick={() => onSwitchProvider(p.id)}
                    className={`relative text-left p-3 rounded-xl border transition-all
                      ${active ? `${c.bg} ${c.border}` : "bg-slate-800 border-slate-700 hover:bg-slate-700"}`}
                  >
                    {active && (
                      <span className={`absolute top-2 right-2 text-xs px-1.5 py-0.5 rounded-full font-bold ${c.badge}`}>
                        ✓
                      </span>
                    )}
                    <p className={`font-bold text-sm ${active ? c.text : "text-slate-200"}`}>{p.name}</p>
                    <p className="text-slate-400 text-xs mt-0.5">{p.model}</p>
                    <p className="text-slate-500 text-xs mt-1 leading-tight">{p.desc}</p>
                  </button>
                );
              })}
            </div>
            <p className="text-slate-500 text-xs mt-1.5">
              💡 Se um atingir o limite, o app troca automaticamente.
            </p>
          </div>

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
                  <div className="text-xs opacity-60 mt-0.5">{r.desc}</div>
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
                  <span>{zoomMin}×</span><span>{zoomMax}×</span>
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
            <label className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
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
                  {mode === "continuous" ? "🔄 Automático" : "👆 Toque p/ focar"}
                </button>
              ))}
            </div>
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

          {/* Dica */}
          <div className="bg-slate-800/50 rounded-xl p-3 text-xs text-slate-400 leading-relaxed">
            💡 <strong className="text-slate-300">Dica:</strong> Use 1080p ou 4K com Gemini para máxima precisão na leitura de cartas.
          </div>
        </div>
      </div>
    </div>
  );
}
