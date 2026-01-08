import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

interface PeriodSelectorProps {
  value: string;
  onChange: (value: string) => void;
  customRange?: { from: Date; to: Date } | null;
  onCustomRangeChange?: (range: { from: Date; to: Date } | null) => void;
}

export function PeriodSelector({ value, onChange, customRange, onCustomRangeChange }: PeriodSelectorProps) {
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const [tempRange, setTempRange] = useState<{ from?: Date; to?: Date }>({});

  const handleSelectChange = (newValue: string) => {
    if (newValue === "custom") {
      setIsCustomOpen(true);
    } else {
      onChange(newValue);
      onCustomRangeChange?.(null);
    }
  };

  const handleApplyCustomRange = () => {
    if (tempRange.from && tempRange.to) {
      onCustomRangeChange?.({ from: tempRange.from, to: tempRange.to });
      onChange("custom");
      setIsCustomOpen(false);
    }
  };

  const getDisplayValue = () => {
    if (value === "custom" && customRange) {
      return `${format(customRange.from, "dd/MM", { locale: ptBR })} - ${format(customRange.to, "dd/MM", { locale: ptBR })}`;
    }
    const labels: Record<string, string> = {
      "today": "Hoje",
      "yesterday": "Ontem",
      "3d": "Últimos 3 dias",
      "7d": "Últimos 7 dias",
      "14d": "Últimos 14 dias",
      "30d": "Últimos 30 dias",
      "60d": "Últimos 60 dias",
      "90d": "Últimos 90 dias",
    };
    return labels[value] || value;
  };

  return (
    <Popover open={isCustomOpen} onOpenChange={setIsCustomOpen}>
      <Select value={value} onValueChange={handleSelectChange}>
        <SelectTrigger className="w-[180px] bg-card border-border">
          <SelectValue>{getDisplayValue()}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="today">Hoje</SelectItem>
          <SelectItem value="yesterday">Ontem</SelectItem>
          <SelectItem value="3d">Últimos 3 dias</SelectItem>
          <SelectItem value="7d">Últimos 7 dias</SelectItem>
          <SelectItem value="14d">Últimos 14 dias</SelectItem>
          <SelectItem value="30d">Últimos 30 dias</SelectItem>
          <SelectItem value="60d">Últimos 60 dias</SelectItem>
          <SelectItem value="90d">Últimos 90 dias</SelectItem>
          <SelectItem value="custom">Personalizado...</SelectItem>
        </SelectContent>
      </Select>
      <PopoverTrigger asChild>
        <span className="hidden" />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4" align="start">
        <div className="space-y-4">
          <div className="text-sm font-medium">Selecione o período</div>
          <div className="flex gap-4">
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">De</label>
              <Calendar
                mode="single"
                selected={tempRange.from}
                onSelect={(date) => setTempRange((prev) => ({ ...prev, from: date }))}
                disabled={(date) => date > new Date()}
                locale={ptBR}
                className={cn("p-3 pointer-events-auto border rounded-md")}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Até</label>
              <Calendar
                mode="single"
                selected={tempRange.to}
                onSelect={(date) => setTempRange((prev) => ({ ...prev, to: date }))}
                disabled={(date) => date > new Date() || (tempRange.from && date < tempRange.from)}
                locale={ptBR}
                className={cn("p-3 pointer-events-auto border rounded-md")}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsCustomOpen(false)}>
              Cancelar
            </Button>
            <Button 
              size="sm" 
              onClick={handleApplyCustomRange}
              disabled={!tempRange.from || !tempRange.to}
            >
              Aplicar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
