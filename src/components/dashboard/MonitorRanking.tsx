import { TrendingUp, TrendingDown, Crown, Medal } from "lucide-react";
import { cn } from "@/lib/utils";

interface RankedMonitor {
  id: string;
  name: string;
  value: number;
  change?: number;
}

interface MonitorRankingProps {
  title: string;
  type: 'top' | 'rising' | 'falling';
  monitors: RankedMonitor[];
  valueLabel?: string;
}

export function MonitorRanking({ title, type, monitors, valueLabel = "ads" }: MonitorRankingProps) {
  const getIcon = (index: number) => {
    if (index === 0) return <Crown className="h-4 w-4 text-warning" />;
    return <Medal className="h-4 w-4 text-muted-foreground" />;
  };

  const getTrendIcon = () => {
    if (type === 'rising') return <TrendingUp className="h-4 w-4 text-success" />;
    if (type === 'falling') return <TrendingDown className="h-4 w-4 text-destructive" />;
    return null;
  };

  const getChangeColor = (change?: number) => {
    if (!change) return "text-muted-foreground";
    if (change > 0) return "text-success";
    if (change < 0) return "text-destructive";
    return "text-muted-foreground";
  };

  if (monitors.length === 0) {
    return (
      <div className="metric-card">
        <div className="flex items-center gap-2 mb-3">
          {getTrendIcon()}
          <h4 className="font-medium text-sm text-foreground">{title}</h4>
        </div>
        <p className="text-xs text-muted-foreground">Sem dados suficientes</p>
      </div>
    );
  }

  return (
    <div className="metric-card">
      <div className="flex items-center gap-2 mb-3">
        {getTrendIcon()}
        <h4 className="font-medium text-sm text-foreground">{title}</h4>
      </div>
      <div className="space-y-2">
        {monitors.slice(0, 3).map((monitor, index) => (
          <div 
            key={monitor.id}
            className={cn(
              "flex items-center gap-2 p-2 rounded-md transition-colors hover:bg-accent/50 cursor-pointer",
              index === 0 && "bg-accent/30"
            )}
          >
            <span className="text-xs text-muted-foreground w-4">{index + 1}.</span>
            {index < 2 && getIcon(index)}
            <span className="flex-1 text-sm font-medium truncate text-foreground">
              {monitor.name}
            </span>
            <div className="text-right">
              <span className="text-sm font-bold text-foreground">
                {monitor.value.toLocaleString('pt-BR')}
              </span>
              {monitor.change !== undefined && (
                <span className={cn("text-xs ml-1", getChangeColor(monitor.change))}>
                  {monitor.change > 0 ? '+' : ''}{monitor.change}%
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
