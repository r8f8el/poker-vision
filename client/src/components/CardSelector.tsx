import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isValidCard } from "@/lib/pokerCalculator";

interface CardSelectorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];
const SUITS = [
  { code: "s", symbol: "♠", name: "Espadas" },
  { code: "h", symbol: "♥", name: "Copas" },
  { code: "d", symbol: "♦", name: "Ouros" },
  { code: "c", symbol: "♣", name: "Paus" },
];

/**
 * Componente para seleção de cartas com interface visual
 */
export function CardSelector({ value, onChange, placeholder }: CardSelectorProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [selectedRank, setSelectedRank] = useState<string | null>(value[0] || null);
  const [selectedSuit, setSelectedSuit] = useState<string | null>(value[1] || null);

  const handleRankSelect = (rank: string) => {
    setSelectedRank(rank);
    if (selectedSuit) {
      onChange(rank + selectedSuit);
      setShowPicker(false);
    }
  };

  const handleSuitSelect = (suit: string) => {
    setSelectedSuit(suit);
    if (selectedRank) {
      onChange(selectedRank + suit);
      setShowPicker(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase();
    if (val === "" || isValidCard(val) || val.length <= 2) {
      onChange(val);
      if (val.length === 2 && isValidCard(val)) {
        setShowPicker(false);
      }
    }
  };

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={handleInputChange}
        placeholder={placeholder || "Ex: As"}
        maxLength={2}
        className="font-mono text-center text-lg cursor-pointer"
        onFocus={() => setShowPicker(true)}
      />

      {showPicker && (
        <Card className="absolute top-full mt-2 left-0 right-0 p-4 z-50 shadow-lg">
          {/* Ranks */}
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-600 mb-2">Rank</p>
            <div className="grid grid-cols-7 gap-1">
              {RANKS.map((rank) => (
                <button
                  key={rank}
                  onClick={() => handleRankSelect(rank)}
                  className={`p-2 text-sm font-bold rounded border-2 transition-colors ${
                    selectedRank === rank
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"
                  }`}
                >
                  {rank}
                </button>
              ))}
            </div>
          </div>

          {/* Suits */}
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2">Naipe</p>
            <div className="grid grid-cols-4 gap-2">
              {SUITS.map((suit) => (
                <button
                  key={suit.code}
                  onClick={() => handleSuitSelect(suit.code)}
                  className={`p-3 text-2xl rounded border-2 transition-colors ${
                    selectedSuit === suit.code
                      ? "bg-blue-600 border-blue-600"
                      : "bg-gray-100 border-gray-300 hover:bg-gray-200"
                  }`}
                  title={suit.name}
                >
                  {suit.symbol}
                </button>
              ))}
            </div>
          </div>

          {/* Close button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPicker(false)}
            className="w-full mt-4"
          >
            Fechar
          </Button>
        </Card>
      )}
    </div>
  );
}
