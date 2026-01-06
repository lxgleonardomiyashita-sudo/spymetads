import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  BarChart3,
  Flame,
  Loader2,
  Copy,
  Check,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format, differenceInDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Reading {
  ads_active_count: number;
  timestamp: string;
  status: string;
}

interface AdDetail {
  id: string;
  ad_archive_id: string;
  ad_start_date: string | null;
  ad_body: string | null;
  ad_title: string | null;
  preview_url: string | null;
  link_url: string | null;
  days_active: number;
  times_seen: number;
  first_seen_at: string;
  last_seen_at: string;
  is_active: boolean;
}

interface MonitorInsightsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  monitor: {
    id: string;
    name: string;
    ad_library_url: string;
    is_active: boolean;
  } | null;
}

export function MonitorInsightsDialog({
  open,
  onOpenChange,
  monitor,
}: MonitorInsightsDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [topAds, setTopAds] = useState<AdDetail[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open && monitor) {
      fetchData();
    }
  }, [open, monitor]);

  const fetchData = async () => {
    if (!monitor) return;
    setIsLoading(true);

    try {
      // Fetch readings for the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [readingsRes, adsRes] = await Promise.all([
        supabase
          .from("readings")
          .select("ads_active_count, timestamp, status")
          .eq("monitor_id", monitor.id)
          .gte("timestamp", thirtyDaysAgo.toISOString())
          .order("timestamp", { ascending: true }),
        supabase
          .from("ad_details")
          .select("*")
          .eq("monitor_id", monitor.id)
          .eq("is_active", true)
          .order("days_active", { ascending: false })
          .limit(10),
      ]);

      if (readingsRes.data) {
        setReadings(readingsRes.data);
      }

      if (adsRes.data) {
        setTopAds(adsRes.data as AdDetail[]);
      }
    } catch (error) {
      console.error("Error fetching insights:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const copyLink = async () => {
    if (!monitor) return;
    try {
      await navigator.clipboard.writeText(monitor.ad_library_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Link copiado!" });
    } catch {
      toast({ title: "Erro ao copiar", variant: "destructive" });
    }
  };

  if (!monitor) return null;

  // Calculate statistics
  const validReadings = readings.filter((r) => r.status === "ok");
  const currentAds = validReadings.length > 0 
    ? validReadings[validReadings.length - 1].ads_active_count 
    : 0;
  const avgAds = validReadings.length > 0
    ? Math.round(validReadings.reduce((sum, r) => sum + r.ads_active_count, 0) / validReadings.length)
    : 0;
  const maxAds = validReadings.length > 0
    ? Math.max(...validReadings.map((r) => r.ads_active_count))
    : 0;
  const minAds = validReadings.length > 0
    ? Math.min(...validReadings.map((r) => r.ads_active_count))
    : 0;

  // Calculate trend
  const recentReadings = validReadings.slice(-7);
  const olderReadings = validReadings.slice(-14, -7);
  const recentAvg = recentReadings.length > 0
    ? recentReadings.reduce((sum, r) => sum + r.ads_active_count, 0) / recentReadings.length
    : 0;
  const olderAvg = olderReadings.length > 0
    ? olderReadings.reduce((sum, r) => sum + r.ads_active_count, 0) / olderReadings.length
    : recentAvg;
  
  const trendPercent = olderAvg > 0 
    ? Math.round(((recentAvg - olderAvg) / olderAvg) * 100)
    : 0;

  // Days monitoring
  const daysMonitoring = validReadings.length > 0
    ? differenceInDays(
        parseISO(validReadings[validReadings.length - 1].timestamp),
        parseISO(validReadings[0].timestamp)
      ) + 1
    : 0;

  // Chart data (last 14 days, one point per day)
  const chartData = (() => {
    const dayMap: Record<string, number[]> = {};
    validReadings.forEach((r) => {
      const day = format(parseISO(r.timestamp), "dd/MM");
      if (!dayMap[day]) dayMap[day] = [];
      dayMap[day].push(r.ads_active_count);
    });
    return Object.entries(dayMap)
      .slice(-14)
      .map(([day, counts]) => ({
        day,
        ads: Math.round(counts.reduce((a, b) => a + b, 0) / counts.length),
      }));
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Insights: {monitor.name}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Status Badge */}
              <div className="flex items-center gap-2">
                <Badge variant={monitor.is_active ? "default" : "secondary"}>
                  {monitor.is_active ? "Ativo" : "Pausado"}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {daysMonitoring} dias monitorando
                </span>
              </div>

              {/* Statistics Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-card border">
                  <p className="text-sm text-muted-foreground">Ads Ativos Agora</p>
                  <p className="text-2xl font-bold">{currentAds.toLocaleString("pt-BR")}</p>
                </div>
                <div className="p-4 rounded-lg bg-card border">
                  <p className="text-sm text-muted-foreground">Média Diária</p>
                  <p className="text-2xl font-bold">{avgAds.toLocaleString("pt-BR")}</p>
                </div>
                <div className="p-4 rounded-lg bg-card border">
                  <p className="text-sm text-muted-foreground">Máximo</p>
                  <p className="text-2xl font-bold">{maxAds.toLocaleString("pt-BR")}</p>
                </div>
                <div className="p-4 rounded-lg bg-card border">
                  <p className="text-sm text-muted-foreground">Mínimo</p>
                  <p className="text-2xl font-bold">{minAds.toLocaleString("pt-BR")}</p>
                </div>
              </div>

              {/* Trend */}
              <div className="flex items-center gap-3 p-4 rounded-lg bg-card border">
                {trendPercent > 5 ? (
                  <TrendingUp className="h-5 w-5 text-success" />
                ) : trendPercent < -5 ? (
                  <TrendingDown className="h-5 w-5 text-destructive" />
                ) : (
                  <Minus className="h-5 w-5 text-muted-foreground" />
                )}
                <div>
                  <p className="font-medium">
                    {trendPercent > 5 
                      ? "Tendência de crescimento"
                      : trendPercent < -5
                      ? "Tendência de queda"
                      : "Estável"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {trendPercent > 0 ? "+" : ""}{trendPercent}% nos últimos 7 dias vs semana anterior
                  </p>
                </div>
              </div>

              {/* Chart */}
              {chartData.length > 1 && (
                <div className="p-4 rounded-lg bg-card border">
                  <p className="text-sm font-medium mb-4">Histórico (14 dias)</p>
                  <ResponsiveContainer width="100%" height={150}>
                    <LineChart data={chartData}>
                      <XAxis 
                        dataKey="day" 
                        tick={{ fontSize: 10 }} 
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <YAxis 
                        tick={{ fontSize: 10 }} 
                        stroke="hsl(var(--muted-foreground))"
                        width={40}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                        labelStyle={{ color: "hsl(var(--foreground))" }}
                      />
                      <Line
                        type="monotone"
                        dataKey="ads"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Top Scaled Ads */}
              {topAds.length > 0 ? (
                <>
                  <Separator />
                  <div>
                    <h3 className="font-medium flex items-center gap-2 mb-4">
                      <Flame className="h-4 w-4 text-orange-500" />
                      Top Anúncios Mais Escalados
                    </h3>
                    <div className="space-y-3">
                      {topAds.map((ad, index) => (
                        <div
                          key={ad.id}
                          className="p-3 rounded-lg bg-card border flex items-start gap-3"
                        >
                          <span className="text-lg font-bold text-muted-foreground">
                            #{index + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-xs">
                                {ad.days_active} dias ativos
                              </Badge>
                              <Badge variant="secondary" className="text-xs">
                                Visto {ad.times_seen}x
                              </Badge>
                            </div>
                            {ad.ad_body && (
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {ad.ad_body}
                              </p>
                            )}
                            {ad.ad_start_date && (
                              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Início: {format(parseISO(ad.ad_start_date), "dd/MM/yyyy", { locale: ptBR })}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <Separator />
                  <div className="p-4 rounded-lg bg-muted/50 border border-dashed">
                    <h3 className="font-medium flex items-center gap-2 mb-2">
                      <Flame className="h-4 w-4 text-orange-500" />
                      Anúncios Mais Escalados
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Os dados de anúncios individuais serão coletados automaticamente nas próximas leituras. 
                      A Meta Ad Library não expõe IDs de anúncios diretamente no HTML público, então essa funcionalidade 
                      depende de padrões específicos que podem variar.
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      💡 Dica: Use o botão "Abrir Ad Library" para ver os anúncios diretamente na plataforma da Meta.
                    </p>
                  </div>
                </>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={copyLink}
                >
                  {copied ? (
                    <Check className="h-4 w-4 mr-2" />
                  ) : (
                    <Copy className="h-4 w-4 mr-2" />
                  )}
                  Copiar Link
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => window.open(monitor.ad_library_url, "_blank")}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Abrir Ad Library
                </Button>
              </div>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
