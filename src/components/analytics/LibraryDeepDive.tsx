import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Clock, Flame, ExternalLink, TrendingUp, TrendingDown, Minus, Library } from "lucide-react";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

const PRINCIPAL = "__principal__";
const TOTAL = "__total__";

interface MonitorRow {
  id: string;
  name: string;
  ad_library_url: string;
  extra_ad_library_urls: string[] | null;
}

interface ReadingRow {
  ads_active_count: number;
  timestamp: string;
  library_url: string | null;
}

interface AdDetailRow {
  id: string;
  ad_archive_id: string;
  collation_count: number;
  collation_history: { t: string; c: number }[] | null;
  ad_title: string | null;
  ad_body: string | null;
  link_url: string | null;
  days_active: number;
  is_active: boolean;
}

const shortUrl = (url: string) =>
  url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 42) + (url.length > 50 ? "…" : "");

function libKey(r: ReadingRow, mainUrl: string) {
  return !r.library_url || r.library_url === mainUrl ? PRINCIPAL : r.library_url;
}

/** Média de anúncios por bucket (hora 0-23 ou dia 0-6). */
function averagesByBucket(readings: ReadingRow[], buckets: number, getBucket: (d: Date) => number) {
  const acc: { sum: number; n: number }[] = Array.from({ length: buckets }, () => ({ sum: 0, n: 0 }));
  for (const r of readings) {
    const b = getBucket(new Date(r.timestamp));
    acc[b].sum += r.ads_active_count;
    acc[b].n += 1;
  }
  return acc.map((a) => (a.n > 0 ? Math.round(a.sum / a.n) : null));
}

/** Junta médias por biblioteca somando bucket a bucket (visão Total). */
function sumSeries(series: (number | null)[][]) {
  const len = series[0]?.length ?? 0;
  return Array.from({ length: len }, (_, i) => {
    const vals = series.map((s) => s[i]).filter((v): v is number => v !== null);
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) : null;
  });
}

