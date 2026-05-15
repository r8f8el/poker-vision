import { useState, useEffect, useRef } from "react";
import { analyzeHand, HandAnalysis, isValidCard } from "@/lib/pokerCalculator";
import { calculatePotOdds, compareEquityToPotOdds } from "@/lib/advancedCalculations";
import { useCamera } from "@/hooks/useCamera";
import { useAutoScan } from "@/hooks/useAutoScan";
import { PlayingCard, CardPicker } from "@/components/PlayingCard";
import { CameraSettingsPanel } from "@/components/CameraSettingsPanel";
import { Scan, RefreshCw, ChevronUp, ChevronDown, Zap, ZapOff, Radio, X, BarChart3, TrendingUp, Shield, RotateCcw, Settings } from "lucide-react";
import { TableState } from "@/lib/visionApi";
import { analyzePreflopHand, getPreflopHandTier } from "@/lib/preflopCharts";
import { saveHand } from "@/lib/handHistory";
import { Link } from "wouter";

function parseCard(str: string) {
  return { rank: str[0] || "", suit: str[1] || "" };
}

const POSITION_LABEL: Record<string, string> = {
  BTN: "Botão 🎯", SB: "Small Blind", BB: "Big Blind",
  UTG: "Under the Gun", MP: "Middle", CO: "Cutoff",
  HJ: "Hijack", unknown: "Desconhecida",
};

const STREET_LABEL: Record<string, string> = {
  preflop: "Pré-Flop", flop: "Flop", turn: "Turn",
  river: "River", showdown: "Showdown", unknown: "—",
};

const REC_STYLE: Record<string, { gradient: string; textColor: string; badge: string; emoji: string }> = {
  fold:  { gradient: "from-red-950 to-red-900",    textColor: "text-red-300",    badge: "bg-red-500",    emoji: "🚫" },
  call:  { gradient: "from-amber-950 to-amber-900", textColor: "text-amber-300",  badge: "bg-amber-500",  emoji: "📞" },
  raise: { gradient: "from-emerald-950 to-green-900", textColor: "text-emerald-300", badge: "bg-emerald-500", emoji: "📈" },
  check: { gradient: "from-blue-950 to-blue-900",  textColor: "text-blue-300",   badge: "bg-blue-500",   emoji: "✅" },
};

