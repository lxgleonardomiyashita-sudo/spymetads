import { AppLayout } from "@/components/layout/AppLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { MonitorStatusCard } from "@/components/dashboard/MonitorStatusCard";
import { ActiveAdsLineChart } from "@/components/charts/ActiveAdsLineChart";
import { RecentReadingsTable } from "@/components/dashboard/RecentReadingsTable";
import { Radio, TrendingUp, Activity, AlertTriangle } from "lucide-react";

// Mock data for demonstration
const mockChartData = [
  { time: '00:00', value: 12500 },
  { time: '02:00', value: 12450 },
  { time: '04:00', value: 12380 },
  { time: '06:00', value: 12600 },
  { time: '08:00', value: 13200 },
  { time: '10:00', value: 14100 },
  { time: '12:00', value: 14800 },
  { time: '14:00', value: 15200 },
  { time: '16:00', value: 15600 },
  { time: '18:00', value: 15400 },
  { time: '20:00', value: 15100 },
  { time: '22:00', value: 14800 },
];

const mockMonitors = [
  {
    name: "ED Offers - US",
    url: "facebook.com/ads/library/?ad_type=all&q=...",
    currentCount: 15234,
    lastReading: "há 5 min",
    trend: 12.5,
    tags: [
      { name: "ED", type: 'nicho' as const },
      { name: "EN-US", type: 'idioma' as const },
    ],
    status: 'active' as const,
  },
  {
    name: "Diabetes - BR",
    url: "facebook.com/ads/library/?ad_type=all&q=...",
    currentCount: 8742,
    lastReading: "há 3 min",
    trend: -2.3,
    tags: [
      { name: "Diabetes", type: 'nicho' as const },
      { name: "PT-BR", type: 'idioma' as const },
    ],
    status: 'active' as const,
  },
  {
    name: "Weight Loss - DE",
    url: "facebook.com/ads/library/?ad_type=all&q=...",
    currentCount: 4521,
    lastReading: "há 12 min",
    trend: 5.8,
    tags: [
      { name: "Emagrecimento", type: 'nicho' as const },
      { name: "DE", type: 'idioma' as const },
    ],
    status: 'active' as const,
  },
  {
    name: "Skincare - ES",
    url: "facebook.com/ads/library/?ad_type=all&q=...",
    currentCount: 0,
    lastReading: "há 45 min",
    trend: 0,
    tags: [
      { name: "Skincare", type: 'nicho' as const },
      { name: "ES", type: 'idioma' as const },
    ],
    status: 'error' as const,
  },
];

const mockReadings = [
  {
    id: '1',
    monitorName: 'ED Offers - US',
    timestamp: '14:32:15',
    adsCount: 15234,
    method: 'api' as const,
    status: 'ok' as const,
  },
  {
    id: '2',
    monitorName: 'Diabetes - BR',
    timestamp: '14:30:00',
    adsCount: 8742,
    method: 'public_parse' as const,
    status: 'ok' as const,
  },
  {
    id: '3',
    monitorName: 'Weight Loss - DE',
    timestamp: '14:28:45',
    adsCount: 4521,
    method: 'api' as const,
    status: 'ok' as const,
  },
  {
    id: '4',
    monitorName: 'Skincare - ES',
    timestamp: '14:15:22',
    adsCount: 0,
    method: 'public_parse' as const,
    status: 'falha' as const,
  },
];

export default function Dashboard() {
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
            value="12"
            subtitle="de 15 totais"
            icon={<Radio className="h-5 w-5" />}
          />
          <MetricCard
            title="Total de Anúncios"
            value="28.497"
            trend={{ value: 8.2, label: "vs. ontem" }}
            icon={<TrendingUp className="h-5 w-5" />}
          />
          <MetricCard
            title="Leituras Hoje"
            value="847"
            subtitle="98.5% de sucesso"
            icon={<Activity className="h-5 w-5" />}
          />
          <MetricCard
            title="Alertas"
            value="3"
            subtitle="2 críticos"
            icon={<AlertTriangle className="h-5 w-5" />}
          />
        </div>

        {/* Chart */}
        <ActiveAdsLineChart
          data={mockChartData}
          title="Anúncios Ativos - Últimas 24 horas"
        />

        {/* Monitor Status Cards */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Status dos Monitores
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {mockMonitors.map((monitor, index) => (
              <MonitorStatusCard key={index} {...monitor} />
            ))}
          </div>
        </div>

        {/* Recent Readings */}
        <RecentReadingsTable readings={mockReadings} />
      </div>
    </AppLayout>
  );
}
