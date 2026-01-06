import { cn } from "@/lib/utils";
import { Activity, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MarketPulseProps {
  temperature: number; // 0-100
  trend: 'up' | 'down' | 'stable';
  avgComparison: number; // % above/below average
  label?: string;
}

export function MarketPulse({ temperature, trend, avgComparison, label = "Pulso do Mercado" }: MarketPulseProps) {
  const getTemperatureColor = () => {
    if (temperature >= 70) return "text-success";
    if (temperature >= 40) return "text-warning";
    return "text-muted-foreground";
  };

  const getTemperatureLabel = () => {
    if (temperature >= 80) return "Muito Aquecido";
    if (temperature >= 60) return "Aquecido";
    if (temperature >= 40) return "Normal";
    if (temperature >= 20) return "Baixo";
    return "Muito Baixo";
  };

  const getTemperatureBg = () => {
    if (temperature >= 70) return "bg-success/20";
    if (temperature >= 40) return "bg-warning/20";
    return "bg-muted";
  };

  const getTrendIcon = () => {
    if (trend === 'up') return <TrendingUp className="h-4 w-4 text-success" />;
    if (trend === 'down') return <TrendingDown className="h-4 w-4 text-destructive" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="metric-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className={cn("h-5 w-5", getTemperatureColor())} />
          <span className="font-medium text-sm text-foreground">{label}</span>
        </div>
        {getTrendIcon()}
      </div>

      {/* Gauge visual */}
      <div className="relative h-3 bg-muted rounded-full overflow-hidden mb-3">
        <div 
          className={cn("absolute left-0 top-0 h-full rounded-full transition-all duration-500", getTemperatureBg())}
          style={{ width: `${temperature}%` }}
        />
        <div 
          className={cn("absolute top-0 h-full w-1 bg-foreground rounded-full transition-all duration-500")}
          style={{ left: `${Math.min(temperature, 98)}%` }}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className={cn("text-lg font-bold", getTemperatureColor())}>
          {getTemperatureLabel()}
        </span>
        <span className="text-xs text-muted-foreground">
          {temperature.toFixed(0)}%
        </span>
      </div>

      {avgComparison !== 0 && (
        <p className="text-xs text-muted-foreground mt-2">
          {avgComparison > 0 ? (
            <span className="text-success">{avgComparison.toFixed(0)}% acima</span>
          ) : (
            <span className="text-destructive">{Math.abs(avgComparison).toFixed(0)}% abaixo</span>
          )}{" "}
          da média dos últimos 30 dias
        </p>
      )}
    </div>
  );
}
