import { cn } from "@/lib/utils";

interface DayData {
  day: number;
  morning?: number;
  afternoon?: number;
  evening?: number;
}

interface MonthlyCalendarViewProps {
  year: number;
  month: number;
  data: DayData[];
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export function MonthlyCalendarView({ year, month, data }: MonthlyCalendarViewProps) {
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const getDayData = (day: number) => {
    return data.find((d) => d.day === day);
  };

  const formatValue = (value?: number) => {
    if (value === undefined) return '-';
    if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
    return value.toString();
  };

  return (
    <div className="metric-card">
      <h3 className="text-lg font-semibold text-foreground mb-4">
        {MONTHS[month]} {year}
      </h3>
      
      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-medium text-muted-foreground py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Empty cells for days before the first day of month */}
        {Array.from({ length: firstDayOfMonth }).map((_, index) => (
          <div key={`empty-${index}`} className="aspect-square" />
        ))}

        {/* Day cells */}
        {Array.from({ length: daysInMonth }).map((_, index) => {
          const day = index + 1;
          const dayData = getDayData(day);
          const hasData = dayData && (dayData.morning || dayData.afternoon || dayData.evening);

          return (
            <div
              key={day}
              className={cn(
                "aspect-square rounded-lg border border-border/50 p-1.5 transition-colors hover:border-primary/50 cursor-pointer",
                hasData ? "bg-card" : "bg-muted/30"
              )}
            >
              <div className="text-xs font-medium text-muted-foreground mb-1">
                {day}
              </div>
              {hasData && (
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-warning" />
                    <span className="text-[9px] text-muted-foreground">
                      {formatValue(dayData?.morning)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-info" />
                    <span className="text-[9px] text-muted-foreground">
                      {formatValue(dayData?.afternoon)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-chart-3" />
                    <span className="text-[9px] text-muted-foreground">
                      {formatValue(dayData?.evening)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-border">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-warning" />
          <span className="text-xs text-muted-foreground">Manhã</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-info" />
          <span className="text-xs text-muted-foreground">Tarde</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-chart-3" />
          <span className="text-xs text-muted-foreground">Noite</span>
        </div>
      </div>
    </div>
  );
}
