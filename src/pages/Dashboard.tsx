import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { MonitorStatusCard } from "@/components/dashboard/MonitorStatusCard";
import { ActiveAdsLineChart } from "@/components/charts/ActiveAdsLineChart";
import { RecentReadingsTable } from "@/components/dashboard/RecentReadingsTable";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Radio, TrendingUp, Activity, AlertTriangle, Loader2, Filter, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface MonitorWithData {
  id: string;
  name: string;
  ad_library_url: string;
  is_active: boolean;
  group_id: string | null;
  group_name?: string;
  tags: Array<{ name: string; type: 'nicho' | 'idioma' | 'pais' | 'custom' }>;
  latest_reading?: {
    ads_active_count: number;
    timestamp: string;
    status: string;
  };
}

interface Group {
  id: string;
  name: string;
  color: string;
}

interface Reading {
  id: string;
  monitorName: string;
  timestamp: string;
  adsCount: number;
  method: 'api' | 'public_parse';
  status: 'ok' | 'falha';
}

function DashboardContent() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [monitors, setMonitors] = useState<MonitorWithData[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [chartData, setChartData] = useState<{ time: string; value: number }[]>([]);
  const [selectedMonitorId, setSelectedMonitorId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [stats, setStats] = useState({
    activeMonitors: 0,
    totalMonitors: 0,
    totalAds: 0,
    readingsToday: 0,
    successRate: 0,
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        // Fetch groups
        const { data: groupsData } = await supabase
          .from('groups')
          .select('id, name, color')
          .eq('user_id', user.id)
          .order('name');

        setGroups(groupsData || []);

        // Create groups map
        const groupsMap: Record<string, { name: string; color: string }> = {};
        (groupsData || []).forEach(g => {
          groupsMap[g.id] = { name: g.name, color: g.color };
        });

        // Fetch monitors with tags
        const { data: monitorsData } = await supabase
          .from('monitors')
          .select(`
            *,
            monitor_tags (
              tag_id,
              tags (id, name, type)
            )
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        const monitorIds = monitorsData?.map(m => m.id) || [];

        // Fetch latest readings
        let readingsMap: Record<string, any> = {};
        let allReadings: any[] = [];

        if (monitorIds.length > 0) {
          const { data: readingsData } = await supabase
            .from('readings')
            .select('*')
            .in('monitor_id', monitorIds)
            .order('timestamp', { ascending: false })
            .limit(100);

          if (readingsData) {
            allReadings = readingsData;
            readingsData.forEach((reading) => {
              if (!readingsMap[reading.monitor_id]) {
                readingsMap[reading.monitor_id] = reading;
              }
            });
          }
        }

        // Transform monitors
        const transformedMonitors: MonitorWithData[] = (monitorsData || []).map((m) => ({
          id: m.id,
          name: m.name,
          ad_library_url: m.ad_library_url,
          is_active: m.is_active,
          group_id: m.group_id,
          group_name: m.group_id ? groupsMap[m.group_id]?.name : undefined,
          tags: m.monitor_tags?.map((mt: any) => mt.tags).filter(Boolean) || [],
          latest_reading: readingsMap[m.id] ? {
            ads_active_count: readingsMap[m.id].ads_active_count,
            timestamp: readingsMap[m.id].timestamp,
            status: readingsMap[m.id].status,
          } : undefined,
        }));

        setMonitors(transformedMonitors);

        // Create monitor name map
        const monitorNameMap: Record<string, string> = {};
        (monitorsData || []).forEach(m => {
          monitorNameMap[m.id] = m.name;
        });

        // Transform recent readings
        const recentReadings: Reading[] = allReadings.slice(0, 10).map((r) => ({
          id: r.id,
          monitorName: monitorNameMap[r.monitor_id] || 'Monitor',
          timestamp: new Date(r.timestamp).toLocaleTimeString('pt-BR'),
          adsCount: r.ads_active_count,
          method: r.source_method as 'api' | 'public_parse',
          status: r.status === 'ok' ? 'ok' : 'falha',
        }));

        setReadings(recentReadings);

        // Calculate stats
        const activeCount = transformedMonitors.filter(m => m.is_active).length;
        const totalAds = transformedMonitors.reduce((sum, m) => sum + (m.latest_reading?.ads_active_count || 0), 0);
        
        const today = new Date().toISOString().split('T')[0];
        const todayReadings = allReadings.filter(r => r.timestamp.startsWith(today));
        const successReadings = todayReadings.filter(r => r.status === 'ok');
        const successRate = todayReadings.length > 0 
          ? Math.round((successReadings.length / todayReadings.length) * 100)
          : 100;

        setStats({
          activeMonitors: activeCount,
          totalMonitors: transformedMonitors.length,
          totalAds,
          readingsToday: todayReadings.length,
          successRate,
        });

        // Create chart data (hourly aggregation)
        const hourlyData: Record<string, number[]> = {};
        allReadings.forEach((r) => {
          const hour = new Date(r.timestamp).getHours();
          const hourKey = `${hour.toString().padStart(2, '0')}:00`;
          if (!hourlyData[hourKey]) hourlyData[hourKey] = [];
          hourlyData[hourKey].push(r.ads_active_count);
        });

        const chartDataPoints = Object.entries(hourlyData)
          .map(([time, values]) => ({
            time,
            value: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
          }))
          .sort((a, b) => a.time.localeCompare(b.time));

        setChartData(chartDataPoints);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const getTimeAgo = (timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `há ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `há ${hours}h`;
    return `há ${Math.floor(hours / 24)}d`;
  };

  // Filter monitors based on selection
  const filteredMonitors = monitors.filter(m => {
    if (selectedMonitorId) return m.id === selectedMonitorId;
    if (selectedGroupId) return m.group_id === selectedGroupId;
    return true;
  });

  // Get filtered stats
  const filteredStats = {
    activeMonitors: filteredMonitors.filter(m => m.is_active).length,
    totalMonitors: filteredMonitors.length,
    totalAds: filteredMonitors.reduce((sum, m) => sum + (m.latest_reading?.ads_active_count || 0), 0),
  };

  const selectedMonitor = selectedMonitorId ? monitors.find(m => m.id === selectedMonitorId) : null;
  const selectedGroup = selectedGroupId ? groups.find(g => g.id === selectedGroupId) : null;

  const clearFilters = () => {
    setSelectedMonitorId(null);
    setSelectedGroupId(null);
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
        {/* Header with Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              {selectedMonitor
                ? `Dados de: ${selectedMonitor.name}`
                : selectedGroup
                ? `Grupo: ${selectedGroup.name}`
                : 'Visão geral dos seus monitores de anúncios'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select
              value={selectedGroupId || "all-groups"}
              onValueChange={(value) => {
                if (value === "all-groups") {
                  setSelectedGroupId(null);
                } else {
                  setSelectedGroupId(value);
                  setSelectedMonitorId(null);
                }
              }}
            >
              <SelectTrigger className="w-[160px] bg-card border-border">
                <SelectValue placeholder="Grupo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-groups">Todos os grupos</SelectItem>
                {groups.map(group => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={selectedMonitorId || "all-monitors"}
              onValueChange={(value) => {
                if (value === "all-monitors") {
                  setSelectedMonitorId(null);
                } else {
                  setSelectedMonitorId(value);
                  setSelectedGroupId(null);
                }
              }}
            >
              <SelectTrigger className="w-[180px] bg-card border-border">
                <SelectValue placeholder="Monitor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-monitors">Todos os monitores</SelectItem>
                {monitors.map(monitor => (
                  <SelectItem key={monitor.id} value={monitor.id}>
                    {monitor.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(selectedMonitorId || selectedGroupId) && (
              <Button variant="ghost" size="icon" onClick={clearFilters}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Monitores Ativos"
            value={filteredStats.activeMonitors.toString()}
            subtitle={`de ${filteredStats.totalMonitors} totais`}
            icon={<Radio className="h-5 w-5" />}
          />
          <MetricCard
            title="Total de Anúncios"
            value={filteredStats.totalAds.toLocaleString('pt-BR')}
            icon={<TrendingUp className="h-5 w-5" />}
          />
          <MetricCard
            title="Leituras Hoje"
            value={stats.readingsToday.toString()}
            subtitle={`${stats.successRate}% de sucesso`}
            icon={<Activity className="h-5 w-5" />}
          />
          <MetricCard
            title="Alertas"
            value="0"
            subtitle="Nenhum alerta ativo"
            icon={<AlertTriangle className="h-5 w-5" />}
          />
        </div>

        {/* Chart */}
        {chartData.length > 0 ? (
          <ActiveAdsLineChart
            data={chartData}
            title={selectedMonitor 
              ? `Anúncios Ativos - ${selectedMonitor.name}` 
              : selectedGroup
              ? `Anúncios Ativos - Grupo ${selectedGroup.name}`
              : "Anúncios Ativos - Últimas 24 horas"}
          />
        ) : (
          <div className="metric-card flex items-center justify-center h-[300px]">
            <p className="text-muted-foreground">
              Nenhum dado de leitura disponível ainda
            </p>
          </div>
        )}

        {/* Monitor Status Cards */}
        {filteredMonitors.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Status dos Monitores
              {selectedGroup && <span className="text-muted-foreground font-normal ml-2">({selectedGroup.name})</span>}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {filteredMonitors.slice(0, 8).map((monitor) => (
                <div
                  key={monitor.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedMonitorId(monitor.id)}
                >
                  <MonitorStatusCard
                    name={monitor.name}
                    url={monitor.ad_library_url}
                    currentCount={monitor.latest_reading?.ads_active_count || 0}
                    lastReading={monitor.latest_reading ? getTimeAgo(monitor.latest_reading.timestamp) : 'Sem leitura'}
                    trend={0}
                    tags={monitor.tags}
                    status={monitor.is_active ? 'active' : 'inactive'}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Readings */}
        {readings.length > 0 && (
          <RecentReadingsTable readings={readings} />
        )}

        {monitors.length === 0 && (
          <div className="metric-card text-center py-12">
            <Radio className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground">
              Comece a monitorar
            </h3>
            <p className="text-muted-foreground mt-1">
              Crie seu primeiro monitor na aba "Monitores" para começar a acompanhar anúncios.
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default function Dashboard() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}
