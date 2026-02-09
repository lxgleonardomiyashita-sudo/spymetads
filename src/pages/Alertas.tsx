import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Bell,
  TrendingUp,
  TrendingDown,
  Loader2,
  Flame,
  Snowflake,
  Calendar,
  Clock,
  Folder,
} from "lucide-react";
import { format, subDays, startOfDay, endOfDay, getHours } from "date-fns";
import { ptBR } from "date-fns/locale";

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

interface Alert {
  type: "positive" | "negative";
  title: string;
  description: string;
  monitorName?: string;
  groupName?: string;
  value?: number;
  change?: number;
}

interface GroupInsight {
  groupId: string;
  groupName: string;
  groupColor: string;
  peakDays: string[];
  peakHours: string[];
  avgAds: number;
  trend: "up" | "down" | "neutral";
}

function AlertasContent() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [groupInsights, setGroupInsights] = useState<GroupInsight[]>([]);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [groupsRes, monitorsRes] = await Promise.all([
          supabase.from("groups").select("id, name, color").eq("user_id", user.id),
          supabase.from("monitors").select("id, name, group_id").eq("user_id", user.id),
        ]);

        const groups = groupsRes.data || [];
        const monitors = monitorsRes.data || [];

        if (monitors.length === 0) {
          setIsLoading(false);
          return;
        }

        const startDate = startOfDay(subDays(new Date(), 7)).toISOString();
        const endDate = endOfDay(new Date()).toISOString();

        const { data: readings } = await supabase
          .from("readings")
          .select("monitor_id, ads_active_count, timestamp")
          .in(
            "monitor_id",
            monitors.map((m) => m.id)
          )
          .eq("status", "ok")
          .gte("timestamp", startDate)
          .lte("timestamp", endDate)
          .order("timestamp", { ascending: true });

        if (readings && readings.length > 0) {
          generateAlerts(readings, monitors, groups);
          generateGroupInsights(readings, monitors, groups);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const generateAlerts = (
    readings: Reading[],
    monitors: Monitor[],
    groups: Group[]
  ) => {
    const alertsList: Alert[] = [];
    const monitorStats: Record<string, { first: number; last: number; name: string }> = {};

    monitors.forEach((monitor) => {
      const monitorReadings = readings
        .filter((r) => r.monitor_id === monitor.id)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      if (monitorReadings.length >= 2) {
        monitorStats[monitor.id] = {
          first: monitorReadings[0].ads_active_count,
          last: monitorReadings[monitorReadings.length - 1].ads_active_count,
          name: monitor.name,
        };
      }
    });

    // Find biggest gains and drops
    let biggestGain = { id: "", change: 0 };
    let biggestDrop = { id: "", change: 0 };

    Object.entries(monitorStats).forEach(([id, stats]) => {
      const change = ((stats.last - stats.first) / stats.first) * 100;
      if (change > biggestGain.change) biggestGain = { id, change };
      if (change < biggestDrop.change) biggestDrop = { id, change };
    });

    if (biggestGain.id && biggestGain.change > 10) {
      const stats = monitorStats[biggestGain.id];
      alertsList.push({
        type: "positive",
        title: "Maior Crescimento",
        description: `${stats.name} aumentou ${biggestGain.change.toFixed(1)}% em anúncios ativos nos últimos 7 dias.`,
        monitorName: stats.name,
        value: stats.last,
        change: biggestGain.change,
      });
    }

    if (biggestDrop.id && biggestDrop.change < -10) {
      const stats = monitorStats[biggestDrop.id];
      alertsList.push({
        type: "negative",
        title: "Maior Queda",
        description: `${stats.name} reduziu ${Math.abs(biggestDrop.change).toFixed(1)}% em anúncios ativos nos últimos 7 dias.`,
        monitorName: stats.name,
        value: stats.last,
        change: biggestDrop.change,
      });
    }

    // Find highest ad count
    const highest = readings.reduce(
      (max, r) => (r.ads_active_count > max.count ? { count: r.ads_active_count, id: r.monitor_id } : max),
      { count: 0, id: "" }
    );

    if (highest.id) {
      const monitor = monitors.find((m) => m.id === highest.id);
      if (monitor) {
        alertsList.push({
          type: "positive",
          title: "Mais Anúncios Ativos",
          description: `${monitor.name} tem o maior número de anúncios ativos: ${highest.count.toLocaleString("pt-BR")}.`,
          monitorName: monitor.name,
          value: highest.count,
        });
      }
    }

    setAlerts(alertsList);
  };

  const generateGroupInsights = (
    readings: Reading[],
    monitors: Monitor[],
    groups: Group[]
  ) => {
    const insights: GroupInsight[] = [];

    groups.forEach((group) => {
      const groupMonitors = monitors.filter((m) => m.group_id === group.id);
      if (groupMonitors.length === 0) return;

      const groupMonitorIds = groupMonitors.map((m) => m.id);
      const groupReadings = readings.filter((r) => groupMonitorIds.includes(r.monitor_id));

      if (groupReadings.length < 2) return;

      // Analyze by day of week
      const dayStats: Record<string, number[]> = {};
      const hourStats: Record<number, number[]> = {};

      groupReadings.forEach((r) => {
        const date = new Date(r.timestamp);
        const day = format(date, "EEEE", { locale: ptBR });
        const hour = getHours(date);

        if (!dayStats[day]) dayStats[day] = [];
        dayStats[day].push(r.ads_active_count);

        if (!hourStats[hour]) hourStats[hour] = [];
        hourStats[hour].push(r.ads_active_count);
      });

      // Find peak days
      const dayAverages = Object.entries(dayStats).map(([day, counts]) => ({
        day,
        avg: counts.reduce((a, b) => a + b, 0) / counts.length,
      }));
      dayAverages.sort((a, b) => b.avg - a.avg);
      const peakDays = dayAverages.slice(0, 2).map((d) => d.day);

      // Find peak hours
      const hourAverages = Object.entries(hourStats).map(([hour, counts]) => ({
        hour: parseInt(hour),
        avg: counts.reduce((a, b) => a + b, 0) / counts.length,
      }));
      hourAverages.sort((a, b) => b.avg - a.avg);
      const peakHours = hourAverages.slice(0, 2).map((h) => `${h.hour}h`);

      // Calculate trend
      const sortedReadings = [...groupReadings].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      const firstHalf = sortedReadings.slice(0, Math.floor(sortedReadings.length / 2));
      const secondHalf = sortedReadings.slice(Math.floor(sortedReadings.length / 2));

      const firstAvg = firstHalf.reduce((a, b) => a + b.ads_active_count, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((a, b) => a + b.ads_active_count, 0) / secondHalf.length;
      const trendChange = ((secondAvg - firstAvg) / firstAvg) * 100;

      insights.push({
        groupId: group.id,
        groupName: group.name,
        groupColor: group.color,
        peakDays,
        peakHours,
        avgAds: Math.round(groupReadings.reduce((a, b) => a + b.ads_active_count, 0) / groupReadings.length),
        trend: trendChange > 5 ? "up" : trendChange < -5 ? "down" : "neutral",
      });
    });

    setGroupInsights(insights);
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
        <div>
          <h1 className="text-2xl font-bold text-foreground">Alertas</h1>
          <p className="text-muted-foreground mt-1">
            Destaques e insights dos últimos 7 dias
          </p>
        </div>

        {alerts.length === 0 && groupInsights.length === 0 ? (
          <div className="metric-card text-center py-12">
            <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground">
              Nenhum alerta disponível
            </h3>
            <p className="text-muted-foreground mt-1">
              Os alertas aparecerão após a coleta de dados dos seus monitores.
            </p>
          </div>
        ) : (
          <>
            {/* Daily Highlights */}
            {alerts.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Bell className="h-5 w-5 text-primary" />
                  Destaques Diários
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {alerts.map((alert, idx) => (
                    <Card
                      key={idx}
                      className={`bg-card border-border ${
                        alert.type === "positive"
                          ? "border-l-4 border-l-success"
                          : "border-l-4 border-l-destructive"
                      }`}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-medium flex items-center gap-2">
                            {alert.type === "positive" ? (
                              <Flame className="h-4 w-4 text-success" />
                            ) : (
                              <Snowflake className="h-4 w-4 text-destructive" />
                            )}
                            {alert.title}
                          </CardTitle>
                          <Badge
                            variant={alert.type === "positive" ? "default" : "destructive"}
                            className={
                              alert.type === "positive"
                                ? "bg-success/20 text-success hover:bg-success/30"
                                : ""
                            }
                          >
                            {alert.type === "positive" ? (
                              <TrendingUp className="h-3 w-3 mr-1" />
                            ) : (
                              <TrendingDown className="h-3 w-3 mr-1" />
                            )}
                            {alert.change ? `${alert.change > 0 ? "+" : ""}${alert.change.toFixed(1)}%` : "Destaque"}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">{alert.description}</p>
                        {alert.value && (
                          <p className="text-xl font-bold text-foreground mt-2">
                            {alert.value.toLocaleString("pt-BR")} anúncios
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Group Insights */}
            {groupInsights.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Folder className="h-5 w-5 text-primary" />
                  Análise por Grupo (Nicho)
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {groupInsights.map((insight) => (
                    <Card key={insight.groupId} className="bg-card border-border">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base font-medium flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: insight.groupColor }}
                            />
                            {insight.groupName}
                          </CardTitle>
                          <Badge
                            variant="outline"
                            className={
                              insight.trend === "up"
                                ? "text-success border-success"
                                : insight.trend === "down"
                                ? "text-destructive border-destructive"
                                : "text-muted-foreground"
                            }
                          >
                            {insight.trend === "up" ? (
                              <>
                                <TrendingUp className="h-3 w-3 mr-1" />
                                Em alta
                              </>
                            ) : insight.trend === "down" ? (
                              <>
                                <TrendingDown className="h-3 w-3 mr-1" />
                                Em baixa
                              </>
                            ) : (
                              "Estável"
                            )}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center gap-6 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            <span>
                              Picos:{" "}
                              <span className="text-foreground font-medium">
                                {insight.peakDays.join(", ")}
                              </span>
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            <span>
                              Horários:{" "}
                              <span className="text-foreground font-medium">
                                {insight.peakHours.join(", ")}
                              </span>
                            </span>
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Média de anúncios:{" "}
                          <span className="text-foreground font-semibold">
                            {insight.avgAds.toLocaleString("pt-BR")}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}

export default function Alertas() {
  return (
    <ProtectedRoute>
      <AlertasContent />
    </ProtectedRoute>
  );
}
