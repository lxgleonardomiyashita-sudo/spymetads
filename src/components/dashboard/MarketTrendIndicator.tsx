import { TrendingUp, TrendingDown, Minus, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface MarketTrendIndicatorProps {
  trend: 'up' | 'down' | 'stable';
  percentage: number;
  period?: string;
}

export function MarketTrendIndicator({ trend, percentage, period = "7 dias" }: MarketTrendIndicatorProps) {
  const getStyles = () => {
    if (trend === 'up') {
      return {
        bg: "bg-success/10 border-success/30",
        text: "text-success",
        icon: <ArrowUpRight className="h-8 w-8" />,
        label: "Em Alta"
      };
    }
    if (trend === 'down') {
      return {
        bg: "bg-destructive/10 border-destructive/30",
        text: "text-destructive",
        icon: <ArrowDownRight className="h-8 w-8" />,
        label: "Em Queda"
      };
    }
    return {
      bg: "bg-muted border-border",
      text: "text-muted-foreground",
      icon: <Minus className="h-8 w-8" />,
      label: "Estável"
    };
  };

  const styles = getStyles();

  return (
    <div className={cn(
      "flex items-center gap-4 p-4 rounded-lg border transition-colors",
      styles.bg
    )}>
      <div className={cn("flex-shrink-0", styles.text)}>
        {styles.icon}
      </div>
      <div className="flex-1">
        <p className={cn("text-lg font-bold", styles.text)}>
          {styles.label}
        </p>
        <p className="text-xs text-muted-foreground">
          Mercado {trend === 'up' ? 'subiu' : trend === 'down' ? 'caiu' : 'manteve'}{" "}
          <span className={cn("font-medium", styles.text)}>
            {Math.abs(percentage).toFixed(1)}%
          </span>{" "}
          nos últimos {period}
        </p>
      </div>
    </div>
  );
}
