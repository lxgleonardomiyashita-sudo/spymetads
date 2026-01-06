import type { ScheduleConfig } from "@/types/monitor";

export function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getScheduleLabel(config: ScheduleConfig): string {
  const windowLabels: Record<string, string> = {
    dawn: 'Madrugada',
    morning: 'Manhã',
    afternoon: 'Tarde',
    evening: 'Noite',
  };
  const windows = config.windows.map(w => windowLabels[w]).filter(Boolean).join('/');
  return `A cada ${config.interval} min • ${windows || '24h'}`;
}

export function getPriorityColor(priority: string): string {
  switch (priority) {
    case "high": return "text-red-500 bg-red-500/10";
    case "medium": return "text-yellow-500 bg-yellow-500/10";
    case "low": return "text-green-500 bg-green-500/10";
    default: return "text-muted-foreground bg-muted";
  }
}

export function getPriorityLabel(priority: string): string {
  switch (priority) {
    case "high": return "Alta";
    case "medium": return "Média";
    case "low": return "Baixa";
    default: return priority;
  }
}
