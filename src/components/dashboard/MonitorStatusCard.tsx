import { cn } from "@/lib/utils";
import { Radio, TrendingUp, TrendingDown, Clock } from "lucide-react";
import { TagChip } from "@/components/ui/tag-chip";

interface MonitorStatusCardProps {
  name: string;
  url: string;
  currentCount: number;
  lastReading: string;
  trend: number;
  tags: Array<{ name: string; type: 'nicho' | 'idioma' | 'pais' | 'custom' }>;
  status: 'active' | 'inactive' | 'error';
}

export function MonitorStatusCard({
  name,
  url,
  currentCount,
  lastReading,
  trend,
  tags,
  status,
}: MonitorStatusCardProps) {
  return (
    <div className="metric-card hover:border-primary/30 transition-colors cursor-pointer group">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
            status === 'active' ? "bg-success/10 text-success" : 
            status === 'error' ? "bg-destructive/10 text-destructive" :
            "bg-muted text-muted-foreground"
          )}>
            <Radio className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
              {name}
            </h3>
            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
              {url}
            </p>
          </div>
        </div>
        <div className={cn(
          "status-dot",
          status === 'active' ? "status-dot-active" :
          status === 'error' ? "status-dot-error" :
          "status-dot-inactive"
        )} />
      </div>

      <div className="mt-4 flex items-end justify-between">
        <div>
          <p className="text-2xl font-bold text-foreground">
            {currentCount.toLocaleString('pt-BR')}
          </p>
          <p className="text-xs text-muted-foreground">anúncios ativos</p>
        </div>
        <div className="flex items-center gap-1.5">
          {trend !== 0 && (
            <>
              {trend > 0 ? (
                <TrendingUp className="h-4 w-4 text-success" />
              ) : (
                <TrendingDown className="h-4 w-4 text-destructive" />
              )}
              <span className={cn(
                "text-sm font-medium",
                trend > 0 ? "text-success" : "text-destructive"
              )}>
                {trend > 0 ? "+" : ""}{trend}%
              </span>
            </>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex flex-wrap gap-1.5">
          {tags.slice(0, 3).map((tag, index) => (
            <TagChip key={index} name={tag.name} type={tag.type} size="sm" />
          ))}
          {tags.length > 3 && (
            <span className="text-xs text-muted-foreground">+{tags.length - 3}</span>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{lastReading}</span>
        </div>
      </div>
    </div>
  );
}
