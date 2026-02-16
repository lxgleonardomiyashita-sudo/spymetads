import { useState, useEffect, useMemo, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, TrendingUp, TrendingDown, Minus, BarChart3, Clock, BarChart2, Activity } from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { TagFilter } from "@/components/analytics/TagFilter";
import { BenchmarkingMetrics } from "@/components/analytics/BenchmarkingMetrics";
import { DistributionCharts } from "@/components/analytics/DistributionCharts";
import { QuickStatsBar } from "@/components/analytics/QuickStatsBar";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Group {
  id: string;
  name: string;
  color: string;
}

interface Tag {
  id: string;
  name: string;
  type: string;
}

interface MonitorTag {
  monitor_id: string;
  tag_id: string;
}

interface Monitor {
  id: string;
  name: string;
  group_id: string | null;
}

interface Reading {
  monitor_id: string;
  ads_active_count: number;
  timestamp: string;
}

interface ChartData {
  date: string;
  [key: string]: string | number;
}

interface HourRange {
  start: number;
  end: number;
}

function AnalisisContent() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [groups, setGroups] = useState<Group[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [monitorTags, setMonitorTags] = useState<MonitorTag[]>([]);
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("all");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [period, setPeriod] = useState<string>("7d");
  const [customRange, setCustomRange] = useState<{ from: Date; to: Date } | null>(null);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [hourRange, setHourRange] = useState<HourRange>({ start: 0, end: 23 });
  const [hourFilterEnabled, setHourFilterEnabled] = useState(false);
  const [chartViewMode, setChartViewMode] = useState<'daily' | 'hourly' | 'individual'>('daily');

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [groupsRes, monitorsRes, tagsRes, monitorTagsRes] = await Promise.all([
          supabase.from("groups").select("id, name, color").eq("user_id", user.id),
          supabase.from("monitors").select("id, name, group_id").eq("user_id", user.id),
          supabase.from("tags").select("id, name, type").eq("user_id", user.id),
          supabase.from("monitor_tags").select("monitor_id, tag_id"),
        ]);

        if (groupsRes.data) setGroups(groupsRes.data);
        if (monitorsRes.data) setMonitors(monitorsRes.data);
        if (tagsRes.data) setTags(tagsRes.data);
        if (monitorTagsRes.data) setMonitorTags(monitorTagsRes.data);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user]);

  // Helper to get period bounds from period string
  const getPeriodBounds = useCallback((periodValue: string, customRangeValue: { from: Date; to: Date } | null) => {
    const now = new Date();
    
    if (periodValue === 'custom' && customRangeValue) {
      const fromStart = startOfDay(customRangeValue.from);
      const toEnd = endOfDay(customRangeValue.to);
      return { start: fromStart, end: toEnd };
    }
    
    const periodDays: Record<string, number> = {
      'today': 0,
      'yesterday': 1,
      '3d': 3,
      '7d': 7,
      '14d': 14,
      '30d': 30,
      '60d': 60,
      '90d': 90,
      '180d': 180,
    };
    
    const days = periodDays[periodValue] ?? 7;
    
    if (periodValue === 'yesterday') {
      const yesterdayStart = startOfDay(subDays(now, 1));
      const yesterdayEnd = endOfDay(subDays(now, 1));
      return { start: yesterdayStart, end: yesterdayEnd };
    }
    
    return { start: startOfDay(subDays(now, days)), end: endOfDay(now) };
  }, []);

  // Filter monitors by group and tags
  const filteredMonitorIds = useMemo(() => {
    let filtered = monitors;

    if (selectedGroupId !== "all") {
      filtered = filtered.filter((m) => m.group_id === selectedGroupId);
    }

    if (selectedTagIds.length > 0) {
      filtered = filtered.filter((m) => {
        const monitorTagIds = monitorTags
          .filter((mt) => mt.monitor_id === m.id)
          .map((mt) => mt.tag_id);
        return selectedTagIds.every((tagId) => monitorTagIds.includes(tagId));
      });
    }

    return filtered.map((m) => m.id);
  }, [monitors, selectedGroupId, selectedTagIds, monitorTags]);

  // Filter readings by hour range
  const filteredReadingsByHour = useMemo(() => {
    if (!hourFilterEnabled) return readings;
    
    return readings.filter(r => {
      const hour = new Date(r.timestamp).getHours();
      if (hourRange.start <= hourRange.end) {
        return hour >= hourRange.start && hour <= hourRange.end;
      } else {
        return hour >= hourRange.start || hour <= hourRange.end;
      }
    });
  }, [readings, hourRange, hourFilterEnabled]);

  // Fetch readings when filters change
  useEffect(() => {
    if (!user || monitors.length === 0) return;

    const fetchReadings = async () => {
      const { start, end } = getPeriodBounds(period, customRange);
      const startDate = start.toISOString();
      const endDate = end.toISOString();

      if (filteredMonitorIds.length === 0) {
        setReadings([]);
        setChartData([]);
        return;
      }

      // Fetch in batches to bypass 1000-row default limit
      let allData: Reading[] = [];
      const batchSize = 1000;
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data: batch } = await supabase
          .from("readings")
          .select("monitor_id, ads_active_count, timestamp")
          .in("monitor_id", filteredMonitorIds)
          .eq("status", "ok")
          .gte("timestamp", startDate)
          .lte("timestamp", endDate)
          .order("timestamp", { ascending: true })
          .range(offset, offset + batchSize - 1);

        if (batch && batch.length > 0) {
          allData = allData.concat(batch);
          offset += batchSize;
          hasMore = batch.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      setReadings(allData);
    };

    fetchReadings();
  }, [user, monitors, filteredMonitorIds, period, customRange, getPeriodBounds]);

  // Process chart data when readings, hour filter, or view mode changes
  useEffect(() => {
    if (filteredReadingsByHour.length > 0 && filteredMonitorIds.length > 0) {
      processChartData(filteredReadingsByHour, filteredMonitorIds);
    } else {
      setChartData([]);
    }
  }, [filteredReadingsByHour, filteredMonitorIds, chartViewMode, period, customRange]);

  const processChartData = (readingsData: Reading[], monitorIds: string[]) => {
    if (chartViewMode === 'hourly') {
      // Group by hour of day (00:00, 01:00, ..., 23:00) — average across all days
      const dataByHour: Record<string, Record<string, number[]>> = {};

      for (let h = 0; h < 24; h++) {
        const hourKey = `${h.toString().padStart(2, '0')}:00`;
        dataByHour[hourKey] = {};
        monitorIds.forEach((id) => {
          dataByHour[hourKey][id] = [];
        });
      }

      readingsData.forEach((r) => {
        const hour = new Date(r.timestamp).getHours();
        const hourKey = `${hour.toString().padStart(2, '0')}:00`;
        if (dataByHour[hourKey] && dataByHour[hourKey][r.monitor_id]) {
          dataByHour[hourKey][r.monitor_id].push(r.ads_active_count);
        }
      });

      const chartDataArr: ChartData[] = Object.entries(dataByHour).map(([hourKey, monitorData]) => {
        const entry: ChartData = { date: hourKey };
        Object.entries(monitorData).forEach(([monitorId, counts]) => {
          const monitor = monitors.find((m) => m.id === monitorId);
          if (monitor && counts.length > 0) {
            entry[monitor.name] = Math.round(counts.reduce((a, b) => a + b, 0) / counts.length);
          }
        });
        return entry;
      }).sort((a, b) => (a.date as string).localeCompare(b.date as string));

      setChartData(chartDataArr);
    } else if (chartViewMode === 'individual') {
      // Show each individual reading as a point (timestamp on x-axis)
      const chartDataArr: ChartData[] = [];
      const timeMap: Record<string, ChartData> = {};

      readingsData.forEach((r) => {
        const date = new Date(r.timestamp);
        // Group by rounded 30-min intervals for readability
        const minutes = Math.floor(date.getMinutes() / 30) * 30;
        const timeKey = `${format(date, 'dd/MM')} ${date.getHours().toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        
        if (!timeMap[timeKey]) {
          timeMap[timeKey] = { date: timeKey };
        }
        
        const monitor = monitors.find((m) => m.id === r.monitor_id);
        if (monitor) {
          // Use latest value for this time slot
          timeMap[timeKey][monitor.name] = r.ads_active_count;
        }
      });

      const sorted = Object.values(timeMap).sort((a, b) => 
        (a.date as string).localeCompare(b.date as string)
      );

      setChartData(sorted);
    } else {
      // Daily aggregation (default)
      const { start, end } = getPeriodBounds(period, customRange);
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      const dataByDate: Record<string, Record<string, number[]>> = {};

      for (let i = days; i >= 0; i--) {
        const date = format(subDays(end, i), "yyyy-MM-dd");
        dataByDate[date] = {};
        monitorIds.forEach((id) => {
          dataByDate[date][id] = [];
        });
      }

      readingsData.forEach((r) => {
        const date = format(new Date(r.timestamp), "yyyy-MM-dd");
        if (dataByDate[date] && dataByDate[date][r.monitor_id]) {
          dataByDate[date][r.monitor_id].push(r.ads_active_count);
        }
      });

      const chartDataArr: ChartData[] = Object.entries(dataByDate).map(([date, monitorData]) => {
        const entry: ChartData = { date: format(new Date(date), "dd/MM", { locale: ptBR }) };
        Object.entries(monitorData).forEach(([monitorId, counts]) => {
          const monitor = monitors.find((m) => m.id === monitorId);
          if (monitor && counts.length > 0) {
            entry[monitor.name] = Math.round(counts.reduce((a, b) => a + b, 0) / counts.length);
          }
        });
        return entry;
      });

      setChartData(chartDataArr);
    }
  };

  // Calculate statistics for filtered monitors (using hour-filtered readings)
  const stats = useMemo(() => {
    const filteredMons = monitors.filter((m) => filteredMonitorIds.includes(m.id));

    return filteredMons.map((monitor) => {
      const monitorReadings = filteredReadingsByHour.filter((r) => r.monitor_id === monitor.id);
      if (monitorReadings.length === 0) return { monitor, current: 0, change: 0, trend: "neutral" as const };

      const current = monitorReadings[monitorReadings.length - 1]?.ads_active_count || 0;
      const first = monitorReadings[0]?.ads_active_count || 0;
      const change = first > 0 ? ((current - first) / first) * 100 : 0;
      const trend = change > 5 ? "up" : change < -5 ? "down" : "neutral";

      return { monitor, current, change, trend: trend as "up" | "down" | "neutral" };
    });
  }, [monitors, filteredMonitorIds, filteredReadingsByHour]);

  const formatHour = (hour: number) => `${hour.toString().padStart(2, '0')}:00`;

  // Calculate benchmarking metrics
  const benchmarkingData = useMemo(() => {
    if (stats.length === 0) {
      return {
        activityIndex: 0,
        volatility: 0,
        growthRate: 0,
        concentration: 0,
        topRising: [],
        topFalling: [],
        dominantMonitors: [],
        diversification: { active: 0, total: monitors.length },
      };
    }

    const totalAds = stats.reduce((sum, s) => sum + s.current, 0);
    const activityIndex = totalAds / stats.length;

    const mean = activityIndex;
    const variance = stats.reduce((sum, s) => sum + Math.pow(s.current - mean, 2), 0) / stats.length;
    const volatility = Math.sqrt(variance);

    const growthRate = stats.reduce((sum, s) => sum + s.change, 0) / stats.length;

    const shares = stats.map((s) => (totalAds > 0 ? s.current / totalAds : 0));
    const concentration = shares.reduce((sum, share) => sum + Math.pow(share, 2), 0);

    const topRising = stats
      .filter((s) => s.change > 0)
      .sort((a, b) => b.change - a.change)
      .slice(0, 3)
      .map((s) => ({ name: s.monitor.name, change: s.change }));

    const topFalling = stats
      .filter((s) => s.change < 0)
      .sort((a, b) => a.change - b.change)
      .slice(0, 3)
      .map((s) => ({ name: s.monitor.name, change: s.change }));

    const dominantMonitors = stats
      .filter((s) => totalAds > 0 && s.current / totalAds > 0.2)
      .map((s) => ({ name: s.monitor.name, share: (s.current / totalAds) * 100 }))
      .sort((a, b) => b.share - a.share);

    const activeMonitors = stats.filter((s) => s.current > 0).length;

    return {
      activityIndex,
      volatility,
      growthRate,
      concentration,
      topRising,
      topFalling,
      dominantMonitors,
      diversification: { active: activeMonitors, total: monitors.length },
    };
  }, [stats, monitors.length]);

  // Calculate distribution data
  const distributionData = useMemo(() => {
    const groupAds: Record<string, number> = {};
    stats.forEach((s) => {
      const group = groups.find((g) => g.id === s.monitor.group_id);
      const groupName = group?.name || "Sem grupo";
      const groupColor = group?.color || "#6b7280";
      const key = `${groupName}|${groupColor}`;
      groupAds[key] = (groupAds[key] || 0) + s.current;
    });

    const groupDistribution = Object.entries(groupAds).map(([key, value]) => {
      const [name, color] = key.split("|");
      return { name, value, color };
    });

    const tagAds: Record<string, { value: number; type: string }> = {};
    stats.forEach((s) => {
      const monitorTagIds = monitorTags
        .filter((mt) => mt.monitor_id === s.monitor.id)
        .map((mt) => mt.tag_id);
      
      monitorTagIds.forEach((tagId) => {
        const tag = tags.find((t) => t.id === tagId);
        if (tag) {
          if (!tagAds[tag.name]) {
            tagAds[tag.name] = { value: 0, type: tag.type };
          }
          tagAds[tag.name].value += s.current;
        }
      });
    });

    const tagDistribution = Object.entries(tagAds).map(([name, data]) => ({
      name,
      value: data.value,
      type: data.type,
    }));

    return { groupDistribution, tagDistribution };
  }, [stats, groups, tags, monitorTags]);

  const filteredMonitors = monitors.filter((m) => filteredMonitorIds.includes(m.id));
  const chartColors = ["#22d3ee", "#a855f7", "#22c55e", "#f59e0b", "#ef4444", "#3b82f6", "#ec4899"];

  const getChartTitle = () => {
    switch (chartViewMode) {
      case 'hourly':
        return 'Média de Anúncios por Hora do Dia';
      case 'individual':
        return 'Leituras Individuais (cada coleta)';
      default:
        return 'Evolução de Anúncios Ativos';
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 fade-in">
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Análises</h1>
            <p className="text-muted-foreground mt-1">
              Visualize tendências, benchmarking e dados históricos
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
              <SelectTrigger className="w-[180px] bg-card border-border">
                <SelectValue placeholder="Filtrar por grupo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os grupos</SelectItem>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: group.color }}
                      />
                      {group.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <TagFilter
              tags={tags}
              selectedTagIds={selectedTagIds}
              onSelectionChange={setSelectedTagIds}
            />

            <PeriodSelector
              value={period}
              onChange={setPeriod}
              customRange={customRange}
              onCustomRangeChange={setCustomRange}
            />

            <Popover>
              <PopoverTrigger asChild>
                <Button 
                  variant={hourFilterEnabled ? "default" : "outline"} 
                  className="gap-2"
                >
                  <Clock className="h-4 w-4" />
                  {hourFilterEnabled 
                    ? `${formatHour(hourRange.start)} - ${formatHour(hourRange.end)}`
                    : "Horário"
                  }
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="start">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Filtrar por horário</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setHourFilterEnabled(!hourFilterEnabled);
                        if (!hourFilterEnabled) {
                          setHourRange({ start: 0, end: 23 });
                        }
                      }}
                    >
                      {hourFilterEnabled ? "Desativar" : "Ativar"}
                    </Button>
                  </div>
                  
                  {hourFilterEnabled && (
                    <>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>Início: {formatHour(hourRange.start)}</span>
                          <span>Fim: {formatHour(hourRange.end)}</span>
                        </div>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label className="text-xs">Hora inicial</Label>
                            <Slider
                              value={[hourRange.start]}
                              onValueChange={([value]) => setHourRange(prev => ({ ...prev, start: value }))}
                              max={23}
                              min={0}
                              step={1}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Hora final</Label>
                            <Slider
                              value={[hourRange.end]}
                              onValueChange={([value]) => setHourRange(prev => ({ ...prev, end: value }))}
                              max={23}
                              min={0}
                              step={1}
                            />
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setHourRange({ start: 6, end: 12 })}
                        >
                          Manhã (6-12h)
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setHourRange({ start: 12, end: 18 })}
                        >
                          Tarde (12-18h)
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setHourRange({ start: 18, end: 23 })}
                        >
                          Noite (18-23h)
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setHourRange({ start: 9, end: 18 })}
                        >
                          Comercial (9-18h)
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {monitors.length === 0 ? (
          <div className="metric-card text-center py-12">
            <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              Crie monitores para começar a visualizar análises.
            </p>
          </div>
        ) : filteredMonitors.length === 0 ? (
          <div className="metric-card text-center py-12">
            <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              Nenhum monitor corresponde aos filtros selecionados.
            </p>
          </div>
        ) : (
          <>
            {/* Quick Stats Bar */}
            <QuickStatsBar
              totalAds={stats.reduce((sum, s) => sum + s.current, 0)}
              totalMonitors={filteredMonitors.length}
              avgAds={Math.round(stats.reduce((sum, s) => sum + s.current, 0) / stats.length)}
              growthRate={benchmarkingData.growthRate}
              concentration={benchmarkingData.concentration}
            />

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {stats.map(({ monitor, current, change, trend }) => (
                <Card key={monitor.id} className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground truncate">
                      {monitor.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold text-foreground">
                        {current.toLocaleString("pt-BR")}
                      </span>
                      <div
                        className={`flex items-center gap-1 text-sm ${
                          trend === "up"
                            ? "text-success"
                            : trend === "down"
                            ? "text-destructive"
                            : "text-muted-foreground"
                        }`}
                      >
                        {trend === "up" ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : trend === "down" ? (
                          <TrendingDown className="h-4 w-4" />
                        ) : (
                          <Minus className="h-4 w-4" />
                        )}
                        <span>{Math.abs(change).toFixed(1)}%</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">anúncios ativos</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Evolution Chart with View Toggle */}
            {chartData.length > 0 && filteredMonitors.length > 0 && (
              <Card className="bg-card border-border">
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <CardTitle className="text-foreground">
                      {getChartTitle()}
                    </CardTitle>
                    <Tabs value={chartViewMode} onValueChange={(v) => setChartViewMode(v as any)}>
                      <TabsList className="bg-muted">
                        <TabsTrigger value="daily" className="gap-1.5 text-xs">
                          <BarChart2 className="h-3.5 w-3.5" />
                          Diário
                        </TabsTrigger>
                        <TabsTrigger value="hourly" className="gap-1.5 text-xs">
                          <Clock className="h-3.5 w-3.5" />
                          Por Hora
                        </TabsTrigger>
                        <TabsTrigger value="individual" className="gap-1.5 text-xs">
                          <Activity className="h-3.5 w-3.5" />
                          Individual
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="date"
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={11}
                          angle={chartViewMode === 'individual' ? -45 : 0}
                          textAnchor={chartViewMode === 'individual' ? 'end' : 'middle'}
                          height={chartViewMode === 'individual' ? 60 : 30}
                        />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            borderColor: "hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                          labelStyle={{ color: "hsl(var(--foreground))" }}
                        />
                        <Legend />
                        {filteredMonitors.map((monitor, idx) => (
                          <Line
                            key={monitor.id}
                            type="monotone"
                            dataKey={monitor.name}
                            stroke={chartColors[idx % chartColors.length]}
                            strokeWidth={2}
                            dot={chartViewMode === 'individual'}
                            connectNulls
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Distribution Charts */}
            <DistributionCharts
              groupDistribution={distributionData.groupDistribution}
              tagDistribution={distributionData.tagDistribution}
            />

            {/* Benchmarking Metrics */}
            <BenchmarkingMetrics {...benchmarkingData} />
          </>
        )}
      </div>
    </AppLayout>
  );
}

export default function Analises() {
  return (
    <ProtectedRoute>
      <AnalisisContent />
    </ProtectedRoute>
  );
}
