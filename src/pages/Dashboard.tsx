import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { MonitorStatusCard } from "@/components/dashboard/MonitorStatusCard";
import { ActiveAdsLineChart } from "@/components/charts/ActiveAdsLineChart";
import { RecentReadingsTable } from "@/components/dashboard/RecentReadingsTable";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Radio, TrendingUp, Activity, AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface MonitorWithData {
  id: string;
  name: string;
  ad_library_url: string;
  is_active: boolean;
  tags: Array<{ name: string; type: 'nicho' | 'idioma' | 'pais' | 'custom' }>;
  latest_reading?: {
    ads_active_count: number;
    timestamp: string;
    status: string;
  };
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
  const [readings, setReadings] = useState<Reading[]>([]);
  const [chartData, setChartData] = useState<{ time: string; value: number }[]>([]);
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
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Visão geral dos seus monitores de anúncios
          </p>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Monitores Ativos"
            value={stats.activeMonitors.toString()}
            subtitle={`de ${stats.totalMonitors} totais`}
            icon={<Radio className="h-5 w-5" />}
          />
          <MetricCard
            title="Total de Anúncios"
            value={stats.totalAds.toLocaleString('pt-BR')}
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
            title="Anúncios Ativos - Últimas 24 horas"
          />
        ) : (
          <div className="metric-card flex items-center justify-center h-[300px]">
            <p className="text-muted-foreground">
              Nenhum dado de leitura disponível ainda
            </p>
          </div>
        )}

        {/* Monitor Status Cards */}
        {monitors.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Status dos Monitores
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {monitors.slice(0, 4).map((monitor) => (
                <MonitorStatusCard
                  key={monitor.id}
                  name={monitor.name}
                  url={monitor.ad_library_url}
                  currentCount={monitor.latest_reading?.ads_active_count || 0}
                  lastReading={monitor.latest_reading ? getTimeAgo(monitor.latest_reading.timestamp) : 'Sem leitura'}
                  trend={0}
                  tags={monitor.tags}
                  status={monitor.is_active ? 'active' : 'inactive'}
                />
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
