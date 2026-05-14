import { useState, useEffect } from "react";
import { Link } from "wouter";
import { loadHandHistory, computeStats, clearHistory, HandRecord } from "@/lib/handHistory";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { ArrowLeft, Trash2, RefreshCw, TrendingUp, Target, Layers, Clock } from "lucide-react";

const REC_COLORS: Record<string, string> = {
  fold: "#ef4444", call: "#f59e0b", raise: "#10b981", check: "#3b82f6",
};

const SUIT_SYMBOL: Record<string, string> = { s: "♠", h: "♥", d: "♦", c: "♣" };
const SUIT_COLOR: Record<string, string> = { s: "text-white", h: "text-red-400", d: "text-red-400", c: "text-white" };

function CardBadge({ card }: { card: string }) {
  if (!card || card.length < 2) return null;
  const rank = card[0], suit = card[1];
  return (
    <span className={`font-mono font-bold text-sm ${SUIT_COLOR[suit] || "text-white"}`}>
      {rank}{SUIT_SYMBOL[suit] || suit}
    </span>
  );
}

function HandRow({ hand }: { hand: HandRecord }) {
  const recColor = { fold: "text-red-400", call: "text-amber-400", raise: "text-emerald-400", check: "text-blue-400" }[hand.recommendation] || "text-slate-400";
  const date = new Date(hand.timestamp);
  const timeStr = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const dateStr = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

  return (
    <div className="flex items-center gap-3 py-2.5 px-3 bg-slate-800/40 rounded-xl border border-slate-700/30">
      <div className="flex gap-1">
        {hand.holeCards.map((c, i) => <CardBadge key={i} card={c} />)}
      </div>
      {hand.board.length > 0 && (
        <div className="flex gap-1 opacity-70">
          {hand.board.slice(0, 3).map((c, i) => <CardBadge key={i} card={c} />)}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-slate-300 text-xs truncate">{hand.handRank}</p>
        <p className="text-slate-500 text-xs">{hand.position !== "unknown" ? hand.position : ""} {hand.street !== "unknown" ? "· " + hand.street : ""}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className={`text-sm font-bold ${recColor}`}>{hand.recommendation.toUpperCase()}</p>
        <p className="text-slate-500 text-xs">{hand.equity}% EQ</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-slate-400 text-xs">{timeStr}</p>
        <p className="text-slate-600 text-xs">{dateStr}</p>
      </div>
    </div>
  );
}

export default function Statistics() {
  const [hands, setHands] = useState<HandRecord[]>([]);
  const [tab, setTab] = useState<"overview" | "equity" | "hands" | "history">("overview");

  const reload = () => setHands(loadHandHistory());

  useEffect(() => { reload(); }, []);

  const stats = computeStats(hands);
  const hasData = stats.total > 0;

  const recData = Object.entries(stats.byRecommendation)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value, color: REC_COLORS[name] }));

  const handRankData = Object.entries(stats.byHandRank)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([rank, count]) => ({ rank: rank.replace(" ", "\n"), count }));

  const posData = Object.entries(stats.winRateByPosition)
    .map(([pos, avg]) => ({ pos, avg }))
    .sort((a, b) => b.avg - a.avg);

  const equityTimeline = hands.slice(0, 30).reverse().map((h, i) => ({
    i: i + 1,
    equity: h.equity,
    rec: h.recommendation,
  }));

  const TABS = [
    { id: "overview", label: "Geral", icon: <Target className="w-3.5 h-3.5" /> },
    { id: "equity", label: "Equity", icon: <TrendingUp className="w-3.5 h-3.5" /> },
    { id: "hands", label: "Mãos", icon: <Layers className="w-3.5 h-3.5" /> },
    { id: "history", label: "Histórico", icon: <Clock className="w-3.5 h-3.5" /> },
  ] as const;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-slate-950/95 backdrop-blur border-b border-slate-800">
        <div className="flex items-center justify-between px-4 pt-10 pb-3">
          <div className="flex items-center gap-3">
            <Link href="/">
              <button className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 active:scale-95">
                <ArrowLeft className="w-4 h-4" />
              </button>
            </Link>
            <div>
              <h1 className="text-white font-bold">Estatísticas</h1>
              <p className="text-slate-500 text-xs">{stats.total} mãos analisadas</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={reload} className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 active:scale-95">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            {hasData && (
              <button
                onClick={() => { if (confirm("Limpar todo o histórico?")) { clearHistory(); reload(); } }}
                className="w-8 h-8 rounded-full bg-red-900/40 flex items-center justify-center text-red-400 active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex px-4 pb-3 gap-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all
                ${tab === t.id ? "bg-blue-600 text-white" : "bg-slate-800/60 text-slate-400"}`}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 space-y-4 pb-20">
        {!hasData && (
          <div className="text-center py-16 space-y-3">
            <p className="text-5xl">🃏</p>
            <p className="text-slate-400">Nenhuma mão analisada ainda.</p>
            <p className="text-slate-600 text-sm">Vá para a câmera, detecte suas cartas e as análises aparecerão aqui automaticamente.</p>
            <Link href="/">
              <button className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-xl font-semibold text-sm">
                Analisar mão →
              </button>
            </Link>
          </div>
        )}

        {hasData && tab === "overview" && (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Total de Mãos", value: stats.total, sub: "analisadas", color: "text-blue-400" },
                { label: "Equity Média", value: `${stats.avgEquity}%`, sub: "chance de vitória", color: "text-emerald-400" },
                { label: "Confiança IA", value: `${stats.avgAiConfidence}%`, sub: "precisão média", color: "text-amber-400" },
                { label: "Mais comum", value: Object.entries(stats.byRecommendation).sort((a,b)=>b[1]-a[1])[0]?.[0]?.toUpperCase() || "—", sub: "recomendação", color: "text-purple-400" },
              ].map((kpi) => (
                <div key={kpi.label} className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/30">
                  <p className="text-slate-500 text-xs mb-1">{kpi.label}</p>
                  <p className={`text-2xl font-black ${kpi.color}`}>{kpi.value}</p>
                  <p className="text-slate-600 text-xs mt-0.5">{kpi.sub}</p>
                </div>
              ))}
            </div>

            {/* Pie de recomendações */}
            {recData.length > 0 && (
              <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/30">
                <p className="text-slate-300 font-semibold text-sm mb-3">Distribuição de Ações</p>
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width={120} height={120}>
                    <PieChart>
                      <Pie data={recData} cx="50%" cy="50%" innerRadius={30} outerRadius={55} dataKey="value" paddingAngle={2}>
                        {recData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2">
                    {recData.map((e) => (
                      <div key={e.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: e.color }} />
                          <span className="text-slate-300 text-xs">{e.name}</span>
                        </div>
                        <span className="text-white text-xs font-bold">{e.value}x</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Equity por posição */}
            {posData.length > 0 && (
              <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/30">
                <p className="text-slate-300 font-semibold text-sm mb-3">Equity Média por Posição</p>
                <div className="space-y-2">
                  {posData.map(({ pos, avg }) => (
                    <div key={pos} className="flex items-center gap-3">
                      <span className="text-slate-400 text-xs w-10 flex-shrink-0 font-mono">{pos}</span>
                      <div className="flex-1 bg-slate-700/40 rounded-full h-2">
                        <div className="h-2 rounded-full bg-blue-500" style={{ width: `${avg}%` }} />
                      </div>
                      <span className="text-white text-xs font-bold w-8 text-right">{avg}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {hasData && tab === "equity" && (
          <>
            <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/30">
              <p className="text-slate-300 font-semibold text-sm mb-3">Distribuição de Equity</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stats.equityBuckets} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="range" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, color: "#fff" }} />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {equityTimeline.length > 1 && (
              <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/30">
                <p className="text-slate-300 font-semibold text-sm mb-3">Evolução da Equity (últimas 30 mãos)</p>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={equityTimeline} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="i" tick={{ fill: "#94a3b8", fontSize: 9 }} />
                    <YAxis domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 9 }} />
                    <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, color: "#fff" }} formatter={(v) => [`${v}%`, "Equity"]} />
                    <Line type="monotone" dataKey="equity" stroke="#10b981" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Máxima", value: `${Math.max(...hands.map(h => h.equity))}%` },
                { label: "Média", value: `${stats.avgEquity}%` },
                { label: "Mínima", value: `${Math.min(...hands.map(h => h.equity))}%` },
              ].map(s => (
                <div key={s.label} className="bg-slate-800/50 rounded-2xl p-3 text-center border border-slate-700/30">
                  <p className="text-slate-500 text-xs">{s.label}</p>
                  <p className="text-white font-black text-xl mt-1">{s.value}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {hasData && tab === "hands" && (
          <>
            {handRankData.length > 0 && (
              <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/30">
                <p className="text-slate-300 font-semibold text-sm mb-3">Tipos de Mão Mais Comuns</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={handRankData} layout="vertical" margin={{ top: 0, right: 10, left: 60, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                    <YAxis dataKey="rank" type="category" tick={{ fill: "#94a3b8", fontSize: 10 }} width={60} />
                    <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, color: "#fff" }} />
                    <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/30">
              <p className="text-slate-300 font-semibold text-sm mb-3">Por Street</p>
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(stats.byStreet).map(([street, count]) => (
                  <div key={street} className="text-center">
                    <p className="text-slate-500 text-xs capitalize">{street}</p>
                    <p className="text-white font-bold text-lg">{count}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {hasData && tab === "history" && (
          <div className="space-y-2">
            <p className="text-slate-500 text-xs px-1">Últimas {Math.min(hands.length, 50)} mãos</p>
            {hands.slice(0, 50).map(h => <HandRow key={h.id} hand={h} />)}
          </div>
        )}
      </div>
    </div>
  );
}
