import { AlertTriangle, TrendingUp, TrendingDown, Zap, Clock, Target } from "lucide-react";
import { cn } from "@/lib/utils";

interface Insight {
  id: string;
  type: 'alert' | 'growth' | 'decline' | 'info' | 'opportunity';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  monitorName?: string;
  value?: number;
}

interface QuickInsightsProps {
  insights: Insight[];
}

export function QuickInsights({ insights }: QuickInsightsProps) {
  const getIcon = (type: Insight['type']) => {
    switch (type) {
      case 'alert':
        return <AlertTriangle className="h-4 w-4" />;
      case 'growth':
        return <TrendingUp className="h-4 w-4" />;
      case 'decline':
        return <TrendingDown className="h-4 w-4" />;
      case 'opportunity':
        return <Target className="h-4 w-4" />;
      default:
        return <Zap className="h-4 w-4" />;
    }
  };

  const getStyles = (type: Insight['type'], priority: Insight['priority']) => {
    const baseStyles = "flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer hover:bg-accent/50";
    
    if (priority === 'high') {
      return cn(baseStyles, "border-destructive/30 bg-destructive/5 text-destructive");
    }
    if (type === 'growth' || type === 'opportunity') {
      return cn(baseStyles, "border-success/30 bg-success/5 text-success");
    }
    if (type === 'decline') {
      return cn(baseStyles, "border-warning/30 bg-warning/5 text-warning");
    }
    return cn(baseStyles, "border-primary/30 bg-primary/5 text-primary");
  };

  if (insights.length === 0) {
    return (
      <div className="flex items-center justify-center p-6 text-muted-foreground text-sm">
        <Clock className="h-4 w-4 mr-2" />
        Nenhum insight significativo no momento
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      {insights.slice(0, 4).map((insight) => (
        <div key={insight.id} className={getStyles(insight.type, insight.priority)}>
          <div className="mt-0.5">{getIcon(insight.type)}</div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm leading-tight">{insight.title}</p>
            <p className="text-xs opacity-80 mt-0.5 line-clamp-2">{insight.description}</p>
          </div>
          {insight.value !== undefined && (
            <span className="text-sm font-bold whitespace-nowrap">
              {insight.value > 0 ? '+' : ''}{insight.value}%
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
