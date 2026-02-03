import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricExplainerProps {
  title: string;
  explanation: string;
  interpretation?: string;
  className?: string;
}

export function MetricExplainer({ 
  title, 
  explanation, 
  interpretation,
  className 
}: MetricExplainerProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button className={cn("inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors", className)}>
          <span className="text-sm font-medium">{title}</span>
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs p-3">
        <div className="space-y-2">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{explanation}</p>
          {interpretation && (
            <p className="text-xs text-primary/80 italic">{interpretation}</p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// Pre-defined metrics with explanations
export const METRIC_EXPLANATIONS = {
  activityIndex: {
    title: "Índice de Atividade",
    explanation: "Média de anúncios ativos por monitor. Indica o nível geral de investimento em ads.",
    interpretation: "↑ Alto = mercado aquecido | ↓ Baixo = mercado frio",
  },
  volatility: {
    title: "Volatilidade",
    explanation: "Desvio padrão da quantidade de anúncios. Mede a estabilidade do mercado.",
    interpretation: "↑ Alta = mercado instável | ↓ Baixa = mercado estável",
  },
  growthRate: {
    title: "Taxa de Crescimento",
    explanation: "Variação percentual média dos anúncios no período selecionado.",
    interpretation: "↑ Positivo = expansão | ↓ Negativo = contração",
  },
  concentration: {
    title: "Concentração (HHI)",
    explanation: "Índice Herfindahl-Hirschman. Mede o quanto o mercado está concentrado em poucos players.",
    interpretation: "< 0.15 = disperso | 0.15-0.25 = moderado | > 0.25 = concentrado",
  },
  totalAds: {
    title: "Total de Anúncios",
    explanation: "Soma de todos os anúncios ativos dos monitores filtrados.",
    interpretation: "Volume total de investimento em ads no mercado monitorado",
  },
  avgAds: {
    title: "Média por Monitor",
    explanation: "Total de anúncios dividido pelo número de monitores.",
    interpretation: "Benchmark de quantos ads cada competidor costuma ter",
  },
};