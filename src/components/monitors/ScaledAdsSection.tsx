import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Flame, Download, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface AdDetail {
  id: string;
  ad_archive_id: string;
  collation_count: number;
  ad_title: string | null;
  ad_body: string | null;
  link_url: string | null;
  ad_start_date: string | null;
  days_active: number;
  is_active: boolean;
  last_seen_at: string;
}

const thresholdKey = (monitorId: string) => `scaled-ads-threshold-${monitorId}`;

function adLibraryUrl(adArchiveId: string) {
  return `https://www.facebook.com/ads/library/?id=${adArchiveId}`;
}

function exportCsv(monitorName: string, ads: AdDetail[]) {
  const esc = (v: string | number | null) =>
    `"${String(v ?? "").replace(/"/g, '""')}"`;

  const header = [
    "repeticoes",
    "titulo",
    "texto",
    "link_biblioteca",
    "link_destino",
    "inicio",
    "dias_ativo",
    "ativo",
    "id_anuncio",
  ].join(";");

  const lines = ads.map((ad) =>
    [
      ad.collation_count,
      esc(ad.ad_title),
      esc(ad.ad_body),
      esc(adLibraryUrl(ad.ad_archive_id)),
      esc(ad.link_url),
      esc(ad.ad_start_date ? new Date(ad.ad_start_date).toLocaleDateString("pt-BR") : ""),
      ad.days_active,
      ad.is_active ? "sim" : "nao",
      esc(ad.ad_archive_id),
    ].join(";")
  );

  // BOM para o Excel abrir acentos corretamente
  const csv = "﻿" + [header, ...lines].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `escalados-${monitorName.replace(/[^\w-]+/g, "_")}-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

interface ScaledAdsSectionProps {
  monitorId: string;
  monitorName: string;
}

export function ScaledAdsSection({ monitorId, monitorName }: ScaledAdsSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const [threshold, setThreshold] = useState<number>(() => {
    const saved = localStorage.getItem(thresholdKey(monitorId));
    return saved ? Math.max(1, parseInt(saved, 10) || 1) : 5;
  });

  const { data: ads = [], isLoading } = useQuery({
    queryKey: ["ad-details", monitorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ad_details")
        .select(
          "id, ad_archive_id, collation_count, ad_title, ad_body, link_url, ad_start_date, days_active, is_active, last_seen_at"
        )
        .eq("monitor_id", monitorId)
        .order("collation_count", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as AdDetail[];
    },
    staleTime: 1000 * 60,
    enabled: expanded,
  });

  const updateThreshold = (value: number) => {
    const v = Math.max(1, value || 1);
    setThreshold(v);
    localStorage.setItem(thresholdKey(monitorId), String(v));
  };

  const filtered = ads.filter((ad) => ad.collation_count >= threshold);
  const visible = filtered.slice(0, 5);

  return (
    <div className="mt-2 border-t border-border/50 pt-2">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          <Flame className="h-3 w-3 text-orange-500" />
          <span>Escalados</span>
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>

        {expanded && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground">min:</span>
            <Input
              type="number"
              min={1}
              value={threshold}
              onChange={(e) => updateThreshold(parseInt(e.target.value, 10))}
              className="h-6 w-14 text-xs px-1.5"
              title="Mostrar anúncios com pelo menos este número de repetições"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              disabled={filtered.length === 0}
              onClick={() => exportCsv(monitorName, filtered)}
              title={`Baixar CSV (${filtered.length} anúncios com ${threshold}+ repetições)`}
            >
              <Download className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {expanded && (
        <div className="mt-1.5 space-y-1">
          {isLoading ? (
            <p className="text-[10px] text-muted-foreground">Carregando…</p>
          ) : filtered.length === 0 ? (
            <p className="text-[10px] text-muted-foreground">
              {ads.length === 0
                ? 'Nenhum anúncio coletado ainda — clique em "Coletar agora" (↻) no topo do card.'
                : `Nenhum anúncio com ${threshold}+ repetições (maior: ${ads[0]?.collation_count ?? 0}).`}
            </p>
          ) : (
            <>
              {visible.map((ad) => (
                <a
                  key={ad.id}
                  href={adLibraryUrl(ad.ad_archive_id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 group"
                  title="Abrir na Biblioteca de Anúncios"
                >
                  <span
                    className={cn(
                      "text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0",
                      ad.collation_count >= threshold * 2
                        ? "bg-orange-500/20 text-orange-400"
                        : "bg-primary/15 text-primary"
                    )}
                  >
                    ×{ad.collation_count}
                  </span>
                  <span className="text-[10px] text-muted-foreground group-hover:text-primary truncate transition-colors">
                    {ad.ad_title || ad.ad_body || `Anúncio ${ad.ad_archive_id}`}
                  </span>
                  <ExternalLink className="h-2.5 w-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity" />
                </a>
              ))}
              {filtered.length > visible.length && (
                <p className="text-[10px] text-muted-foreground">
                  +{filtered.length - visible.length} anúncios no CSV (botão ⬇)
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
