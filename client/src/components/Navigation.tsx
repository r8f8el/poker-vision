import { Link } from "wouter";
import { BarChart3, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Componente de navegação principal
 */
export function Navigation() {
  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/">
          <a className="flex items-center gap-2 font-bold text-lg text-gray-900 hover:text-blue-600">
            ♠️ PokerVision
          </a>
        </Link>

        <div className="flex items-center gap-2">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <Home className="w-4 h-4" />
              Análise
            </Button>
          </Link>

          <Link href="/statistics">
            <Button variant="ghost" size="sm" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              Estatísticas
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}
