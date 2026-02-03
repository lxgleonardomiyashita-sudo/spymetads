import { TrendingUp, TrendingDown, Minus, Activity, Target, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface QuickStatsBarProps {
  totalAds: number;
  totalMonitors: number;
  avgAds: number;
  growthRate: number;
  concentration: number;
}

export function QuickStatsBar({
  totalAds,
  totalMonitors,
  avgAds,
  growthRate,
  concentration,
}: QuickStatsBarProps) {
  const getGrowthColor = () => {
    if (growthRate > 5) return "text-success";
    if (growthRate < -5) return "text-destructive";
    return "text-muted-foreground";
  };

  const getConcentrationLabel = () => {
    if (concentration > 0.25) return { label: "Concentrado", color: "text-destructive" };
    if (concentration > 0.15) return { label: "Moderado", color: "text-warning" };
    return { label: "Disperso", color: "text-success" };
  };

  const concentrationInfo = getConcentrationLabel();

  return (
    <div className="flex flex-wrap items-center gap-4 p-3 bg-card/50 rounded-lg border border-border/50">
      {/* Total Ads */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 cursor-help">
            <Activity className="h-4 w-4 text-primary" />
            <div>
              <p className="text-lg font-bold text-foreground">{totalAds.toLocaleString('pt-BR')}</p>
              <p className="text-[10px] text-muted-foreground leading-none">anúncios</p>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent>Total de anúncios ativos monitorados</TooltipContent>
      </Tooltip>

      <div className="h-8 w-px bg-border" />

      {/* Monitors */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 cursor-help">
            <Users className="h-4 w-4 text-chart-2" />
            <div>
              <p className="text-lg font-bold text-foreground">{totalMonitors}</p>
              <p className="text-[10px] text-muted-foreground leading-none">monitores</p>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent>Número de competidores monitorados</TooltipContent>
      </Tooltip>

      <div className="h-8 w-px bg-border" />

      {/* Average */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 cursor-help">
            <Target className="h-4 w-4 text-chart-3" />
            <div>
              <p className="text-lg font-bold text-foreground">{avgAds.toLocaleString('pt-BR')}</p>
              <p className="text-[10px] text-muted-foreground leading-none">média/monitor</p>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent>Média de anúncios por monitor (benchmark)</TooltipContent>
      </Tooltip>

      <div className="h-8 w-px bg-border" />

      {/* Growth */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 cursor-help">
            {growthRate > 0 ? (
              <TrendingUp className={cn("h-4 w-4", getGrowthColor())} />
            ) : growthRate < 0 ? (
              <TrendingDown className={cn("h-4 w-4", getGrowthColor())} />
            ) : (
              <Minus className="h-4 w-4 text-muted-foreground" />
            )}
            <div>
              <p className={cn("text-lg font-bold", getGrowthColor())}>
                {growthRate > 0 ? '+' : ''}{growthRate.toFixed(1)}%
              </p>
              <p className="text-[10px] text-muted-foreground leading-none">crescimento</p>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent>Taxa de crescimento no período selecionado</TooltipContent>
      </Tooltip>

      <div className="h-8 w-px bg-border" />

      {/* Concentration */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 cursor-help">
            <div className={cn(
              "h-3 w-3 rounded-full",
              concentration > 0.25 ? "bg-destructive" :
              concentration > 0.15 ? "bg-warning" : "bg-success"
            )} />
            <div>
              <p className={cn("text-lg font-bold", concentrationInfo.color)}>
                {(concentration * 100).toFixed(0)}%
              </p>
              <p className="text-[10px] text-muted-foreground leading-none">{concentrationInfo.label}</p>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p>Índice de Concentração (HHI)</p>
            <p className="text-xs text-muted-foreground">
              Mede quanto o mercado está dominado por poucos players
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}