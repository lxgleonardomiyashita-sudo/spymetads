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

interface Reading {
  ads_active_count: number;
  timestamp: string;
  status: string;
}

interface AdDetail {
  id: string;
  ad_archive_id: string;
  ad_title: string | null;
  ad_body: string | null;
  times_seen: number | null;
  days_active: number | null;
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
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: readingsData } = await supabase
        .from("readings")
        .select("ads_active_count, timestamp, status")
        .eq("monitor_id", monitor.id)
        .eq("status", "ok")
        .gte("timestamp", thirtyDaysAgo.toISOString())
        .order("timestamp", { ascending: true });

      if (readingsData) {
        setReadings(readingsData);
      }

      // Fetch top ads by times_seen
      const { data: adsData } = await supabase
        .from("ad_details")
        .select("id, ad_archive_id, ad_title, ad_body, times_seen, days_active")
        .eq("monitor_id", monitor.id)
        .order("times_seen", { ascending: false, nullsFirst: false })
        .limit(3);

      if (adsData) {
        setTopAds(adsData);
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

  // Generate link for duplicated creatives (sorted by relevancy with grouping)
  const getDuplicatedCreativesLink = () => {
    if (!monitor) return "";
    try {
      const url = new URL(monitor.ad_library_url);
      // Set sorting parameters for most duplicated/grouped creatives
      url.searchParams.set("sort_data[direction]", "desc");
      url.searchParams.set("sort_data[mode]", "relevancy_monthly_grouped");
      return url.toString();
    } catch {
      // Fallback if URL parsing fails
      const baseUrl = monitor.ad_library_url;
      const separator = baseUrl.includes("?") ? "&" : "?";
      return `${baseUrl}${separator}sort_data[direction]=desc&sort_data[mode]=relevancy_monthly_grouped`;
    }
  };

  // Generate direct link to a specific ad in Ad Library
  const getAdDirectLink = (adArchiveId: string) => {
    return `https://www.facebook.com/ads/library/?id=${adArchiveId}`;
  };

  // Check if all ads have only 1 times_seen
  const allSingleRepetition = topAds.length > 0 && topAds.every(ad => (ad.times_seen || 1) <= 1);

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

              <Separator />

              {/* Top Duplicated Creatives */}
              <div className="p-4 rounded-lg bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Flame className="h-5 w-5 text-orange-500" />
                  <h3 className="font-medium">Criativos Mais Escalados</h3>
                </div>
                
                {topAds.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum criativo individual capturado ainda. Execute uma leitura para coletar dados.
                  </p>
                ) : allSingleRepetition ? (
                  <p className="text-sm text-muted-foreground">
                    Todos os criativos deste anunciante possuem apenas 1 repetição.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {topAds.map((ad, index) => (
                      <button
                        key={ad.id}
                        onClick={() => window.open(getAdDirectLink(ad.ad_archive_id), "_blank")}
                        className="w-full flex items-center gap-3 p-3 rounded-lg bg-card/50 hover:bg-card border border-border/50 hover:border-border transition-colors text-left"
                      >
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-500/20 text-orange-500 flex items-center justify-center text-xs font-bold">
                          {index + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {ad.ad_title || ad.ad_body?.slice(0, 50) || `Anúncio ${ad.ad_archive_id}`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {ad.times_seen || 1}x duplicado • {ad.days_active || 0} dias ativo
                          </p>
                        </div>
                        <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                )}

                <Button
                  className="w-full mt-4 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
                  onClick={() => window.open(getDuplicatedCreativesLink(), "_blank")}
                >
                  <Flame className="h-4 w-4 mr-2" />
                  Ver Todos na Ad Library
                  <ExternalLink className="h-4 w-4 ml-2" />
                </Button>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
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
                  variant="outline"
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
