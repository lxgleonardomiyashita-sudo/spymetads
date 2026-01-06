import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Activity, BarChart2, Target, PieChart } from "lucide-react";

interface BenchmarkingMetricsProps {
  activityIndex: number;
  volatility: number;
  growthRate: number;
  concentration: number;
  topRising: { name: string; change: number }[];
  topFalling: { name: string; change: number }[];
  dominantMonitors: { name: string; share: number }[];
  diversification: { active: number; total: number };
}

export function BenchmarkingMetrics({
  activityIndex,
  volatility,
  growthRate,
  concentration,
  topRising,
  topFalling,
  dominantMonitors,
  diversification,
}: BenchmarkingMetricsProps) {
  const getConcentrationLabel = (hhi: number) => {
    if (hhi < 0.15) return { label: "Baixa", color: "text-success" };
    if (hhi < 0.25) return { label: "Moderada", color: "text-warning" };
    return { label: "Alta", color: "text-destructive" };
  };

  const concentrationInfo = getConcentrationLabel(concentration);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">Métricas de Benchmarking</h2>
      
      {/* Main Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Índice de Atividade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold text-foreground">
              {activityIndex.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
            </span>
            <p className="text-xs text-muted-foreground mt-1">ads/monitor (média)</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BarChart2 className="h-4 w-4" />
              Volatilidade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold text-foreground">
              {volatility.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
            </span>
            <p className="text-xs text-muted-foreground mt-1">desvio padrão</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Taxa de Crescimento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className={`text-2xl font-bold ${growthRate >= 0 ? "text-success" : "text-destructive"}`}>
              {growthRate >= 0 ? "+" : ""}{growthRate.toFixed(1)}%
            </span>
            <p className="text-xs text-muted-foreground mt-1">no período</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              Concentração (HHI)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className={`text-2xl font-bold ${concentrationInfo.color}`}>
              {(concentration * 100).toFixed(0)}%
            </span>
            <p className="text-xs text-muted-foreground mt-1">{concentrationInfo.label}</p>
          </CardContent>
        </Card>
      </div>

      {/* Rising and Falling */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-success flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Monitores em Alta
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topRising.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum monitor em alta</p>
            ) : (
              <ul className="space-y-2">
                {topRising.map((m, i) => (
                  <li key={i} className="flex justify-between items-center">
                    <span className="text-sm text-foreground truncate max-w-[200px]">{m.name}</span>
                    <span className="text-sm font-medium text-success">+{m.change.toFixed(1)}%</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-destructive flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Monitores em Queda
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topFalling.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum monitor em queda</p>
            ) : (
              <ul className="space-y-2">
                {topFalling.map((m, i) => (
                  <li key={i} className="flex justify-between items-center">
                    <span className="text-sm text-foreground truncate max-w-[200px]">{m.name}</span>
                    <span className="text-sm font-medium text-destructive">{m.change.toFixed(1)}%</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dominance and Diversification */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Target className="h-4 w-4" />
              Dominância de Mercado
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dominantMonitors.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum monitor com mais de 20% do mercado</p>
            ) : (
              <ul className="space-y-2">
                {dominantMonitors.map((m, i) => (
                  <li key={i} className="flex justify-between items-center">
                    <span className="text-sm text-foreground truncate max-w-[200px]">{m.name}</span>
                    <span className="text-sm font-medium text-primary">{m.share.toFixed(1)}%</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BarChart2 className="h-4 w-4" />
              Diversificação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground">{diversification.active}</span>
              <span className="text-sm text-muted-foreground">de {diversification.total} monitores ativos</span>
            </div>
            <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${diversification.total > 0 ? (diversification.active / diversification.total) * 100 : 0}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
