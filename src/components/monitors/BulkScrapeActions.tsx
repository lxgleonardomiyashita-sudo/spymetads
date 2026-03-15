import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { RefreshCw, ChevronDown, Tags, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Monitor, Tag } from "@/types/monitor";

interface BulkScrapeActionsProps {
  monitors: Monitor[];
  tags: Tag[];
  scrapingMonitors: Set<string>;
  onScrapeMonitors: (monitorIds: string[]) => Promise<void>;
}

export function BulkScrapeActions({
  monitors,
  tags,
  scrapingMonitors,
  onScrapeMonitors,
}: BulkScrapeActionsProps) {
  const [isBulkScraping, setIsBulkScraping] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  const [selectedTagForScrape, setSelectedTagForScrape] = useState<string | null>(null);

  const activeMonitors = monitors.filter((m) => m.is_active);

  // Get tags that have at least one active monitor
  const tagsWithMonitors = tags.filter((tag) =>
    activeMonitors.some((m) => m.tags.some((t) => t.id === tag.id))
  );

  const handleBulkScrape = async (monitorIds: string[], tagName?: string) => {
    if (monitorIds.length === 0) return;

    setIsBulkScraping(true);
    setSelectedTagForScrape(tagName || null);
    setBulkProgress({ current: 0, total: monitorIds.length });

    try {
      await onScrapeMonitors(monitorIds);
    } finally {
      setIsBulkScraping(false);
      setSelectedTagForScrape(null);
      setBulkProgress({ current: 0, total: 0 });
    }
  };

  const handleScrapeAll = () => {
    const ids = activeMonitors.map((m) => m.id);
    handleBulkScrape(ids);
  };

  const handleScrapeByTag = (tagId: string, tagName: string) => {
    const ids = activeMonitors
      .filter((m) => m.tags.some((t) => t.id === tagId))
      .map((m) => m.id);
    handleBulkScrape(ids, tagName);
  };

  const isAnyMonitorScraping = scrapingMonitors.size > 0 || isBulkScraping;

  return (
    <div className="flex items-center gap-2">
      {/* Progress indicator when bulk scraping */}
      {isBulkScraping && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-lg">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm text-foreground">
            {selectedTagForScrape ? `[${selectedTagForScrape}] ` : ""}
            {bulkProgress.current}/{bulkProgress.total}
          </span>
          <Progress 
            value={(bulkProgress.current / bulkProgress.total) * 100} 
            className="w-20 h-2"
          />
        </div>
      )}

      {/* Scrape All Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleScrapeAll}
        disabled={isAnyMonitorScraping || activeMonitors.length === 0}
        className="gap-2"
      >
        {isAnyMonitorScraping && !selectedTagForScrape ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        Atualizar Todos
        <span className="text-xs text-muted-foreground">({activeMonitors.length})</span>
      </Button>

      {/* Scrape by Tag Dropdown */}
      {tagsWithMonitors.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={isAnyMonitorScraping}
              className="gap-2"
            >
              <Tags className="h-4 w-4" />
              Por Tag
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 max-h-64 overflow-y-auto">
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Selecione uma tag para atualizar
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {tagsWithMonitors.map((tag) => {
              const count = activeMonitors.filter((m) =>
                m.tags.some((t) => t.id === tag.id)
              ).length;
              
              return (
                <DropdownMenuItem
                  key={tag.id}
                  onClick={() => handleScrapeByTag(tag.id, tag.name)}
                  className="flex items-center justify-between"
                >
                  <span className={cn(
                    "inline-flex items-center gap-1.5",
                    tag.type === 'nicho' && "text-cyan-400",
                    tag.type === 'idioma' && "text-purple-400",
                    tag.type === 'pais' && "text-emerald-400",
                    tag.type === 'custom' && "text-amber-400"
                  )}>
                    <span className="w-2 h-2 rounded-full bg-current" />
                    {tag.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {count} monitor{count !== 1 ? "es" : ""}
                  </span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