export default function Home() {
  const { videoRef, ready: camReady, error: camError, devices, settings: camSettings, capabilities: camCap, updateSettings: updateCamSettings, tapToFocus } = useCamera();
  const { tableState, isScanning, isAutoMode, error: scanError, rateLimitCountdown, scanCount, lastScanTime, motionDetected, toggleAutoMode, manualScan, reset } = useAutoScan();

  const [showCameraSettings, setShowCameraSettings] = useState(false);
  const [holeCards, setHoleCards] = useState<string[]>(["", ""]);
  const [boardCards, setBoardCards] = useState<string[]>(["", "", "", "", ""]);
  const [editingSlot, setEditingSlot] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [manualMode, setManualMode] = useState(false);
  const lastSavedRef = useRef<string>("");
  const [foldToast, setFoldToast] = useState(false);

  const [analysis, setAnalysis] = useState<HandAnalysis | null>(null);
  const [potOddsInfo, setPotOddsInfo] = useState<ReturnType<typeof compareEquityToPotOdds> | null>(null);

  // SPR calculado
  const spr = tableState?.myStack && tableState?.pot && tableState.pot > 0
    ? (tableState.myStack / tableState.pot).toFixed(1)
    : null;

  // Preflop advice (só quando sem board)
  const validHoleForPreflop = holeCards.filter(c => c.length === 2 && isValidCard(c));
  const preflopAdvice = validHoleForPreflop.length === 2 && boardCards.filter(c => c.length === 2 && isValidCard(c)).length === 0
    ? analyzePreflopHand(validHoleForPreflop, tableState?.myPosition || "BTN", "none")
    : null;
  const preflopTier = validHoleForPreflop.length === 2 ? getPreflopHandTier(validHoleForPreflop) : null;

  useEffect(() => {
    if (!tableState || manualMode) return;

    // ── Fold detectado pela IA ────────────────────────────────────────────────
    if (tableState.playerFolded) {
      setHoleCards(["", ""]);
      setBoardCards(["", "", "", "", ""]);
      setAnalysis(null);
      setPotOddsInfo(null);
      lastSavedRef.current = "";
      setFoldToast(true);
      setTimeout(() => setFoldToast(false), 2500);
      return;
    }

    // ── Sem hole cards visíveis (entre mãos) ─────────────────────────────────
    if (tableState.holeCards.length === 0 && tableState.confidence >= 50) {
      setHoleCards(["", ""]);
      setBoardCards(["", "", "", "", ""]);
      setAnalysis(null);
      setPotOddsInfo(null);
      lastSavedRef.current = "";
      return;
    }

    setHoleCards([tableState.holeCards[0] || "", tableState.holeCards[1] || ""]);
    const b = tableState.board;
    setBoardCards([b[0] || "", b[1] || "", b[2] || "", b[3] || "", b[4] || ""]);
  }, [tableState, manualMode]);

  useEffect(() => {
    const validHole = holeCards.filter(c => c.length === 2 && isValidCard(c));
    const validBoard = boardCards.filter(c => c.length === 2 && isValidCard(c));
    if (validHole.length === 2 && validBoard.length >= 3) {
      try {
        const result = analyzeHand(
          { holeCards: validHole, boardCards: validBoard },
          {
            myStack: tableState?.myStack,
            pot: tableState?.pot,
            toCall: tableState?.toCall,
            position: tableState?.myPosition,
            aiConfidence: tableState?.confidence,
          }
        );
        setAnalysis(result);
        setPanelOpen(true);
        const pot = tableState?.pot || 0;
        const toCall = tableState?.toCall || 0;
        if (pot > 0 && toCall > 0) setPotOddsInfo(compareEquityToPotOdds(result.equity, pot, toCall));
        else setPotOddsInfo(null);

        // Salva no histórico (evita duplicatas da mesma mão)
        const key = `${validHole.join(",")}|${validBoard.join(",")}`;
        if (key !== lastSavedRef.current) {
          lastSavedRef.current = key;
          saveHand({
            holeCards: validHole,
            board: validBoard,
            handRank: result.handRank,
            equity: result.equity,
            outs: result.outs,
            recommendation: result.recommendation,
            confidence: result.confidence,
            pot: tableState?.pot || 0,
            toCall: tableState?.toCall || 0,
            myStack: tableState?.myStack || 0,
            position: tableState?.myPosition || "unknown",
            street: tableState?.street || "unknown",
            platform: tableState?.platform || "unknown",
            aiConfidence: tableState?.confidence || 0,
          });
        }
      } catch { setAnalysis(null); }
    } else {
      setAnalysis(null);
      setPotOddsInfo(null);
    }
  }, [holeCards, boardCards, tableState]);

  const usedCards = [...holeCards, ...boardCards].filter(c => c.length === 2);

  const handleSlotClick = (slot: string) => setEditingSlot(p => p === slot ? null : slot);
  const handleCardSelect = (card: string) => {
    if (!editingSlot) return;
    setManualMode(true);
    const [type, idxStr] = editingSlot.split("-");
    const idx = parseInt(idxStr);
    if (type === "hole") { const n = [...holeCards]; n[idx] = card; setHoleCards(n); }
    else { const n = [...boardCards]; n[idx] = card; setBoardCards(n); }
    setEditingSlot(null);
  };
  const removeCard = (slot: string) => {
    setManualMode(true);
    const [type, idxStr] = slot.split("-");
    const idx = parseInt(idxStr);
    if (type === "hole") { const n = [...holeCards]; n[idx] = ""; setHoleCards(n); }
    else { const n = [...boardCards]; n[idx] = ""; setBoardCards(n); }
  };

  const handleReset = () => {
    reset();
    setHoleCards(["", ""]);
    setBoardCards(["", "", "", "", ""]);
    setAnalysis(null);
    setPotOddsInfo(null);
    setEditingSlot(null);
    setManualMode(false);
    setPanelOpen(true);
    lastSavedRef.current = "";
  };

  // Nova mão: limpa cartas/análise mas MANTÉM auto-scan ativo
  const handleNewHand = () => {
    setHoleCards(["", ""]);
    setBoardCards(["", "", "", "", ""]);
    setAnalysis(null);
    setPotOddsInfo(null);
    setEditingSlot(null);
    setManualMode(false);
    lastSavedRef.current = "";
  };

  const handleToggleAuto = () => {
    if (videoRef.current) {
      toggleAutoMode(videoRef.current);
      if (!isAutoMode) setManualMode(false);
    }
  };

  const handleManualScan = () => {
    if (videoRef.current) {
      setManualMode(false);
      manualScan(videoRef.current);
    }
  };

  const rec = analysis ? (REC_STYLE[analysis.recommendation] ?? REC_STYLE.check) : null;

  return (
    <div className="flex flex-col h-screen bg-slate-950 overflow-hidden select-none">

      {/* ══ CÂMERA ══ */}
      <div className="relative flex-1 bg-black overflow-hidden min-h-0">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline autoPlay muted
          onClick={e => {
            if (camSettings.focusMode === "manual" && camCap.focus) {
              const rect = (e.target as HTMLVideoElement).getBoundingClientRect();
              tapToFocus(e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height);
            }
          }}
        />

        {/* Vinheta */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-transparent to-slate-950/90 pointer-events-none" />

        {/* Header */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-10 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">♠️</span>
            <span className="text-white font-bold tracking-tight">PokerVision</span>
            {isAutoMode && (
              <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs border transition-all
                ${motionDetected
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                  : 'bg-green-500/20 border-green-500/30 text-green-400'
                }`}>
                <Radio className="w-3 h-3 animate-pulse" />
                {motionDetected ? 'Movimento!' : 'AO VIVO'}
              </span>
            )}
            {tableState?.confidence !== undefined && tableState.confidence > 0 && (
              <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs border
                ${tableState.confidence >= 70 ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                  : tableState.confidence >= 40 ? 'bg-amber-500/20 border-amber-500/30 text-amber-400'
                  : 'bg-red-500/20 border-red-500/30 text-red-400'}`}>
                <Shield className="w-3 h-3" />
                IA {tableState.confidence}%
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link href="/statistics">
              <button className="w-8 h-8 rounded-full bg-slate-800/70 backdrop-blur flex items-center justify-center text-slate-400 active:scale-95">
                <BarChart3 className="w-3.5 h-3.5" />
              </button>
            </Link>
            <button
              onClick={() => setShowCameraSettings(true)}
              className="w-8 h-8 rounded-full bg-slate-800/70 backdrop-blur flex items-center justify-center text-slate-400 active:scale-95"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
            <button onClick={handleReset} className="w-8 h-8 rounded-full bg-slate-800/70 backdrop-blur flex items-center justify-center text-slate-400 active:scale-95">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Camera Settings Panel */}
        {showCameraSettings && (
          <CameraSettingsPanel
            settings={camSettings}
            devices={devices}
            capabilities={camCap}
            onUpdate={updateCamSettings}
            onClose={() => setShowCameraSettings(false)}
          />
        )}

        {/* Fold Toast */}
        {foldToast && (
          <div className="absolute inset-x-4 top-24 flex justify-center animate-fade-in z-20">
            <div className="bg-red-900/90 backdrop-blur border border-red-700/60 rounded-2xl px-5 py-3 flex items-center gap-3 shadow-xl">
              <span className="text-2xl">🚫</span>
              <div>
                <p className="text-red-200 font-bold text-sm">Fold detectado</p>
                <p className="text-red-400 text-xs">Aguardando próxima mão...</p>
              </div>
            </div>
          </div>
        )}

        {/* Erro câmera */}
        {camError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8">
            <div className="text-5xl">📷</div>
            <p className="text-slate-400 text-center text-sm">{camError}</p>
          </div>
        )}

        {/* Loading câmera */}
        {!camReady && !camError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Indicador de scan ativo */}
        {isScanning && (
          <div className="absolute inset-0 border-2 border-blue-400/60 pointer-events-none animate-pulse rounded-none" />
        )}

        {/* Scan count badge */}
        {scanCount > 0 && (
          <div className="absolute top-16 right-4 bg-slate-800/80 backdrop-blur rounded-lg px-2 py-1 text-xs text-slate-400">
            {scanCount} scans
            {lastScanTime && ` · ${lastScanTime.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`}
          </div>
        )}

        {/* Status da mesa (quando em auto-scan) */}
        {tableState && !manualMode && (
          <div className="absolute bottom-20 left-4 right-4">
            <div className="bg-slate-900/85 backdrop-blur rounded-2xl p-3 flex flex-wrap gap-2">
              {/* Street */}
              <span className="bg-slate-700 rounded-lg px-2 py-1 text-slate-200 text-xs font-semibold">
                {STREET_LABEL[tableState.street] || tableState.street}
              </span>
              {/* Posição */}
              {tableState.myPosition !== "unknown" && (
                <span className="bg-blue-900/60 border border-blue-700/40 rounded-lg px-2 py-1 text-blue-300 text-xs">
                  {POSITION_LABEL[tableState.myPosition] || tableState.myPosition}
                </span>
              )}
              {/* Pot */}
              {tableState.pot > 0 && (
                <span className="bg-amber-900/60 border border-amber-700/40 rounded-lg px-2 py-1 text-amber-300 text-xs font-mono">
                  Pot: {tableState.pot}
                </span>
              )}
              {/* To call */}
              {tableState.toCall > 0 && (
                <span className="bg-red-900/60 border border-red-700/40 rounded-lg px-2 py-1 text-red-300 text-xs font-mono">
                  Call: {tableState.toCall}
                </span>
              )}
              {/* My turn */}
              {tableState.myTurn && (
                <span className="bg-green-900/60 border border-green-500/40 rounded-lg px-2 py-1 text-green-300 text-xs animate-pulse font-semibold">
                  ⚡ Sua vez!
                </span>
              )}
              {/* Players */}
              {tableState.activePlayers > 0 && (
                <span className="bg-slate-700 rounded-lg px-2 py-1 text-slate-300 text-xs">
                  {tableState.activePlayers} jogadores
                </span>
              )}
            </div>
          </div>
        )}

        {/* Ações dos jogadores */}
        {tableState?.lastActions && tableState.lastActions.length > 0 && !manualMode && (
          <div className="absolute bottom-36 left-4 right-4">
            <div className="bg-slate-900/70 backdrop-blur rounded-xl p-2.5 space-y-1">
              <p className="text-slate-500 text-xs uppercase tracking-wider mb-1.5">Últimas ações</p>
              {tableState.lastActions.slice(-3).map((action, i) => {
                const isFold = action.toLowerCase().includes("fold");
                const isRaise = action.toLowerCase().includes("raise") || action.toLowerCase().includes("bet");
                return (
                  <div key={i} className={`text-xs px-2 py-1 rounded-lg
                    ${isFold ? "text-red-300 bg-red-900/20" : isRaise ? "text-green-300 bg-green-900/20" : "text-slate-300 bg-slate-800/40"}`}>
                    {action}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Botões de controle */}
        {camReady && (
          <div className="absolute bottom-6 left-4 right-4 flex gap-3">
            {/* Auto-scan toggle */}
            <button
              onClick={handleToggleAuto}
              disabled={rateLimitCountdown > 0}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-sm transition-all active:scale-95
                ${isAutoMode
                  ? "bg-green-600 text-white shadow-lg shadow-green-500/25"
                  : rateLimitCountdown > 0
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                  : "bg-slate-700 text-slate-200 hover:bg-slate-600"
                }`}
            >
              {isAutoMode
                ? <><ZapOff className="w-4 h-4" /> Parar Auto</>
                : <><Zap className="w-4 h-4" /> Auto Scan</>
              }
            </button>

            {/* Scan manual */}
            <button
              onClick={handleManualScan}
              disabled={isScanning || rateLimitCountdown > 0}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-sm transition-all active:scale-95
                ${isScanning || rateLimitCountdown > 0
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                  : "bg-blue-600 text-white shadow-lg shadow-blue-500/25 hover:bg-blue-500"
                }`}
            >
              {isScanning
                ? <><div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" /> Analisando</>
                : rateLimitCountdown > 0
                ? <><span className="text-base">⏳</span> Aguarde {rateLimitCountdown}s</>
                : <><Scan className="w-4 h-4" /> Escanear</>
              }
            </button>
          </div>
        )}

        {/* Erro de scan */}
        {scanError && (
          <div className="absolute top-16 left-4 right-4">
            <div className="bg-red-950/90 border border-red-800/50 backdrop-blur rounded-xl p-3 flex items-start gap-2">
              <span className="text-red-300 text-xs flex-1">{scanError}</span>
            </div>
          </div>
        )}
      </div>

      {/* ══ PAINEL INFERIOR ══ */}
      <div className="bg-slate-900 rounded-t-3xl shadow-2xl flex-shrink-0 border-t border-slate-800" style={{ maxHeight: "60vh" }}>

        {/* Handle */}
        <button onClick={() => setPanelOpen(p => !p)} className="w-full flex flex-col items-center pt-2.5 pb-1.5 active:bg-slate-800/30 rounded-t-3xl">
          <div className="w-8 h-1 bg-slate-700 rounded-full mb-1.5" />
          {panelOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-600" /> : <ChevronUp className="w-3.5 h-3.5 text-slate-600" />}
        </button>

        {panelOpen && (
          <div className="overflow-y-auto" style={{ maxHeight: "calc(60vh - 44px)" }}>
            <div className="px-4 pb-6 space-y-4">

              {/* HOLE CARDS */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Suas Cartas</p>
                  <div className="flex items-center gap-2">
                    {(holeCards.some(c => c.length === 2) || analysis) && (
                      <button
                        onClick={handleNewHand}
                        className="flex items-center gap-1 text-xs bg-slate-700/60 hover:bg-slate-700 text-slate-300 rounded-lg px-2 py-1 transition-all active:scale-95"
                      >
                        <RotateCcw className="w-3 h-3" /> Nova Mão
                      </button>
                    )}
                    {manualMode && (
                      <button onClick={() => setManualMode(false)} className="text-xs text-blue-400 flex items-center gap-1">
                        <X className="w-3 h-3" /> manual
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex gap-3">
                  {holeCards.map((card, i) => {
                    const slot = `hole-${i}`;
                    const parsed = card.length === 2 ? parseCard(card) : null;
                    return (
                      <div key={i} className="relative">
                        {parsed
                          ? <PlayingCard rank={parsed.rank} suit={parsed.suit} size="lg" selected={editingSlot === slot} onClick={() => handleSlotClick(slot)} />
                          : <PlayingCard rank="" suit="" size="lg" empty onClick={() => handleSlotClick(slot)} />
                        }
                        {parsed && (
                          <button onClick={() => removeCard(slot)} className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center shadow-lg z-10">
                            <X className="w-2.5 h-2.5 text-white" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* BOARD */}
              <div>
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Mesa (Board)</p>
                <div className="flex gap-2">
                  {boardCards.map((card, i) => {
                    const slot = `board-${i}`;
                    const parsed = card.length === 2 ? parseCard(card) : null;
                    return (
                      <div key={i} className="relative">
                        {parsed
                          ? <PlayingCard rank={parsed.rank} suit={parsed.suit} size="md" selected={editingSlot === slot} onClick={() => handleSlotClick(slot)} />
                          : <PlayingCard rank="" suit="" size="md" empty onClick={() => handleSlotClick(slot)} />
                        }
                        {parsed && (
                          <button onClick={() => removeCard(slot)} className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center shadow-lg z-10">
                            <X className="w-2 h-2 text-white" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* CARD PICKER */}
              {editingSlot && (
                <CardPicker onSelect={handleCardSelect} usedCards={usedCards} onClose={() => setEditingSlot(null)} />
              )}

              {/* PREFLOP GTO ADVICE — só sem board */}
              {preflopAdvice && preflopTier && !editingSlot && (
                <div className={`rounded-2xl p-4 border ${
                  preflopTier.tier === 'premium' ? 'bg-gradient-to-br from-yellow-950 to-amber-900 border-yellow-700/30'
                  : preflopTier.tier === 'strong' ? 'bg-gradient-to-br from-emerald-950 to-green-900 border-emerald-700/30'
                  : preflopTier.tier === 'playable' ? 'bg-gradient-to-br from-blue-950 to-blue-900 border-blue-700/30'
                  : 'bg-gradient-to-br from-red-950 to-red-900 border-red-700/30'
                }`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-slate-400 text-xs uppercase tracking-wider">Preflop GTO</p>
                      <p className={`text-2xl font-black leading-tight ${
                        preflopAdvice.action === 'open' ? 'text-emerald-300'
                        : preflopAdvice.action === '3bet' ? 'text-yellow-300'
                        : preflopAdvice.action === 'call' ? 'text-blue-300'
                        : 'text-red-300'
                      }`}>
                        {preflopAdvice.action === 'open' ? '📤 OPEN' : preflopAdvice.action === '3bet' ? '🔥 3-BET' : preflopAdvice.action === 'call' ? '📞 CALL' : '🚫 FOLD'}
                        {preflopAdvice.betSize && <span className="text-sm font-medium ml-2 opacity-70">{preflopAdvice.betSize}</span>}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-500 text-xs">Tier</p>
                      <p className="text-sm font-bold text-white">{preflopTier.label}</p>
                      {preflopAdvice.frequency && preflopAdvice.frequency < 100 && (
                        <p className="text-xs text-slate-400">{preflopAdvice.frequency}% freq.</p>
                      )}
                    </div>
                  </div>
                  <p className="text-slate-300 text-xs">{preflopAdvice.reasoning}</p>
                  {spr && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-slate-400">
                      <TrendingUp className="w-3 h-3" />
                      SPR: <strong className="text-white ml-0.5">{spr}</strong>
                      <span className="ml-1 opacity-70">{Number(spr) < 3 ? '(stack curto)' : Number(spr) > 15 ? '(stack fundo)' : '(médio)'}</span>
                    </div>
                  )}
                </div>
              )}

              {/* ANÁLISE POSTFLOP */}
              {analysis && rec && !editingSlot && (
                <div className={`rounded-2xl p-4 bg-gradient-to-br ${rec.gradient} border border-white/5`}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-slate-400 text-xs uppercase tracking-wider">Recomendação</p>
                      <p className={`text-3xl font-black ${rec.textColor} leading-tight`}>
                        {rec.emoji} {analysis.recommendation.toUpperCase()}
                      </p>
                      <p className="text-slate-400 text-xs mt-0.5 font-medium">{analysis.handRank}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-500 text-xs">Equity (MC)</p>
                      <p className="text-4xl font-black text-white font-mono leading-none">{analysis.equity}%</p>
                    </div>
                  </div>

                  <div className="w-full bg-slate-800/60 rounded-full h-2.5 mb-3 overflow-hidden">
                    <div
                      className="h-2.5 rounded-full transition-all duration-700"
                      style={{ width: `${analysis.equity}%`, background: "linear-gradient(90deg, #ef4444, #f59e0b, #10b981)", backgroundSize: "200%", backgroundPosition: `${100 - analysis.equity}%` }}
                    />
                  </div>

                  <div className={`grid gap-2 mb-3 ${spr ? 'grid-cols-4' : 'grid-cols-3'}`}>
                    <div className="bg-slate-900/50 rounded-xl p-2.5 text-center">
                      <p className="text-slate-500 text-xs">Outs</p>
                      <p className="text-white font-bold text-lg">{analysis.outs}</p>
                    </div>
                    <div className="bg-slate-900/50 rounded-xl p-2.5 text-center">
                      <p className="text-slate-500 text-xs">Confiança</p>
                      <p className={`font-bold text-sm ${analysis.confidence === "high" ? "text-green-400" : analysis.confidence === "medium" ? "text-amber-400" : "text-red-400"}`}>
                        {analysis.confidence === "high" ? "Alta" : analysis.confidence === "medium" ? "Média" : "Baixa"}
                      </p>
                    </div>
                    <div className="bg-slate-900/50 rounded-xl p-2.5 text-center">
                      <p className="text-slate-500 text-xs">Rank</p>
                      <p className="text-white font-bold text-sm font-mono">#{analysis.strength}</p>
                    </div>
                    {spr && (
                      <div className="bg-slate-900/50 rounded-xl p-2.5 text-center">
                        <p className="text-slate-500 text-xs">SPR</p>
                        <p className={`font-bold text-sm ${Number(spr) < 3 ? 'text-red-400' : Number(spr) > 15 ? 'text-green-400' : 'text-amber-400'}`}>{spr}</p>
                      </div>
                    )}
                  </div>

                  {/* Draws / Outs description */}
                  {(analysis as any).outsDescription?.length > 0 && (
                    <div className="mb-3 space-y-1">
                      {(analysis as any).outsDescription.map((d: string, i: number) => (
                        <div key={i} className="flex items-center gap-1.5 text-xs text-slate-300 bg-slate-800/50 rounded-lg px-2.5 py-1.5">
                          <TrendingUp className="w-3 h-3 text-blue-400 flex-shrink-0" />
                          {d}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* RAISE SIZING */}
                  {analysis.raiseInfo && (
                    <div className="mb-3 rounded-xl bg-emerald-900/40 border border-emerald-600/40 p-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-emerald-300 font-bold text-sm flex items-center gap-1.5">
                          <span className="text-base">📈</span> Quanto subir
                        </p>
                        <span className="text-emerald-400 text-xs bg-emerald-900/60 rounded-lg px-2 py-0.5 font-mono">
                          {analysis.raiseInfo.sizing}
                        </span>
                      </div>
                      <p className="text-white font-black text-2xl font-mono leading-tight">
                        {analysis.raiseInfo.amount > 0 ? analysis.raiseInfo.amount : analysis.raiseInfo.label}
                      </p>
                      <p className="text-emerald-400/80 text-xs mt-1">{analysis.raiseInfo.reasoning}</p>
                    </div>
                  )}

                  {potOddsInfo && tableState && (
                    <div className={`rounded-xl p-3 border text-sm
                      ${potOddsInfo.recommendation === "call" ? "bg-green-900/30 border-green-700/30 text-green-300"
                        : potOddsInfo.recommendation === "fold" ? "bg-red-900/30 border-red-700/30 text-red-300"
                        : "bg-slate-800/50 border-slate-700/30 text-slate-300"}`}>
                      <p className="font-semibold mb-1">💰 Pot Odds</p>
                      <p className="text-xs opacity-90">{potOddsInfo.reason}</p>
                      <div className="flex gap-3 mt-1.5 text-xs opacity-70">
                        <span>Pot: <strong>{tableState.pot}</strong></span>
                        <span>Call: <strong>{tableState.toCall}</strong></span>
                        <span>Break-even: <strong>{Math.round(tableState.toCall / (tableState.pot + tableState.toCall) * 100)}%</strong></span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Estado vazio */}
              {!analysis && !editingSlot && (
                <div className="text-center py-6">
                  {!camReady && !camError ? (
                    <p className="text-slate-500 text-sm">Aguardando câmera...</p>
                  ) : !isAutoMode ? (
                    <div className="space-y-2">
                      <p className="text-slate-500 text-sm">Aponte para as cartas e toque em</p>
                      <p className="text-blue-400 font-semibold">⚡ Auto Scan <span className="text-slate-500 font-normal">para monitoramento contínuo</span></p>
                      <p className="text-slate-600 text-xs">ou toque nas cartas para adicionar manualmente</p>
                    </div>
                  ) : (
                    <p className="text-slate-500 text-sm">Aguardando detecção de cartas...</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