const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function LibraryDeepDive() {
  const [monitorId, setMonitorId] = useState<string>("");
  const [days, setDays] = useState<string>("14");
  const [libView, setLibView] = useState<string>(TOTAL);

  const { data: monitors = [] } = useQuery({
    queryKey: ["deepdive-monitors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monitors")
        .select("id, name, ad_library_url, extra_ad_library_urls")
        .order("name");
      if (error) throw error;
      return (data ?? []) as MonitorRow[];
    },
  });

  const monitor = monitors.find((m) => m.id === monitorId) ?? monitors[0];
  const extras = monitor?.extra_ad_library_urls ?? [];
  const hasMultiple = extras.length > 0;

  const { data: readings = [] } = useQuery({
    queryKey: ["deepdive-readings", monitor?.id, days],
    enabled: !!monitor,
    queryFn: async () => {
      const since = new Date(Date.now() - parseInt(days, 10) * 86400000).toISOString();
      const { data, error } = await supabase
        .from("readings")
        .select("ads_active_count, timestamp, library_url")
        .eq("monitor_id", monitor!.id)
        .eq("status", "ok")
        .gte("timestamp", since)
        .order("timestamp", { ascending: true })
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as ReadingRow[];
    },
  });

  const { data: adDetails = [] } = useQuery({
    queryKey: ["deepdive-ads", monitor?.id],
    enabled: !!monitor,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ad_details")
        .select("id, ad_archive_id, collation_count, collation_history, ad_title, ad_body, link_url, days_active, is_active")
        .eq("monitor_id", monitor!.id)
        .order("collation_count", { ascending: false })
        .limit(150);
      if (error) throw error;
      return (data ?? []) as unknown as AdDetailRow[];
    },
  });

  // ---------- Picos & baixas por biblioteca ----------
  const libOptions = useMemo(() => {
    if (!monitor) return [];
    const opts = [{ value: PRINCIPAL, label: "Principal", url: monitor.ad_library_url }];
    extras.forEach((url, i) => opts.push({ value: url, label: `Bib. ${i + 2}`, url }));
    return opts;
  }, [monitor, extras]);

  const { hourly, dow, perLibSummary } = useMemo(() => {
    if (!monitor) return { hourly: [], dow: [], perLibSummary: [] };

    const byLib = new Map<string, ReadingRow[]>();
    for (const r of readings) {
      const k = libKey(r, monitor.ad_library_url);
      if (!byLib.has(k)) byLib.set(k, []);
      byLib.get(k)!.push(r);
    }

    const forView = (view: string): { h: (number | null)[]; d: (number | null)[] } => {
      if (view === TOTAL) {
        const libs = [...byLib.values()];
        if (libs.length === 0) return { h: Array(24).fill(null), d: Array(7).fill(null) };
        return {
          h: sumSeries(libs.map((rs) => averagesByBucket(rs, 24, (dt) => dt.getHours()))),
          d: sumSeries(libs.map((rs) => averagesByBucket(rs, 7, (dt) => dt.getDay()))),
        };
      }
      const rs = byLib.get(view) ?? [];
      return {
        h: averagesByBucket(rs, 24, (dt) => dt.getHours()),
        d: averagesByBucket(rs, 7, (dt) => dt.getDay()),
      };
    };

    const view = forView(libView);
    const hourly = view.h.map((avg, h) => ({ label: `${String(h).padStart(2, "0")}h`, avg }));
    const dow = view.d.map((avg, d) => ({ label: DAY_NAMES[d], avg }));

    const perLibSummary = libOptions.map((opt) => {
      const rs = byLib.get(opt.value) ?? [];
      const h = averagesByBucket(rs, 24, (dt) => dt.getHours());
      const withData = h.map((v, i) => ({ v, i })).filter((x) => x.v !== null) as { v: number; i: number }[];
      const peak = withData.length ? withData.reduce((a, b) => (b.v > a.v ? b : a)) : null;
      const low = withData.length ? withData.reduce((a, b) => (b.v < a.v ? b : a)) : null;
      const media = rs.length ? Math.round(rs.reduce((a, r) => a + r.ads_active_count, 0) / rs.length) : 0;
      return { ...opt, leituras: rs.length, media, peak, low };
    });

    return { hourly, dow, perLibSummary };
  }, [readings, monitor, libView, libOptions]);

  const peakHour = useMemo(() => {
    const w = hourly.map((x, i) => ({ ...x, i })).filter((x) => x.avg !== null) as { label: string; avg: number; i: number }[];
    if (!w.length) return null;
    return {
      peak: w.reduce((a, b) => (b.avg > a.avg ? b : a)),
      low: w.reduce((a, b) => (b.avg < a.avg ? b : a)),
    };
  }, [hourly]);

  // ---------- Top 3 criativos (agrupando conjuntos com o mesmo criativo) ----------
  const topCreatives = useMemo(() => {
    const groups = new Map<string, AdDetailRow[]>();
    for (const ad of adDetails) {
      const text = `${ad.ad_title ?? ""}|${ad.ad_body ?? ""}`.toLowerCase().replace(/\s+/g, " ").trim();
      const key = text.length > 4 ? text : `#${ad.ad_archive_id}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(ad);
    }
    return [...groups.values()]
      .map((variants) => {
        const best = variants.reduce((a, b) => (b.collation_count > a.collation_count ? b : a));
        const total = variants.reduce((a, v) => a + v.collation_count, 0);
        const history = (best.collation_history ?? []).map((p) => ({
          t: new Date(p.t).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
          c: p.c,
        }));
        const delta = history.length >= 2 ? history[history.length - 1].c - history[0].c : 0;
        return {
          best,
          variants: [...variants].sort((a, b) => b.collation_count - a.collation_count),
          total,
          active: variants.filter((v) => v.is_active).length,
          maxDays: Math.max(...variants.map((v) => v.days_active)),
          history,
          delta,
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);
  }, [adDetails]);

  if (!monitor) return null;

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <CardTitle className="text-foreground flex items-center gap-2">
            <Library className="h-5 w-5 text-primary" />
            Análise por Biblioteca
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={monitor.id} onValueChange={(v) => { setMonitorId(v); setLibView(TOTAL); }}>
              <SelectTrigger className="w-[220px] bg-muted border-border h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monitors.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Tabs value={days} onValueChange={setDays}>
              <TabsList className="h-8">
                <TabsTrigger value="7" className="text-xs px-2">7d</TabsTrigger>
                <TabsTrigger value="14" className="text-xs px-2">14d</TabsTrigger>
                <TabsTrigger value="30" className="text-xs px-2">30d</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {hasMultiple && (
          <Tabs value={libView} onValueChange={setLibView} className="mt-2">
            <TabsList className="h-8 flex-wrap">
              <TabsTrigger value={TOTAL} className="text-xs px-2">Total (todas)</TabsTrigger>
              {libOptions.map((opt) => (
                <TabsTrigger key={opt.value} value={opt.value} className="text-xs px-2" title={opt.url}>
                  {opt.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Picos e baixas */}
        {peakHour ? (
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-orange-500/15 text-orange-400 border-orange-500/30 gap-1">
              <TrendingUp className="h-3 w-3" /> Pico: {peakHour.peak.label} ({peakHour.peak.avg.toLocaleString("pt-BR")} anúncios)
            </Badge>
            <Badge className="bg-sky-500/15 text-sky-400 border-sky-500/30 gap-1">
              <TrendingDown className="h-3 w-3" /> Baixa: {peakHour.low.label} ({peakHour.low.avg.toLocaleString("pt-BR")} anúncios)
            </Badge>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Sem leituras no período — colete algumas vezes ao longo do dia para revelar os picos.</p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1"><Clock className="h-3 w-3" /> Média por hora do dia</p>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={2} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" width={40} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                  <Bar dataKey="avg" radius={[3, 3, 0, 0]}>
                    {hourly.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={
                          peakHour && i === peakHour.peak.i ? "#f97316"
                          : peakHour && i === peakHour.low.i ? "#0ea5e9"
                          : "hsl(var(--primary) / 0.45)"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-2">Média por dia da semana</p>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dow}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" width={40} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                  <Bar dataKey="avg" fill="hsl(var(--primary) / 0.45)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Resumo por biblioteca (quando tem mais de uma) */}
        {hasMultiple && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left py-1.5 font-medium">Biblioteca</th>
                  <th className="text-right py-1.5 font-medium">Leituras</th>
                  <th className="text-right py-1.5 font-medium">Média</th>
                  <th className="text-right py-1.5 font-medium">Pico</th>
                  <th className="text-right py-1.5 font-medium">Baixa</th>
                </tr>
              </thead>
              <tbody>
                {perLibSummary.map((lib) => (
                  <tr key={lib.value} className="border-b border-border/40">
                    <td className="py-1.5">
                      <a href={lib.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" title={lib.url}>
                        {lib.label} · {shortUrl(lib.url)}
                      </a>
                    </td>
                    <td className="text-right py-1.5">{lib.leituras}</td>
                    <td className="text-right py-1.5 font-medium">{lib.media.toLocaleString("pt-BR")}</td>
                    <td className="text-right py-1.5 text-orange-400">
                      {lib.peak ? `${String(lib.peak.i).padStart(2, "0")}h (${lib.peak.v.toLocaleString("pt-BR")})` : "—"}
                    </td>
                    <td className="text-right py-1.5 text-sky-400">
                      {lib.low ? `${String(lib.low.i).padStart(2, "0")}h (${lib.low.v.toLocaleString("pt-BR")})` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Top 3 criativos escalados */}
        <div>
          <p className="text-sm font-semibold text-foreground flex items-center gap-1.5 mb-3">
            <Flame className="h-4 w-4 text-orange-500" /> Top 3 criativos mais escalados
          </p>
          {topCreatives.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nenhum anúncio individual coletado ainda — use "Coletar agora" (↻) no monitor.
            </p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {topCreatives.map((g, idx) => (
                <div key={g.best.id} className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{medals[idx]}</span>
                    <span className="text-xl font-bold text-orange-400">×{g.total.toLocaleString("pt-BR")}</span>
                    <span className="text-[10px] text-muted-foreground">repetições</span>
                    {g.delta !== 0 && (
                      <Badge variant="outline" className={g.delta > 0 ? "text-success gap-0.5" : "text-destructive gap-0.5"}>
                        {g.delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {g.delta > 0 ? "+" : ""}{g.delta}
                      </Badge>
                    )}
                    {g.delta === 0 && g.history.length >= 2 && (
                      <Badge variant="outline" className="text-muted-foreground gap-0.5"><Minus className="h-3 w-3" />estável</Badge>
                    )}
                  </div>

                  <p className="text-xs text-foreground line-clamp-2" title={g.best.ad_body ?? undefined}>
                    {g.best.ad_title || g.best.ad_body || `Anúncio ${g.best.ad_archive_id}`}
                  </p>

                  <div className="flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                    <span>{g.variants.length} conjunto{g.variants.length > 1 ? "s" : ""} de anúncios</span>
                    <span>•</span>
                    <span>{g.active}/{g.variants.length} ativos</span>
                    <span>•</span>
                    <span>{g.maxDays}d no ar</span>
                  </div>

                  {/* Evolução das repetições (funil de escala) */}
                  {g.history.length >= 2 && (
                    <div className="h-12">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={g.history}>
                          <Line type="monotone" dataKey="c" stroke="#f97316" strokeWidth={1.5} dot={false} />
                          <Tooltip
                            contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 11 }}
                            labelFormatter={(l) => `Dia ${l}`}
                            formatter={(v: number) => [`×${v}`, "repetições"]}
                          />
                          <XAxis dataKey="t" hide />
                          <YAxis hide domain={["dataMin", "dataMax"]} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Variações (funil dentro da biblioteca) */}
                  <div className="space-y-1">
                    {g.variants.slice(0, 4).map((v) => (
                      <a
                        key={v.id}
                        href={`https://www.facebook.com/ads/library/?id=${v.ad_archive_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 group"
                        title="Abrir este conjunto na Biblioteca"
                      >
                        <div className="h-1.5 rounded-full bg-orange-500/60 group-hover:bg-orange-400 transition-colors"
                          style={{ width: `${Math.max(8, (v.collation_count / g.variants[0].collation_count) * 60)}%` }}
                        />
                        <span className="text-[10px] text-muted-foreground group-hover:text-primary whitespace-nowrap">
                          ×{v.collation_count}{!v.is_active && " (pausado)"}
                        </span>
                        <ExternalLink className="h-2.5 w-2.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
                      </a>
                    ))}
                    {g.variants.length > 4 && (
                      <p className="text-[10px] text-muted-foreground">+{g.variants.length - 4} variações</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
