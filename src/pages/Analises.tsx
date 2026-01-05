import { useState, useEffect } from "react";
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
import { Loader2, TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react";
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

interface Group {
  id: string;
  name: string;
  color: string;
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

function AnalisisContent() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [groups, setGroups] = useState<Group[]>([]);
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("all");
  const [period, setPeriod] = useState<string>("7");
  const [chartData, setChartData] = useState<ChartData[]>([]);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [groupsRes, monitorsRes] = await Promise.all([
          supabase.from("groups").select("id, name, color").eq("user_id", user.id),
          supabase.from("monitors").select("id, name, group_id").eq("user_id", user.id),
        ]);

        if (groupsRes.data) setGroups(groupsRes.data);
        if (monitorsRes.data) setMonitors(monitorsRes.data);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user]);

  useEffect(() => {
    if (!user || monitors.length === 0) return;

    const fetchReadings = async () => {
      const days = parseInt(period);
      const startDate = startOfDay(subDays(new Date(), days)).toISOString();
      const endDate = endOfDay(new Date()).toISOString();

      const filteredMonitorIds =
        selectedGroupId === "all"
          ? monitors.map((m) => m.id)
          : monitors.filter((m) => m.group_id === selectedGroupId).map((m) => m.id);

      if (filteredMonitorIds.length === 0) {
        setReadings([]);
        setChartData([]);
        return;
      }

      const { data } = await supabase
        .from("readings")
        .select("monitor_id, ads_active_count, timestamp")
        .in("monitor_id", filteredMonitorIds)
        .gte("timestamp", startDate)
        .lte("timestamp", endDate)
        .order("timestamp", { ascending: true });

      if (data) {
        setReadings(data);
        processChartData(data, filteredMonitorIds);
      }
    };

    fetchReadings();
  }, [user, monitors, selectedGroupId, period]);

  const processChartData = (readingsData: Reading[], monitorIds: string[]) => {
    const days = parseInt(period);
    const dataByDate: Record<string, Record<string, number[]>> = {};

    for (let i = days; i >= 0; i--) {
      const date = format(subDays(new Date(), i), "yyyy-MM-dd");
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
  };

  const getMonitorStats = () => {
    const filteredMonitors =
      selectedGroupId === "all"
        ? monitors
        : monitors.filter((m) => m.group_id === selectedGroupId);

    return filteredMonitors.map((monitor) => {
      const monitorReadings = readings.filter((r) => r.monitor_id === monitor.id);
      if (monitorReadings.length === 0) return { monitor, current: 0, change: 0, trend: "neutral" as const };

      const current = monitorReadings[monitorReadings.length - 1]?.ads_active_count || 0;
      const first = monitorReadings[0]?.ads_active_count || 0;
      const change = first > 0 ? ((current - first) / first) * 100 : 0;
      const trend = change > 5 ? "up" : change < -5 ? "down" : "neutral";

      return { monitor, current, change, trend: trend as "up" | "down" | "neutral" };
    });
  };

  const stats = getMonitorStats();
  const filteredMonitors =
    selectedGroupId === "all" ? monitors : monitors.filter((m) => m.group_id === selectedGroupId);

  const chartColors = ["#22d3ee", "#a855f7", "#22c55e", "#f59e0b", "#ef4444", "#3b82f6", "#ec4899"];

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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Análises</h1>
            <p className="text-muted-foreground mt-1">
              Visualize tendências e dados históricos
            </p>
          </div>
          <div className="flex gap-3">
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
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[140px] bg-card border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 dias</SelectItem>
                <SelectItem value="14">14 dias</SelectItem>
                <SelectItem value="30">30 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {monitors.length === 0 ? (
          <div className="metric-card text-center py-12">
            <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              Crie monitores para começar a visualizar análises.
            </p>
          </div>
        ) : (
          <>
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

            {/* Chart */}
            {chartData.length > 0 && filteredMonitors.length > 0 && (
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-foreground">
                    Evolução de Anúncios Ativos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="date"
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
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
                            dot={false}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
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
