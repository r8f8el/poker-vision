import { HandAnalysis } from "@/lib/pokerCalculator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, AlertCircle, CheckCircle } from "lucide-react";

interface PokerAnalysisProps {
  analysis: HandAnalysis | null;
  isLoading?: boolean;
}

/**
 * Componente que exibe análise detalhada de uma mão de poker
 */
export function PokerAnalysis({ analysis, isLoading }: PokerAnalysisProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analysis) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-gray-500">Nenhuma análise disponível</p>
        </CardContent>
      </Card>
    );
  }

  // Cores baseadas na recomendação
  const recommendationColors = {
    fold: "bg-red-50 border-red-200",
    call: "bg-yellow-50 border-yellow-200",
    raise: "bg-green-50 border-green-200",
    check: "bg-blue-50 border-blue-200",
  };

  const recommendationBadgeColors = {
    fold: "bg-red-100 text-red-800",
    call: "bg-yellow-100 text-yellow-800",
    raise: "bg-green-100 text-green-800",
    check: "bg-blue-100 text-blue-800",
  };

  const confidenceColors = {
    high: "text-green-600",
    medium: "text-yellow-600",
    low: "text-red-600",
  };

  return (
    <div className="space-y-4">
      {/* Card Principal - Recomendação */}
      <Card className={`border-2 ${recommendationColors[analysis.recommendation]}`}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>Recomendação</CardTitle>
              <CardDescription>{analysis.handRank}</CardDescription>
            </div>
            <Badge className={recommendationBadgeColors[analysis.recommendation]}>
              {analysis.recommendation.toUpperCase()}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            {analysis.recommendation === "fold" ? (
              <AlertCircle className="w-5 h-5 text-red-600" />
            ) : (
              <CheckCircle className="w-5 h-5 text-green-600" />
            )}
            <p className="text-sm text-gray-700">
              {getRecommendationText(analysis.recommendation)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Grid de Métricas */}
      <div className="grid grid-cols-2 gap-4">
        {/* Equity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Equity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-blue-600">{analysis.equity}%</span>
              <span className="text-xs text-gray-500">chance de vitória</span>
            </div>
            {/* Barra de progresso */}
            <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${analysis.equity}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Outs */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Outs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-green-600">{analysis.outs}</span>
              <span className="text-xs text-gray-500">cartas melhoram</span>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              {analysis.outs > 8 ? "Muitos outs" : analysis.outs > 4 ? "Outs moderados" : "Poucos outs"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Força da Mão */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Força da Mão
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Posição no ranking</span>
              <span className="font-mono text-sm">
                {analysis.strength} / 7462
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-purple-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${((7462 - analysis.strength) / 7462) * 100}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Quanto menor o número, mais forte a mão
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Confiança */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Confiança</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${
                analysis.confidence === "high"
                  ? "bg-green-600"
                  : analysis.confidence === "medium"
                    ? "bg-yellow-600"
                    : "bg-red-600"
              }`}
            />
            <span className={`font-medium ${confidenceColors[analysis.confidence]}`}>
              {analysis.confidence === "high"
                ? "Alta"
                : analysis.confidence === "medium"
                  ? "Média"
                  : "Baixa"}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {getConfidenceText(analysis.confidence)}
          </p>
        </CardContent>
      </Card>

      {/* Dicas */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-blue-900">Dica</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-blue-800">{getTip(analysis)}</p>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Retorna texto explicativo para a recomendação
 */
function getRecommendationText(recommendation: string): string {
  const texts = {
    fold: "Sua mão tem baixa probabilidade de vitória. Considere desistir.",
    call: "Sua mão tem potencial razoável. Acompanhe a aposta.",
    raise: "Sua mão é forte. Considere aumentar a aposta.",
    check: "Sem aposta anterior. Você pode passar ou apostar.",
  };
  return texts[recommendation as keyof typeof texts] || "";
}

/**
 * Retorna texto sobre confiança
 */
function getConfidenceText(confidence: string): string {
  const texts = {
    high: "A recomendação é baseada em dados sólidos",
    medium: "A recomendação tem margem de incerteza",
    low: "Considere outros fatores além da probabilidade",
  };
  return texts[confidence as keyof typeof texts] || "";
}

/**
 * Retorna dica estratégica baseada na análise
 */
function getTip(analysis: HandAnalysis): string {
  if (analysis.equity > 70) {
    return "Você tem uma mão forte. Maximize o valor aumentando as apostas.";
  } else if (analysis.equity > 50) {
    return "Sua mão está ligeiramente à frente. Jogue com cuidado.";
  } else if (analysis.outs > 8) {
    return "Você tem um draw forte. Considere as pot odds antes de chamar.";
  } else if (analysis.equity < 30) {
    return "Sua mão é fraca. Fold geralmente é a melhor opção.";
  }
  return "Considere a posição e o comportamento dos oponentes.";
}
