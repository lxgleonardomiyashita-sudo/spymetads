import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TagChip } from "@/components/ui/tag-chip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { 
  Star, 
  Trash2, 
  ExternalLink, 
  Search, 
  Filter,
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
  Calendar,
  Loader2
} from "lucide-react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MonitorInsightsDialog } from "@/components/monitors/MonitorInsightsDialog";
import { getPriorityColor } from "@/lib/formatters";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Cell,
} from "recharts";

function SpyEspecialContent() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>("all");
  const [selectedMonitorForInsights, setSelectedMonitorForInsights] = useState<{
    id: string;
    name: string;
    ad_library_url: string;
    is_active: boolean;
  } | null>(null);

  // Fetch saved monitors
  const { data: savedMonitors = [], isLoading } = useQuery({
    queryKey: ["saved-monitors", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saved_monitors")
        .select(`
          *,
          monitor:monitors(
            *,
            group:groups(*),
            monitor_tags(tag:tags(*))
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  // Fetch readings for saved monitors
  const { data: readings = [] } = useQuery({
    queryKey: ["saved-monitors-readings", savedMonitors.map(s => s.monitor_id)],
    queryFn: async () => {
      if (savedMonitors.length === 0) return [];
      
      const monitorIds = savedMonitors.map(s => s.monitor_id);
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
      
      // Fetch in batches to bypass 1000-row limit
      let allData: any[] = [];
      const batchSize = 1000;
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data: batch, error: batchError } = await supabase
          .from("readings")
          .select("*")
          .in("monitor_id", monitorIds)
          .eq("status", "ok")
          .gte("timestamp", thirtyDaysAgo)
          .order("timestamp", { ascending: true })
          .range(offset, offset + batchSize - 1);

        if (batchError) throw batchError;
        if (batch && batch.length > 0) {
          allData = allData.concat(batch);
          offset += batchSize;
          hasMore = batch.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      return allData;
    },
    enabled: savedMonitors.length > 0,
    staleTime: 1000 * 60 * 5,
  });

  // Fetch groups for filter
  const { data: groups = [] } = useQuery({
    queryKey: ["groups", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("*")
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  // Remove from saved
  const removeMutation = useMutation({
    mutationFn: async (monitorId: string) => {
      const { error } = await supabase
        .from("saved_monitors")
        .delete()
        .eq("monitor_id", monitorId)
        .eq("user_id", user?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-monitors"] });
      queryClient.invalidateQueries({ queryKey: ["saved-monitor-ids"] });
      toast.success("Monitor removido do Spy Especial");
    },
    onError: () => {
      toast.error("Erro ao remover monitor");
    },
  });

  // Update priority
  const updatePriorityMutation = useMutation({
    mutationFn: async ({ monitorId, priority }: { monitorId: string; priority: string }) => {
      const { error } = await supabase
        .from("saved_monitors")
        .update({ priority })
        .eq("monitor_id", monitorId)
        .eq("user_id", user?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-monitors"] });
      toast.success("Prioridade atualizada");
    },
  });

  // Filtered monitors
  const filteredMonitors = useMemo(() => {
    return savedMonitors.filter((saved) => {
      const monitor = saved.monitor;
      if (!monitor) return false;

      const matchesSearch = monitor.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPriority = priorityFilter === "all" || saved.priority === priorityFilter;
      const matchesGroup = selectedGroupFilter === "all" || monitor.group_id === selectedGroupFilter;

      return matchesSearch && matchesPriority && matchesGroup;
    });
  }, [savedMonitors, searchTerm, priorityFilter, selectedGroupFilter]);

  // Analytics calculations
  const analytics = useMemo(() => {
    if (filteredMonitors.length === 0) return null;

    const monitorIds = filteredMonitors.map(s => s.monitor_id);
    const monitorReadings = readings.filter(r => monitorIds.includes(r.monitor_id));

    // Get latest reading per monitor
    const latestByMonitor: Record<string, number> = {};
    const previousByMonitor: Record<string, number> = {};
    
    monitorReadings.forEach(r => {
      if (!latestByMonitor[r.monitor_id]) {
        latestByMonitor[r.monitor_id] = r.ads_active_count;
      }
    });

    // Get readings from 7 days ago
    const sevenDaysAgo = subDays(new Date(), 7);
    monitorReadings
      .filter(r => new Date(r.timestamp) <= sevenDaysAgo)
      .forEach(r => {
        previousByMonitor[r.monitor_id] = r.ads_active_count;
      });

    const totalAds = Object.values(latestByMonitor).reduce((sum, v) => sum + v, 0);
    const previousTotal = Object.values(previousByMonitor).reduce((sum, v) => sum + v, 0);
    const avgAds = totalAds / filteredMonitors.length;
    const growthRate = previousTotal > 0 ? ((totalAds - previousTotal) / previousTotal) * 100 : 0;

    // Activity by day
    const activityByDay: Record<string, number> = {};
    monitorReadings.forEach(r => {
      const day = format(new Date(r.timestamp), "yyyy-MM-dd");
      activityByDay[day] = (activityByDay[day] || 0) + r.ads_active_count;
    });

    const chartData = Object.entries(activityByDay)
      .map(([date, value]) => ({
        date: format(new Date(date), "dd/MM", { locale: ptBR }),
        value: Math.round(value / filteredMonitors.length),
      }))
      .slice(-14);

    // Top performers
    const monitorsWithLatest = filteredMonitors.map(s => ({
      ...s,
      latestCount: latestByMonitor[s.monitor_id] || 0,
    })).sort((a, b) => b.latestCount - a.latestCount);

    return {
      totalAds,
      avgAds: Math.round(avgAds),
      growthRate: growthRate.toFixed(1),
      chartData,
      topPerformers: monitorsWithLatest.slice(0, 5),
      totalMonitors: filteredMonitors.length,
    };
  }, [filteredMonitors, readings]);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Star className="h-6 w-6 text-yellow-500 fill-yellow-500" />
              Spy Especial
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Monitores salvos para análise detalhada
            </p>
          </div>
          <Badge variant="secondary" className="text-lg px-4 py-2">
            {savedMonitors.length} salvos
          </Badge>
        </div>

        {/* Filters */}
        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar monitores..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-[160px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Prioridade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="low">Baixa</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedGroupFilter} onValueChange={setSelectedGroupFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Grupo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os grupos</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="monitors" className="space-y-4">
          <TabsList>
            <TabsTrigger value="monitors">Monitores</TabsTrigger>
            <TabsTrigger value="analytics">Análises</TabsTrigger>
          </TabsList>

          {/* Monitors Tab */}
          <TabsContent value="monitors" className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredMonitors.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="py-12 text-center">
                  <Star className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">
                    {savedMonitors.length === 0
                      ? "Nenhum monitor salvo. Use o botão ⭐ nos monitores para adicioná-los aqui."
                      : "Nenhum monitor encontrado com os filtros atuais."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredMonitors.map((saved) => {
                  const monitor = saved.monitor;
                  if (!monitor) return null;

                  const tags = monitor.monitor_tags?.map((mt: any) => mt.tag).filter(Boolean) || [];
                  const latestReading = readings
                    .filter(r => r.monitor_id === monitor.id)
                    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

                  return (
                    <Card key={saved.id} className="bg-card border-border hover:border-primary/50 transition-colors">
                      <CardContent className="p-4 space-y-3">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-foreground truncate">{monitor.name}</h3>
                            {monitor.group && (
                              <Badge 
                                variant="outline" 
                                className="mt-1 text-xs"
                                style={{ 
                                  borderColor: monitor.group.color || undefined,
                                  color: monitor.group.color || undefined
                                }}
                              >
                                {monitor.group.name}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setSelectedMonitorForInsights({
                                id: monitor.id,
                                name: monitor.name,
                                ad_library_url: monitor.ad_library_url,
                                is_active: monitor.is_active,
                              })}
                            >
                              <BarChart3 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => window.open(monitor.ad_library_url, "_blank")}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => removeMutation.mutate(monitor.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Stats */}
                        <div className="flex items-center justify-between">
                          <div className="text-2xl font-bold text-primary">
                            {latestReading?.ads_active_count?.toLocaleString("pt-BR") || "—"}
                          </div>
                          <Select
                            value={saved.priority || "medium"}
                            onValueChange={(v) => updatePriorityMutation.mutate({ monitorId: monitor.id, priority: v })}
                          >
                            <SelectTrigger className={`w-24 h-7 text-xs ${getPriorityColor(saved.priority || "medium")}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="high">Alta</SelectItem>
                              <SelectItem value="medium">Média</SelectItem>
                              <SelectItem value="low">Baixa</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Tags */}
                        {tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {tags.slice(0, 3).map((tag: any) => (
                              <TagChip key={tag.id} type={tag.type} name={tag.name} size="sm" />
                            ))}
                            {tags.length > 3 && (
                              <Badge variant="secondary" className="text-xs">
                                +{tags.length - 3}
                              </Badge>
                            )}
                          </div>
                        )}

                        {/* Saved date */}
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          Salvo em {format(new Date(saved.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            {analytics ? (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="bg-card border-border">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <Activity className="h-4 w-4" />
                        Total de Ads
                      </div>
                      <div className="text-2xl font-bold text-foreground mt-1">
                        {analytics.totalAds.toLocaleString("pt-BR")}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-card border-border">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <BarChart3 className="h-4 w-4" />
                        Média por Monitor
                      </div>
                      <div className="text-2xl font-bold text-foreground mt-1">
                        {analytics.avgAds.toLocaleString("pt-BR")}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-card border-border">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        {Number(analytics.growthRate) >= 0 ? (
                          <TrendingUp className="h-4 w-4 text-success" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-destructive" />
                        )}
                        Crescimento 7d
                      </div>
                      <div className={`text-2xl font-bold mt-1 ${Number(analytics.growthRate) >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {Number(analytics.growthRate) >= 0 ? '+' : ''}{analytics.growthRate}%
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-card border-border">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <Star className="h-4 w-4" />
                        Monitores
                      </div>
                      <div className="text-2xl font-bold text-foreground mt-1">
                        {analytics.totalMonitors}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Activity Chart */}
                  <Card className="bg-card border-border">
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-foreground mb-4">Atividade (últimos 14 dias)</h3>
                      <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={analytics.chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis 
                              dataKey="date" 
                              stroke="hsl(var(--muted-foreground))"
                              fontSize={12}
                            />
                            <YAxis 
                              stroke="hsl(var(--muted-foreground))"
                              fontSize={12}
                            />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: 'hsl(var(--card))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px'
                              }}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="value" 
                              stroke="hsl(var(--primary))"
                              strokeWidth={2}
                              dot={{ fill: 'hsl(var(--primary))' }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Top Performers */}
                  <Card className="bg-card border-border">
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-foreground mb-4">Top Performers</h3>
                      <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart 
                            data={analytics.topPerformers.map(p => ({
                              name: p.monitor?.name?.slice(0, 15) || 'N/A',
                              value: p.latestCount,
                            }))}
                            layout="vertical"
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                            <YAxis 
                              type="category" 
                              dataKey="name" 
                              stroke="hsl(var(--muted-foreground))"
                              fontSize={12}
                              width={100}
                            />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: 'hsl(var(--card))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px'
                              }}
                            />
                            <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]}>
                              {analytics.topPerformers.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={`hsl(var(--primary) / ${1 - index * 0.15})`} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : (
              <Card className="bg-card border-border">
                <CardContent className="py-12 text-center">
                  <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">
                    Salve monitores para ver análises detalhadas.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        <MonitorInsightsDialog
          open={!!selectedMonitorForInsights}
          onOpenChange={(open) => !open && setSelectedMonitorForInsights(null)}
          monitor={selectedMonitorForInsights}
        />
      </div>
    </AppLayout>
  );
}

export default function SpyEspecial() {
  return (
    <ProtectedRoute>
      <SpyEspecialContent />
    </ProtectedRoute>
  );
}
