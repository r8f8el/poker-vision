import { useState } from "react";

/**
 * Componente visual de carta de baralho
 */
const SUIT_COLORS: Record<string, string> = {
  s: "#1e293b", c: "#1e293b", h: "#dc2626", d: "#dc2626",
};
const SUIT_SYMBOLS: Record<string, string> = {
  s: "♠", h: "♥", d: "♦", c: "♣",
};

interface PlayingCardProps {
  rank: string;
  suit: string;
  size?: "sm" | "md" | "lg";
  selected?: boolean;
  onClick?: () => void;
  empty?: boolean;
}

export function PlayingCard({ rank, suit, size = "md", selected, onClick, empty }: PlayingCardProps) {
  const sizes = {
    sm: { card: "w-8 h-11", rank: "text-sm", suit: "text-xs" },
    md: { card: "w-12 h-16", rank: "text-lg", suit: "text-sm" },
    lg: { card: "w-16 h-[88px]", rank: "text-xl", suit: "text-base" },
  };
  const s = sizes[size];
  const color = SUIT_COLORS[suit] || "#1e293b";
  const symbol = SUIT_SYMBOLS[suit] || suit;
  // Exibe "10" no lugar de "T"
  const displayRank = rank === "T" ? "10" : rank;

  if (empty) {
    return (
      <div
        onClick={onClick}
        className={`${s.card} rounded-lg border-2 border-dashed border-slate-600 flex items-center justify-center cursor-pointer hover:border-blue-400 transition-colors`}
      >
        <span className="text-slate-500 text-xl leading-none">+</span>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      style={{ border: selected ? undefined : "1px solid #e2e8f0" }}
      className={`${s.card} rounded-lg bg-white flex flex-col items-center justify-center shadow-md cursor-pointer transition-all select-none
        ${selected ? "ring-2 ring-blue-400 scale-105 shadow-blue-400/30" : ""}
        ${onClick ? "hover:scale-105 active:scale-95" : ""}
      `}
    >
      <span className={`${displayRank === "10" ? "text-base" : s.rank} font-bold leading-none`} style={{ color }}>{displayRank}</span>
      <span className={`${s.suit} leading-none`} style={{ color }}>{symbol}</span>
    </div>
  );
}

/**
 * Seletor visual de cartas (rank → suit)
 */
const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];
// Label de exibição: "T" interno → "10" na UI
const RANK_DISPLAY: Record<string, string> = { T: "10" };

const SUITS = [
  { code: "s", symbol: "♠", color: "#94a3b8" },
  { code: "h", symbol: "♥", color: "#dc2626" },
  { code: "d", symbol: "♦", color: "#dc2626" },
  { code: "c", symbol: "♣", color: "#94a3b8" },
];

interface CardPickerProps {
  onSelect: (card: string) => void;
  usedCards?: string[];
  onClose: () => void;
}

export function CardPicker({ onSelect, usedCards = [], onClose }: CardPickerProps) {
  const [selectedRank, setSelectedRank] = useState<string | null>(null);

  const handleRank = (rank: string) => setSelectedRank(prev => prev === rank ? null : rank);

  const handleSuit = (suit: string) => {
    if (!selectedRank) return;
    const card = `${selectedRank}${suit}`;
    if (!usedCards.includes(card)) {
      onSelect(card);
      setSelectedRank(null);
      onClose();
    }
  };

  return (
    <div className="bg-slate-900 rounded-2xl p-4 w-full">
      <div className="flex items-center justify-between mb-3">
        <span className="text-white font-semibold text-sm">
          {selectedRank ? `Rank ${RANK_DISPLAY[selectedRank] || selectedRank} — escolha o naipe` : "Escolha o rank"}
        </span>
        <button onClick={onClose} className="text-slate-400 text-xl leading-none w-8 h-8 flex items-center justify-center">✕</button>
      </div>

      {/* Ranks grid */}
      <div className="grid grid-cols-7 gap-1 mb-4">
        {RANKS.map(r => {
          const allUsed = SUITS.every(s => usedCards.includes(`${r}${s.code}`));
          return (
            <button
              key={r}
              disabled={allUsed}
              onClick={() => handleRank(r)}
              className={`h-10 rounded-lg text-sm font-bold transition-all
                ${selectedRank === r ? "bg-blue-600 text-white scale-105" : "bg-slate-700 text-slate-200 hover:bg-slate-600"}
                ${allUsed ? "opacity-30 cursor-not-allowed" : "active:scale-95"}
              `}
            >
              {RANK_DISPLAY[r] || r}
            </button>
          );
        })}
      </div>

      {/* Suits row */}
      <div className="grid grid-cols-4 gap-2">
        {SUITS.map(s => {
          const isUsed = selectedRank ? usedCards.includes(`${selectedRank}${s.code}`) : false;
          return (
            <button
              key={s.code}
              disabled={!selectedRank || isUsed}
              onClick={() => handleSuit(s.code)}
              className={`h-16 rounded-xl text-3xl flex items-center justify-center transition-all font-bold
                ${!selectedRank || isUsed ? "bg-slate-800 opacity-40 cursor-not-allowed" : "bg-slate-700 hover:bg-slate-600 active:scale-95"}
              `}
            >
              <span style={{ color: s.color }}>{s.symbol}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
