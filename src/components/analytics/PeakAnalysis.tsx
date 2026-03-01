import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, TrendingUp, Calendar } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface Reading {
  monitor_id: string;
  ads_active_count: number;
  timestamp: string;
}

interface PeakAnalysisProps {
  readings: Reading[];
  monitors: Array<{ id: string; name: string }>;
}

export function PeakAnalysis({ readings, monitors }: PeakAnalysisProps) {
  const hourlyPeaks = useMemo(() => {
    const byHour: Record<number, number[]> = {};
    for (let h = 0; h < 24; h++) byHour[h] = [];

    readings.forEach((r) => {
      const hour = new Date(r.timestamp).getHours();
      byHour[hour].push(r.ads_active_count);
    });

    return Object.entries(byHour).map(([hour, values]) => ({
      hour: `${hour.toString().padStart(2, "0")}:00`,
      avg: values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0,
      max: values.length > 0 ? Math.max(...values) : 0,
      count: values.length,
    }));
  }, [readings]);

  const dailyPeaks = useMemo(() => {
    const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const byDay: Record<number, number[]> = {};
    for (let d = 0; d < 7; d++) byDay[d] = [];

    readings.forEach((r) => {
      const day = new Date(r.timestamp).getDay();
      byDay[day].push(r.ads_active_count);
    });

    return Object.entries(byDay).map(([day, values]) => ({
      day: dayNames[parseInt(day)],
      avg: values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0,
      max: values.length > 0 ? Math.max(...values) : 0,
      count: values.length,
    }));
  }, [readings]);

  const peakHour = useMemo(() => {
    return hourlyPeaks.reduce((best, h) => (h.avg > best.avg ? h : best), hourlyPeaks[0]);
  }, [hourlyPeaks]);

  const peakDay = useMemo(() => {
    return dailyPeaks.reduce((best, d) => (d.avg > best.avg ? d : best), dailyPeaks[0]);
  }, [dailyPeaks]);

  // Per-monitor peak analysis
  const monitorPeaks = useMemo(() => {
    return monitors.map((monitor) => {
      const monReadings = readings.filter((r) => r.monitor_id === monitor.id);
      const byHour: Record<number, number[]> = {};
      for (let h = 0; h < 24; h++) byHour[h] = [];
      monReadings.forEach((r) => {
        const hour = new Date(r.timestamp).getHours();
        byHour[hour].push(r.ads_active_count);
      });

      let bestHour = 0;
      let bestAvg = 0;
      Object.entries(byHour).forEach(([hour, values]) => {
        const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
        if (avg > bestAvg) {
          bestAvg = avg;
          bestHour = parseInt(hour);
        }
      });

      return {
        name: monitor.name,
        peakHour: `${bestHour.toString().padStart(2, "0")}:00`,
        peakAvg: Math.round(bestAvg),
        totalReadings: monReadings.length,
      };
    }).filter((m) => m.totalReadings > 0)
      .sort((a, b) => b.peakAvg - a.peakAvg)
      .slice(0, 10);
  }, [readings, monitors]);

  if (readings.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Summary badges */}
      <div className="flex flex-wrap gap-3">
        {peakHour && peakHour.avg > 0 && (
          <Badge variant="outline" className="gap-1.5 py-1.5 px-3 text-sm">
            <Clock className="h-3.5 w-3.5 text-primary" />
            Pico: {peakHour.hour} ({peakHour.avg} ads avg)
          </Badge>
        )}
        {peakDay && peakDay.avg > 0 && (
          <Badge variant="outline" className="gap-1.5 py-1.5 px-3 text-sm">
            <Calendar className="h-3.5 w-3.5 text-primary" />
            Melhor dia: {peakDay.day} ({peakDay.avg} ads avg)
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Hourly peaks chart */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Média por Hora do Dia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyPeaks}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="hour" fontSize={10} stroke="hsl(var(--muted-foreground))" />
                  <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number, name: string) => [
                      value,
                      name === "avg" ? "Média" : "Máximo",
                    ]}
                  />
                  <Bar dataKey="avg" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Daily peaks chart */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Média por Dia da Semana
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyPeaks}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number, name: string) => [
                      value,
                      name === "avg" ? "Média" : "Máximo",
                    ]}
                  />
                  <Bar dataKey="avg" fill="hsl(var(--chart-2))" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-monitor peaks */}
      {monitorPeaks.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Horário de Pico por Monitor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {monitorPeaks.map((mp) => (
                <div
                  key={mp.name}
                  className="flex items-center justify-between py-2 px-3 rounded bg-muted/40"
                >
                  <span className="text-sm truncate flex-1">{mp.name}</span>
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {mp.peakHour} • {mp.peakAvg} ads
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
