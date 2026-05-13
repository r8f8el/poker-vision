import { useState } from "react";
import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

/**
 * Página de estatísticas e análise histórica
 * Mostra padrões de mãos analisadas
 */
export default function Statistics() {
  // Dados de exemplo
  const recommendationData = [
    { name: "Fold", value: 35, color: "#EF4444" },
    { name: "Call", value: 28, color: "#FBBF24" },
    { name: "Raise", value: 37, color: "#10B981" },
  ];

  const equityDistribution = [
    { range: "0-20%", count: 12 },
    { range: "20-40%", count: 18 },
    { range: "40-60%", count: 25 },
    { range: "60-80%", count: 20 },
    { range: "80-100%", count: 15 },
  ];

  const handRankStats = [
    { rank: "Pair", count: 28 },
    { rank: "Two Pair", count: 15 },
    { rank: "Three of a Kind", count: 8 },
    { rank: "Straight", count: 12 },
    { rank: "Flush", count: 10 },
    { rank: "Full House", count: 5 },
    { rank: "Four of a Kind", count: 2 },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <Navigation />

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-12 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Estatísticas</h1>
          <p className="text-sm text-gray-600">Análise de mãos analisadas</p>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="equity">Equity</TabsTrigger>
            <TabsTrigger value="hands">Mãos</TabsTrigger>
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview" className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Total Analisado</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">90</div>
                  <p className="text-xs text-gray-500 mt-1">mãos</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Equity Média</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">54%</div>
                  <p className="text-xs text-gray-500 mt-1">chance média</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Recomendação</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">Raise</div>
                  <p className="text-xs text-gray-500 mt-1">mais comum</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Mão Forte</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">41%</div>
                  <p className="text-xs text-gray-500 mt-1">equity &gt; 60%</p>
                </CardContent>
              </Card>
            </div>

            {/* Recommendations Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Distribuição de Recomendações</CardTitle>
                <CardDescription>Proporção de cada tipo de recomendação</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={recommendationData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {recommendationData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Equity */}
          <TabsContent value="equity" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Distribuição de Equity</CardTitle>
                <CardDescription>Quantas mãos caem em cada faixa de equity</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={equityDistribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="range" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#1E40AF" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Equity Máxima</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">99%</div>
                  <p className="text-xs text-gray-500 mt-1">Royal Flush</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Equity Mínima</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">2%</div>
                  <p className="text-xs text-gray-500 mt-1">High Card</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Mediana</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">52%</div>
                  <p className="text-xs text-gray-500 mt-1">valor central</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Hands */}
          <TabsContent value="hands" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Distribuição de Mãos</CardTitle>
                <CardDescription>Frequência de cada tipo de mão detectada</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={handRankStats} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="rank" type="category" width={120} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#10B981" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Mãos Mais Analisadas</CardTitle>
                <CardDescription>Top 10 combinações de hole cards</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[
                    { hand: "AA", count: 8 },
                    { hand: "KK", count: 7 },
                    { hand: "AK", count: 6 },
                    { hand: "QQ", count: 5 },
                    { hand: "JJ", count: 4 },
                    { hand: "AQ", count: 4 },
                    { hand: "TT", count: 3 },
                    { hand: "99", count: 3 },
                    { hand: "88", count: 2 },
                    { hand: "AJ", count: 2 },
                  ].map((item) => (
                    <div key={item.hand} className="flex items-center justify-between">
                      <span className="font-mono font-bold text-lg">{item.hand}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${(item.count / 8) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-600 w-8 text-right">{item.count}x</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
