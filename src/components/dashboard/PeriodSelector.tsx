import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PeriodSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[160px] bg-card border-border">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="24h">Últimas 24h</SelectItem>
        <SelectItem value="48h">Últimas 48h</SelectItem>
        <SelectItem value="7d">Últimos 7 dias</SelectItem>
        <SelectItem value="14d">Últimos 14 dias</SelectItem>
        <SelectItem value="30d">Últimos 30 dias</SelectItem>
      </SelectContent>
    </Select>
  );
}
