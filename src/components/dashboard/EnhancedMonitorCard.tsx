import { cn } from "@/lib/utils";
import { Radio, TrendingUp, TrendingDown, ExternalLink, Eye } from "lucide-react";
import { TagChip } from "@/components/ui/tag-chip";
import { SparklineChart } from "./SparklineChart";
import { Button } from "@/components/ui/button";

interface EnhancedMonitorCardProps {
  id: string;
  name: string;
  url: string;
  currentCount: number;
  trend: number;
  sparklineData: number[];
  tags: Array<{ name: string; type: 'nicho' | 'idioma' | 'pais' | 'custom' }>;
  status: 'active' | 'inactive' | 'error';
  isSelected?: boolean;
  onViewCreatives?: () => void;
  onSelect?: () => void;
}

export function EnhancedMonitorCard({
  name,
  url,
  currentCount,
  trend,
  sparklineData,
  tags,
  status,
  isSelected,
  onViewCreatives,
  onSelect,
}: EnhancedMonitorCardProps) {
  const getTrendColor = () => {
    if (trend > 5) return 'success';
    if (trend < -5) return 'destructive';
    return 'muted';
  };

  const handleOpenLibrary = () => {
    window.open(url, '_blank');
  };

  return (
    <div 
      className={cn(
        "metric-card hover:border-primary/30 transition-all cursor-pointer group",
        isSelected && "ring-2 ring-primary border-primary"
      )}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg transition-colors flex-shrink-0",
            status === 'active' ? "bg-success/10 text-success" : 
            status === 'error' ? "bg-destructive/10 text-destructive" :
            "bg-muted text-muted-foreground"
          )}>
            <Radio className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
              {name}
            </h3>
            <p className="text-xs text-muted-foreground truncate">
              {url.replace('https://', '').substring(0, 40)}...
            </p>
          </div>
        </div>
        <div className={cn(
          "h-2 w-2 rounded-full flex-shrink-0",
          status === 'active' ? "bg-success animate-pulse" :
          status === 'error' ? "bg-destructive" :
          "bg-muted-foreground"
        )} />
      </div>

      {/* Sparkline */}
      <div className="mb-3 px-1">
        <SparklineChart 
          data={sparklineData} 
          color={getTrendColor()}
          height={32}
        />
      </div>

      <div className="flex items-end justify-between mb-3">
        <div>
          <p className="text-2xl font-bold text-foreground">
            {currentCount.toLocaleString('pt-BR')}
          </p>
          <p className="text-xs text-muted-foreground">anúncios ativos</p>
        </div>
        <div className="flex items-center gap-1">
          {trend !== 0 && (
            <>
              {trend > 0 ? (
                <TrendingUp className="h-4 w-4 text-success" />
              ) : (
                <TrendingDown className="h-4 w-4 text-destructive" />
              )}
              <span className={cn(
                "text-sm font-bold",
                trend > 0 ? "text-success" : "text-destructive"
              )}>
                {trend > 0 ? "+" : ""}{trend}%
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-1">
          {tags.slice(0, 2).map((tag, index) => (
            <TagChip key={index} name={tag.name} type={tag.type} size="sm" />
          ))}
          {tags.length > 2 && (
            <span className="text-xs text-muted-foreground">+{tags.length - 2}</span>
          )}
        </div>
        <div className="flex gap-1">
          <Button 
            size="sm" 
            variant="ghost" 
            className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => { e.stopPropagation(); onViewCreatives?.(); }}
            title="Ver criativos"
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <Button 
            size="sm" 
            variant="ghost" 
            className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => { e.stopPropagation(); handleOpenLibrary(); }}
            title="Abrir Ad Library"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
