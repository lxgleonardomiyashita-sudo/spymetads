import { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ActiveAdsLineChart } from "@/components/charts/ActiveAdsLineChart";
import { MultiLineChart, getChartColor } from "@/components/charts/MultiLineChart";
import { ComparisonSidebar } from "@/components/dashboard/ComparisonSidebar";
import { RecentReadingsTable } from "@/components/dashboard/RecentReadingsTable";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { QuickInsights } from "@/components/dashboard/QuickInsights";
import { MarketPulse } from "@/components/dashboard/MarketPulse";
import { MonitorRanking } from "@/components/dashboard/MonitorRanking";
import { MarketTrendIndicator } from "@/components/dashboard/MarketTrendIndicator";
import { EnhancedMonitorCard } from "@/components/dashboard/EnhancedMonitorCard";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { Radio, TrendingUp, Activity, AlertTriangle, Loader2, X, Zap, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  sparklineData: number[];
  change24h: number;
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

interface Insight {
  id: string;
  type: 'alert' | 'growth' | 'decline' | 'info' | 'opportunity';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  monitorName?: string;
  value?: number;
}

interface TagWithTotal {
  id: string;
  name: string;
  type: string;
  totalAds: number;
}

function DashboardContent() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [monitors, setMonitors] = useState<MonitorWithData[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [tags, setTags] = useState<TagWithTotal[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [chartData, setChartData] = useState<{ time: string; value: number }[]>([]);
  const [selectedMonitorId, setSelectedMonitorId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [period, setPeriod] = useState("7d");
  const [customRange, setCustomRange] = useState<{ from: Date; to: Date } | null>(null);
  const [allReadingsRaw, setAllReadingsRaw] = useState<any[]>([]);
  
  // Comparison mode state
  const [comparisonMode, setComparisonMode] = useState(false);
  const [comparisonSidebarOpen, setComparisonSidebarOpen] = useState(false);
  const [comparisonGroupByMode, setComparisonGroupByMode] = useState<'group' | 'tag'>('group');
  const [comparisonSelectedIds, setComparisonSelectedIds] = useState<string[]>([]);
  
  // Market Pulse group filter (independent from dashboard filter)
  const [pulseGroupId, setPulseGroupId] = useState<string | null>(null);
  
  const [stats, setStats] = useState({
    activeMonitors: 0,
    totalMonitors: 0,
    totalAds: 0,
    totalAds24hAgo: 0,
    readingsToday: 0,
    successRate: 0,
    avgAdsLast30d: 0,
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

        // Fetch readings from last 30 days for historical data
        let readingsMap: Record<string, any> = {};
        let allReadings: any[] = [];
        let readings24hAgoMap: Record<string, number> = {};

        if (monitorIds.length > 0) {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

          const { data: readingsData } = await supabase
            .from('readings')
            .select('*')
            .in('monitor_id', monitorIds)
            .gte('timestamp', thirtyDaysAgo.toISOString())
            .order('timestamp', { ascending: false });

          if (readingsData) {
            allReadings = readingsData;
            setAllReadingsRaw(readingsData);

            // Get latest reading per monitor
            readingsData.forEach((reading) => {
              if (!readingsMap[reading.monitor_id]) {
                readingsMap[reading.monitor_id] = reading;
              }
            });

            // Get readings from ~24h ago for comparison
            const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
            readingsData.forEach((reading) => {
              const readingTime = new Date(reading.timestamp).getTime();
              if (readingTime <= twentyFourHoursAgo && !readings24hAgoMap[reading.monitor_id]) {
                readings24hAgoMap[reading.monitor_id] = reading.ads_active_count;
              }
            });
          }
        }

        // Create sparkline data and calculate change for each monitor
        const monitorSparklines: Record<string, number[]> = {};
        const monitorChanges: Record<string, number> = {};

        monitorIds.forEach(id => {
          const monitorReadings = allReadings
            .filter(r => r.monitor_id === id)
            .slice(0, 24)
            .reverse();
          
          monitorSparklines[id] = monitorReadings.map(r => r.ads_active_count);

          const current = readingsMap[id]?.ads_active_count || 0;
          const previous = readings24hAgoMap[id] || current;
          monitorChanges[id] = previous > 0 ? Math.round(((current - previous) / previous) * 100) : 0;
        });

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
          sparklineData: monitorSparklines[m.id] || [],
          change24h: monitorChanges[m.id] || 0,
        }));

        setMonitors(transformedMonitors);

        // Extract and calculate tags with totals
        const tagTotals: Record<string, { name: string; type: string; total: number }> = {};
        transformedMonitors.forEach(m => {
          const monitorAds = m.latest_reading?.ads_active_count || 0;
          m.tags.forEach((t: any) => {
            if (t?.id) {
              if (!tagTotals[t.id]) {
                tagTotals[t.id] = { name: t.name, type: t.type, total: 0 };
              }
              tagTotals[t.id].total += monitorAds;
            }
          });
        });
        setTags(Object.entries(tagTotals).map(([id, data]) => ({
          id,
          name: data.name,
          type: data.type,
          totalAds: data.total,
        })));

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
        const totalAds24hAgo = Object.values(readings24hAgoMap).reduce((sum, val) => sum + val, 0);
        
        const today = new Date().toISOString().split('T')[0];
        const todayReadings = allReadings.filter(r => r.timestamp.startsWith(today));
        const successReadings = todayReadings.filter(r => r.status === 'ok');
        const successRate = todayReadings.length > 0 
          ? Math.round((successReadings.length / todayReadings.length) * 100)
          : 100;

        // Calculate 30-day average
        const avgAdsLast30d = allReadings.length > 0
          ? allReadings.reduce((sum, r) => sum + r.ads_active_count, 0) / allReadings.length
          : 0;

        setStats({
          activeMonitors: activeCount,
          totalMonitors: transformedMonitors.length,
          totalAds,
          totalAds24hAgo,
          readingsToday: todayReadings.length,
          successRate,
          avgAdsLast30d,
        });

        // Create chart data (hourly aggregation)
        const hourlyData: Record<string, number[]> = {};
        allReadings.slice(0, 100).forEach((r) => {
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

  // Filter monitors based on selection
  const filteredMonitors = useMemo(() => {
    return monitors.filter(m => {
      if (selectedMonitorId) return m.id === selectedMonitorId;
      if (selectedGroupId) return m.group_id === selectedGroupId;
      return true;
    });
  }, [monitors, selectedMonitorId, selectedGroupId]);

  // Helper to get period bounds
  const getPeriodBounds = (periodValue: string, customRangeValue: { from: Date; to: Date } | null) => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    if (periodValue === 'custom' && customRangeValue) {
      const fromStart = new Date(customRangeValue.from);
      fromStart.setHours(0, 0, 0, 0);
      const toEnd = new Date(customRangeValue.to);
      toEnd.setHours(23, 59, 59, 999);
      return { start: fromStart.getTime(), end: toEnd.getTime() };
    }
    
    switch (periodValue) {
      case 'today':
        return { start: todayStart.getTime(), end: now.getTime() };
      case 'yesterday': {
        const yesterdayStart = new Date(todayStart);
        yesterdayStart.setDate(yesterdayStart.getDate() - 1);
        return { start: yesterdayStart.getTime(), end: todayStart.getTime() - 1 };
      }
      case '3d':
        return { start: now.getTime() - 3 * 24 * 60 * 60 * 1000, end: now.getTime() };
      case '7d':
        return { start: now.getTime() - 7 * 24 * 60 * 60 * 1000, end: now.getTime() };
      case '14d':
        return { start: now.getTime() - 14 * 24 * 60 * 60 * 1000, end: now.getTime() };
      case '30d':
        return { start: now.getTime() - 30 * 24 * 60 * 60 * 1000, end: now.getTime() };
      case '60d':
        return { start: now.getTime() - 60 * 24 * 60 * 60 * 1000, end: now.getTime() };
      case '90d':
        return { start: now.getTime() - 90 * 24 * 60 * 60 * 1000, end: now.getTime() };
      default:
        return { start: now.getTime() - 7 * 24 * 60 * 60 * 1000, end: now.getTime() };
    }
  };

  // Filter readings based on selection and period
  const filteredReadings = useMemo(() => {
    const { start, end } = getPeriodBounds(period, customRange);

    let readings = allReadingsRaw.filter(r => {
      const readingTime = new Date(r.timestamp).getTime();
      return readingTime >= start && readingTime <= end;
    });

    // Filter by monitor
    if (selectedMonitorId) {
      readings = readings.filter(r => r.monitor_id === selectedMonitorId);
    }

    // Filter by group
    if (selectedGroupId) {
      const groupMonitorIds = monitors
        .filter(m => m.group_id === selectedGroupId)
        .map(m => m.id);
      readings = readings.filter(r => groupMonitorIds.includes(r.monitor_id));
    }

    return readings;
  }, [allReadingsRaw, selectedMonitorId, selectedGroupId, monitors, period, customRange]);

  // Calculate filtered chart data (for single monitor view only)
  const filteredChartData = useMemo(() => {
    // Only use aggregated chart when a single monitor is selected
    if (!selectedMonitorId) return [];
    
    const isLongPeriod = ['7d', '14d', '30d', '60d', '90d', 'custom'].includes(period);
    const dataByKey: Record<string, number[]> = {};

    filteredReadings.forEach((r) => {
      const date = new Date(r.timestamp);
      const key = isLongPeriod
        ? date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
        : `${date.getHours().toString().padStart(2, '0')}:00`;

      if (!dataByKey[key]) dataByKey[key] = [];
      dataByKey[key].push(r.ads_active_count);
    });

    return Object.entries(dataByKey)
      .map(([time, values]) => ({
        time,
        value: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
      }))
      .sort((a, b) => {
        // Sort by date for long periods, by hour for short
        if (isLongPeriod) {
          const [dayA, monthA] = a.time.split('/').map(Number);
          const [dayB, monthB] = b.time.split('/').map(Number);
          return monthA !== monthB ? monthA - monthB : dayA - dayB;
        }
        return a.time.localeCompare(b.time);
      });
  }, [filteredReadings, period, selectedMonitorId]);

  // Calculate multi-line chart data for multiple monitors
  const multiMonitorChartSeries = useMemo(() => {
    // Only show multi-line when NOT a single monitor selected and there are monitors to show
    if (selectedMonitorId || filteredMonitors.length === 0) return [];

    const { start, end } = getPeriodBounds(period, customRange);
    const isLongPeriod = ['7d', '14d', '30d', '60d', '90d', 'custom'].includes(period);

    // Get top 10 monitors by ads active in last 7 days
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const monitorAdsIn7d: Record<string, number> = {};
    
    filteredMonitors.forEach(m => {
      const monitorReadings = allReadingsRaw.filter(
        r => r.monitor_id === m.id && new Date(r.timestamp).getTime() >= sevenDaysAgo
      );
      const avgAds = monitorReadings.length > 0
        ? monitorReadings.reduce((sum, r) => sum + r.ads_active_count, 0) / monitorReadings.length
        : m.latest_reading?.ads_active_count || 0;
      monitorAdsIn7d[m.id] = avgAds;
    });

    // Sort by average ads and take top 10
    const top10Monitors = [...filteredMonitors]
      .sort((a, b) => (monitorAdsIn7d[b.id] || 0) - (monitorAdsIn7d[a.id] || 0))
      .slice(0, 10);

    // Filter readings by period
    const periodReadings = allReadingsRaw.filter(r => {
      const readingTime = new Date(r.timestamp).getTime();
      return readingTime >= start && readingTime <= end;
    });

    return top10Monitors.map((monitor, index) => {
      const monitorReadings = periodReadings.filter(r => r.monitor_id === monitor.id);

      // Aggregate by time
      const dataByTime: Record<string, number[]> = {};
      monitorReadings.forEach(r => {
        const date = new Date(r.timestamp);
        const key = isLongPeriod
          ? date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
          : `${date.getHours().toString().padStart(2, '0')}:00`;
        if (!dataByTime[key]) dataByTime[key] = [];
        dataByTime[key].push(r.ads_active_count);
      });

      const data = Object.entries(dataByTime)
        .map(([time, values]) => ({
          time,
          value: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
        }))
        .sort((a, b) => {
          if (isLongPeriod) {
            const [dayA, monthA] = a.time.split('/').map(Number);
            const [dayB, monthB] = b.time.split('/').map(Number);
            return monthA !== monthB ? monthA - monthB : dayA - dayB;
          }
          return a.time.localeCompare(b.time);
        });

      return {
        id: monitor.id,
        name: monitor.name,
        color: getChartColor(index),
        data,
      };
    });
  }, [selectedMonitorId, filteredMonitors, allReadingsRaw, period]);

  // Get filtered stats
  const filteredStats = useMemo(() => ({
    activeMonitors: filteredMonitors.filter(m => m.is_active).length,
    totalMonitors: filteredMonitors.length,
    totalAds: filteredMonitors.reduce((sum, m) => sum + (m.latest_reading?.ads_active_count || 0), 0),
  }), [filteredMonitors]);

  // Calculate filtered 24h change percentage
  const filteredChange24h = useMemo(() => {
    if (filteredMonitors.length === 0) return 0;

    const currentTotal = filteredMonitors.reduce(
      (sum, m) => sum + (m.latest_reading?.ads_active_count || 0),
      0
    );

    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
    const monitorIds = new Set(filteredMonitors.map(m => m.id));

    // Get last reading before 24h ago for each filtered monitor
    const previousByMonitor: Record<string, number> = {};
    allReadingsRaw
      .filter(r => monitorIds.has(r.monitor_id) && new Date(r.timestamp).getTime() <= twentyFourHoursAgo)
      .forEach(r => {
        if (!previousByMonitor[r.monitor_id]) {
          previousByMonitor[r.monitor_id] = r.ads_active_count;
        }
      });

    const previousTotal = Object.values(previousByMonitor).reduce((a, b) => a + b, 0);

    return previousTotal > 0
      ? Math.round(((currentTotal - previousTotal) / previousTotal) * 100)
      : 0;
  }, [filteredMonitors, allReadingsRaw]);

  // Calculate derived data (insights, rankings, market trend) based on filtered monitors
  const { insights, rankings, marketTrend } = useMemo(() => {
    const insights: Insight[] = [];
    
    // Generate insights based on filtered monitor changes
    filteredMonitors.forEach(m => {
      if (m.change24h >= 20) {
        insights.push({
          id: `growth-${m.id}`,
          type: 'growth',
          title: `${m.name} escalando`,
          description: `Aumento de ${m.change24h}% nas últimas 24h. Pode estar testando novos criativos.`,
          priority: m.change24h >= 50 ? 'high' : 'medium',
          monitorName: m.name,
          value: m.change24h,
        });
      } else if (m.change24h <= -20) {
        insights.push({
          id: `decline-${m.id}`,
          type: 'decline',
          title: `${m.name} em queda`,
          description: `Redução de ${Math.abs(m.change24h)}% nas últimas 24h. Possível pausa de campanhas.`,
          priority: m.change24h <= -40 ? 'high' : 'medium',
          monitorName: m.name,
          value: m.change24h,
        });
      }
    });

    // Sort insights by priority
    insights.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    // Rankings based on filtered monitors
    const topByAds = [...filteredMonitors]
      .filter(m => m.latest_reading)
      .sort((a, b) => (b.latest_reading?.ads_active_count || 0) - (a.latest_reading?.ads_active_count || 0))
      .slice(0, 3)
      .map(m => ({
        id: m.id,
        name: m.name,
        value: m.latest_reading?.ads_active_count || 0,
        change: m.change24h,
      }));

    const rising = [...filteredMonitors]
      .filter(m => m.change24h > 0)
      .sort((a, b) => b.change24h - a.change24h)
      .slice(0, 3)
      .map(m => ({
        id: m.id,
        name: m.name,
        value: m.change24h,
        change: m.change24h,
      }));

    const falling = [...filteredMonitors]
      .filter(m => m.change24h < 0)
      .sort((a, b) => a.change24h - b.change24h)
      .slice(0, 3)
      .map(m => ({
        id: m.id,
        name: m.name,
        value: Math.abs(m.change24h),
        change: m.change24h,
      }));

    const rankings = { topByAds, rising, falling };

    // Calculate totalChange for market trend
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
    const monitorIds = new Set(filteredMonitors.map(m => m.id));
    const previousByMonitor: Record<string, number> = {};
    allReadingsRaw
      .filter(r => monitorIds.has(r.monitor_id) && new Date(r.timestamp).getTime() <= twentyFourHoursAgo)
      .forEach(r => {
        if (!previousByMonitor[r.monitor_id]) {
          previousByMonitor[r.monitor_id] = r.ads_active_count;
        }
      });
    const filteredTotalAds24hAgo = Object.values(previousByMonitor).reduce((a, b) => a + b, 0);
    const totalChange = filteredTotalAds24hAgo > 0 
      ? ((filteredStats.totalAds - filteredTotalAds24hAgo) / filteredTotalAds24hAgo) * 100 
      : 0;

    // Market trend based on filtered data
    const marketTrend = {
      trend: totalChange > 5 ? 'up' as const : totalChange < -5 ? 'down' as const : 'stable' as const,
      percentage: totalChange,
    };

    return { insights, rankings, marketTrend };
  }, [filteredMonitors, filteredStats, allReadingsRaw]);

  // Calculate market pulse based on pulse-specific group filter (independent from dashboard filter)
  const marketPulse = useMemo(() => {
    // Filter monitors by pulse group (or use all if null)
    const pulseMonitors = pulseGroupId 
      ? monitors.filter(m => m.group_id === pulseGroupId)
      : monitors;

    if (pulseMonitors.length === 0) {
      return { temperature: 0, trend: 'stable' as const, avgComparison: 0 };
    }

    const pulseTotalAds = pulseMonitors.reduce((sum, m) => sum + (m.latest_reading?.ads_active_count || 0), 0);
    const pulseActiveMonitors = pulseMonitors.filter(m => m.is_active).length;
    
    // Get 24h ago total for pulse monitors
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
    const pulseMonitorIds = new Set(pulseMonitors.map(m => m.id));
    const previousByMonitor: Record<string, number> = {};
    allReadingsRaw
      .filter(r => pulseMonitorIds.has(r.monitor_id) && new Date(r.timestamp).getTime() <= twentyFourHoursAgo)
      .forEach(r => {
        if (!previousByMonitor[r.monitor_id]) {
          previousByMonitor[r.monitor_id] = r.ads_active_count;
        }
      });
    const pulseTotalAds24hAgo = Object.values(previousByMonitor).reduce((a, b) => a + b, 0);

    const totalChange = pulseTotalAds24hAgo > 0 
      ? ((pulseTotalAds - pulseTotalAds24hAgo) / pulseTotalAds24hAgo) * 100 
      : 0;
    
    // Calculate 30d average for pulse monitors
    const pulseReadings = allReadingsRaw.filter(r => pulseMonitorIds.has(r.monitor_id));
    const pulseAvg30d = pulseReadings.length > 0
      ? pulseReadings.reduce((sum, r) => sum + r.ads_active_count, 0) / pulseReadings.length
      : 0;

    const avgComparison = pulseAvg30d > 0
      ? ((pulseTotalAds - pulseAvg30d) / pulseAvg30d) * 100
      : 0;

    // Temperature based on activity and growth
    const activeRatio = pulseMonitors.length > 0 ? pulseActiveMonitors / pulseMonitors.length : 0;
    const growthNormalized = Math.min(Math.max((totalChange + 50) / 100, 0), 1);
    const temperature = Math.round((activeRatio * 40) + (growthNormalized * 40) + (stats.successRate / 100 * 20));

    return {
      temperature,
      trend: totalChange > 2 ? 'up' as const : totalChange < -2 ? 'down' as const : 'stable' as const,
      avgComparison,
    };
  }, [monitors, pulseGroupId, allReadingsRaw, stats.successRate]);

  const selectedMonitor = selectedMonitorId ? monitors.find(m => m.id === selectedMonitorId) : null;
  const selectedGroup = selectedGroupId ? groups.find(g => g.id === selectedGroupId) : null;

  const clearFilters = () => {
    setSelectedMonitorId(null);
    setSelectedGroupId(null);
  };

  // Toggle comparison mode
  const toggleComparisonMode = () => {
    const newMode = !comparisonMode;
    setComparisonMode(newMode);
    if (newMode) {
      setComparisonSidebarOpen(true);
      // Clear single filters when entering comparison mode
      setSelectedMonitorId(null);
      setSelectedGroupId(null);
    } else {
      setComparisonSidebarOpen(false);
      setComparisonSelectedIds([]);
    }
  };

  // Calculate groups with totals for comparison
  const groupsWithTotals = useMemo(() => {
    return groups.map(g => {
      const groupMonitors = monitors.filter(m => m.group_id === g.id);
      const totalAds = groupMonitors.reduce((sum, m) => sum + (m.latest_reading?.ads_active_count || 0), 0);
      return { ...g, totalAds };
    });
  }, [groups, monitors]);

  // Calculate comparison chart series
  const comparisonChartSeries = useMemo(() => {
    if (!comparisonMode || comparisonSelectedIds.length === 0) return [];

    const periodMs: Record<string, number> = {
      '24h': 24 * 60 * 60 * 1000,
      '48h': 48 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '14d': 14 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    };
    const now = Date.now();
    const maxAge = periodMs[period] || periodMs['24h'];
    const isLongPeriod = period === '7d' || period === '14d' || period === '30d';

    // Filter readings by period
    const periodReadings = allReadingsRaw.filter(r => {
      const age = now - new Date(r.timestamp).getTime();
      return age <= maxAge;
    });

    if (comparisonGroupByMode === 'group') {
      return comparisonSelectedIds.map((groupId, index) => {
        const group = groups.find(g => g.id === groupId);
        if (!group) return null;

        const groupMonitorIds = new Set(monitors.filter(m => m.group_id === groupId).map(m => m.id));
        const groupReadings = periodReadings.filter(r => groupMonitorIds.has(r.monitor_id));

        // Aggregate by time
        const dataByTime: Record<string, number[]> = {};
        groupReadings.forEach(r => {
          const date = new Date(r.timestamp);
          const key = isLongPeriod
            ? date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
            : `${date.getHours().toString().padStart(2, '0')}:00`;
          if (!dataByTime[key]) dataByTime[key] = [];
          dataByTime[key].push(r.ads_active_count);
        });

        const data = Object.entries(dataByTime)
          .map(([time, values]) => ({
            time,
            value: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
          }))
          .sort((a, b) => {
            if (isLongPeriod) {
              const [dayA, monthA] = a.time.split('/').map(Number);
              const [dayB, monthB] = b.time.split('/').map(Number);
              return monthA !== monthB ? monthA - monthB : dayA - dayB;
            }
            return a.time.localeCompare(b.time);
          });

        return {
          id: groupId,
          name: group.name,
          color: getChartColor(index),
          data,
        };
      }).filter(Boolean) as any[];
    } else {
      // Group by tag
      return comparisonSelectedIds.map((tagId, index) => {
        const tag = tags.find(t => t.id === tagId);
        if (!tag) return null;

        const tagMonitorIds = new Set(
          monitors
            .filter(m => m.tags.some((t: any) => t?.id === tagId))
            .map(m => m.id)
        );
        const tagReadings = periodReadings.filter(r => tagMonitorIds.has(r.monitor_id));

        // Aggregate by time
        const dataByTime: Record<string, number[]> = {};
        tagReadings.forEach(r => {
          const date = new Date(r.timestamp);
          const key = isLongPeriod
            ? date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
            : `${date.getHours().toString().padStart(2, '0')}:00`;
          if (!dataByTime[key]) dataByTime[key] = [];
          dataByTime[key].push(r.ads_active_count);
        });

        const data = Object.entries(dataByTime)
          .map(([time, values]) => ({
            time,
            value: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
          }))
          .sort((a, b) => {
            if (isLongPeriod) {
              const [dayA, monthA] = a.time.split('/').map(Number);
              const [dayB, monthB] = b.time.split('/').map(Number);
              return monthA !== monthB ? monthA - monthB : dayA - dayB;
            }
            return a.time.localeCompare(b.time);
          });

        return {
          id: tagId,
          name: tag.name,
          color: getChartColor(index),
          data,
        };
      }).filter(Boolean) as any[];
    }
  }, [comparisonMode, comparisonSelectedIds, comparisonGroupByMode, allReadingsRaw, period, monitors, groups, tags]);

  // Get top performer
  const topPerformer = monitors.reduce((top, m) => {
    if (!m.latest_reading) return top;
    if (!top || m.latest_reading.ads_active_count > (top.latest_reading?.ads_active_count || 0)) {
      return m;
    }
    return top;
  }, null as MonitorWithData | null);

  // Get biggest mover
  const biggestMover = monitors.reduce((biggest, m) => {
    if (!biggest || Math.abs(m.change24h) > Math.abs(biggest.change24h)) {
      return m;
    }
    return biggest;
  }, null as MonitorWithData | null);

  const handleViewCreatives = (monitorUrl: string) => {
    const urlWithSort = monitorUrl.includes('?') 
      ? `${monitorUrl}&sort_data[direction]=desc&sort_data[mode]=relevancy_monthly_grouped`
      : `${monitorUrl}?sort_data[direction]=desc&sort_data[mode]=relevancy_monthly_grouped`;
    window.open(urlWithSort, '_blank');
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
      <div className="flex h-full">
        {/* Main Content */}
        <div className={`flex-1 space-y-4 fade-in ${comparisonSidebarOpen ? 'pr-0' : ''}`}>
          {/* Header with Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
              <p className="text-muted-foreground mt-1">
                {comparisonMode
                  ? `Comparando ${comparisonSelectedIds.length} ${comparisonGroupByMode === 'group' ? 'grupos' : 'tags'}`
                  : selectedMonitor
                  ? `Dados de: ${selectedMonitor.name}`
                  : selectedGroup
                  ? `Grupo: ${selectedGroup.name}`
                  : 'Visão geral dos seus monitores de anúncios'}
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <PeriodSelector 
                value={period} 
                onChange={setPeriod}
                customRange={customRange}
                onCustomRangeChange={setCustomRange}
              />
              
              {/* Comparison Toggle Button */}
              <Button
                variant={comparisonMode ? 'default' : 'outline'}
                size="sm"
                onClick={toggleComparisonMode}
                className="gap-2"
              >
                <BarChart3 className="h-4 w-4" />
                Comparativo
              </Button>

              {!comparisonMode && (
                <>
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
                </>
              )}
            </div>
          </div>

        {/* Metric Cards - Row 1 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            trend={filteredChange24h !== 0 ? { value: filteredChange24h, label: "vs 24h" } : undefined}
          />
          <MetricCard
            title="Leituras Hoje"
            value={stats.readingsToday.toString()}
            subtitle={`${stats.successRate}% de sucesso`}
            icon={<Activity className="h-5 w-5" />}
          />
        </div>

        {/* Market Overview Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Market Trend Indicator */}
          <MarketTrendIndicator 
            trend={marketTrend.trend} 
            percentage={marketTrend.percentage} 
            period="24h"
          />

          {/* Top Performer Card */}
          {topPerformer && (
            <div className="metric-card">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-4 w-4 text-warning" />
                <span className="text-sm font-medium text-muted-foreground">Maior Volume</span>
              </div>
              <p className="text-lg font-bold text-foreground truncate">{topPerformer.name}</p>
              <p className="text-2xl font-bold text-primary">
                {topPerformer.latest_reading?.ads_active_count.toLocaleString('pt-BR')} ads
              </p>
            </div>
          )}

          {/* Biggest Mover Card */}
          {biggestMover && biggestMover.change24h !== 0 && (
            <div className="metric-card">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <span className="text-sm font-medium text-muted-foreground">Maior Movimento</span>
              </div>
              <p className="text-lg font-bold text-foreground truncate">{biggestMover.name}</p>
              <p className={`text-2xl font-bold ${biggestMover.change24h > 0 ? 'text-success' : 'text-destructive'}`}>
                {biggestMover.change24h > 0 ? '+' : ''}{biggestMover.change24h}%
              </p>
            </div>
          )}
        </div>

        {/* Quick Insights + Market Pulse Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Quick Insights */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                Insights Rápidos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <QuickInsights insights={insights} />
            </CardContent>
          </Card>

          {/* Market Pulse */}
          <MarketPulse 
            temperature={marketPulse.temperature}
            trend={marketPulse.trend}
            avgComparison={marketPulse.avgComparison}
            groups={groups}
            selectedGroupId={pulseGroupId}
            onGroupChange={setPulseGroupId}
          />
        </div>

        {/* Rankings Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MonitorRanking 
            title="Top por Volume"
            type="top"
            monitors={rankings.topByAds}
            valueLabel="ads"
          />
          <MonitorRanking 
            title="Mais Cresceram (24h)"
            type="rising"
            monitors={rankings.rising}
            valueLabel="%"
          />
          <MonitorRanking 
            title="Mais Caíram (24h)"
            type="falling"
            monitors={rankings.falling}
            valueLabel="%"
          />
        </div>

          {/* Monitor Status Cards */}
          {!comparisonMode && filteredMonitors.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-foreground">
                  Status dos Monitores
                  {selectedGroup && <span className="text-muted-foreground font-normal ml-2">({selectedGroup.name})</span>}
                </h2>
                {selectedMonitorId && (
                  <button
                    onClick={() => setSelectedMonitorId(null)}
                    className="text-sm text-primary hover:text-primary/80 font-medium transition-colors"
                  >
                    Ver todos
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                {filteredMonitors.slice(0, 8).map((monitor) => (
                  <EnhancedMonitorCard
                    key={monitor.id}
                    id={monitor.id}
                    name={monitor.name}
                    url={monitor.ad_library_url}
                    currentCount={monitor.latest_reading?.ads_active_count || 0}
                    trend={monitor.change24h}
                    sparklineData={monitor.sparklineData}
                    tags={monitor.tags}
                    status={monitor.is_active ? 'active' : 'inactive'}
                    isSelected={selectedMonitorId === monitor.id}
                    onSelect={() => setSelectedMonitorId(monitor.id)}
                    onViewCreatives={() => handleViewCreatives(monitor.ad_library_url)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Chart Section */}
          {comparisonMode ? (
            <MultiLineChart
              series={comparisonChartSeries}
              title={`Comparativo por ${comparisonGroupByMode === 'group' ? 'Grupo' : 'Tag'} - ${period === '24h' ? 'Últimas 24 horas' : period === '48h' ? 'Últimas 48 horas' : period === '7d' ? 'Últimos 7 dias' : period === '14d' ? 'Últimos 14 dias' : 'Últimos 30 dias'}`}
            />
          ) : selectedMonitorId && filteredChartData.length > 0 ? (
            <ActiveAdsLineChart
              data={filteredChartData}
              title={`Anúncios Ativos - ${selectedMonitor?.name}`}
            />
          ) : multiMonitorChartSeries.length > 0 ? (
            <MultiLineChart
              series={multiMonitorChartSeries}
              title={selectedGroup
                ? `Comparativo - Grupo ${selectedGroup.name} (Top ${Math.min(multiMonitorChartSeries.length, 10)} monitores)`
                : `Comparativo - Top ${Math.min(multiMonitorChartSeries.length, 10)} monitores - ${period === '24h' ? 'Últimas 24 horas' : period === '48h' ? 'Últimas 48 horas' : period === '7d' ? 'Últimos 7 dias' : period === '14d' ? 'Últimos 14 dias' : 'Últimos 30 dias'}`}
            />
          ) : (
            <div className="metric-card flex items-center justify-center h-[300px]">
              <p className="text-muted-foreground">
                Nenhum dado de leitura disponível ainda
              </p>
            </div>
          )}

          {/* Recent Readings */}
          {!comparisonMode && readings.length > 0 && (
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

        {/* Comparison Sidebar */}
        <ComparisonSidebar
          isOpen={comparisonSidebarOpen}
          onClose={() => setComparisonSidebarOpen(false)}
          groups={groupsWithTotals}
          tags={tags}
          selectedIds={comparisonSelectedIds}
          onSelectionChange={setComparisonSelectedIds}
          groupByMode={comparisonGroupByMode}
          onGroupByModeChange={(mode) => {
            setComparisonGroupByMode(mode);
            setComparisonSelectedIds([]);
          }}
          maxSelections={10}
        />
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
