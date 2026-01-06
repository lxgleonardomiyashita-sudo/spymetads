import { Button } from "@/components/ui/button";
import { TagChip } from "@/components/ui/tag-chip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreVertical,
  Play,
  Pause,
  Trash2,
  Edit,
  Loader2,
  RefreshCw,
  Tags,
  Folder,
  ExternalLink,
  BarChart3,
  Star,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTimestamp } from "@/lib/formatters";
import type { Monitor, Group } from "@/types/monitor";

interface MonitorCardProps {
  monitor: Monitor;
  groups?: Group[];
  isSaved: boolean;
  isScraping: boolean;
  onToggleSave: () => void;
  onInsights?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onToggleStatus?: () => void;
  onScrape?: () => void;
  onManageTags?: () => void;
  showGroupBadge?: boolean;
}

export function MonitorCard({
  monitor,
  groups = [],
  isSaved,
  isScraping,
  onToggleSave,
  onInsights,
  onEdit,
  onDelete,
  onToggleStatus,
  onScrape,
  onManageTags,
  showGroupBadge = true,
}: MonitorCardProps) {
  const group = groups.find((g) => g.id === monitor.group_id);

  return (
    <div className="metric-card p-4 hover:border-primary/30 transition-colors flex flex-col">
      {/* Header: Status + Actions */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "w-2 h-2 rounded-full flex-shrink-0",
              monitor.is_active ? "bg-success animate-pulse" : "bg-muted-foreground"
            )}
          />
          <span
            className={cn(
              "text-xs font-medium",
              monitor.is_active ? "text-success" : "text-muted-foreground"
            )}
          >
            {monitor.is_active ? "Ativo" : "Pausado"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7",
              isSaved && "text-yellow-500"
            )}
            onClick={onToggleSave}
            title={isSaved ? "Remover do Spy Especial" : "Salvar no Spy Especial"}
          >
            <Star className={cn("h-3.5 w-3.5", isSaved && "fill-yellow-500")} />
          </Button>
          {onInsights && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onInsights}
              title="Ver Insights"
            >
              <BarChart3 className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => window.open(monitor.ad_library_url, '_blank')}
            title="Abrir Ad Library"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
          {onScrape && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onScrape}
              disabled={isScraping}
              title="Coletar agora"
            >
              {isScraping ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {onScrape && (
                <DropdownMenuItem
                  onClick={onScrape}
                  disabled={isScraping}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Coletar Agora
                </DropdownMenuItem>
              )}
              {onManageTags && (
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    onManageTags();
                  }}
                >
                  <Tags className="h-4 w-4 mr-2" />
                  Gerenciar Tags
                </DropdownMenuItem>
              )}
              {onEdit && (
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    onEdit();
                  }}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </DropdownMenuItem>
              )}
              {onToggleStatus && (
                <DropdownMenuItem onClick={onToggleStatus}>
                  {monitor.is_active ? (
                    <>
                      <Pause className="h-4 w-4 mr-2" />
                      Pausar
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Ativar
                    </>
                  )}
                </DropdownMenuItem>
              )}
              {onDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={onDelete}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Name + Group */}
      <div className="mb-2">
        <h3 className="text-sm font-semibold text-foreground truncate" title={monitor.name}>
          {monitor.name}
        </h3>
        {showGroupBadge && group && (
          <span
            className="text-xs px-1.5 py-0.5 rounded-full inline-flex items-center gap-1 mt-1"
            style={{
              backgroundColor: `${group.color}20`,
              color: group.color,
            }}
          >
            <Folder className="h-2.5 w-2.5" />
            {group.name}
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="flex-1 flex flex-col justify-center py-2">
        <p className="text-3xl font-bold text-foreground text-center">
          {monitor.latest_reading
            ? monitor.latest_reading.ads_active_count.toLocaleString('pt-BR')
            : '-'}
        </p>
        <p className="text-xs text-muted-foreground text-center">anúncios ativos</p>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap items-center gap-1.5 mt-2 min-h-[24px]">
        {monitor.tags.map((tag) => (
          <TagChip
            key={tag.id}
            name={tag.name}
            type={tag.type}
            size="sm"
          />
        ))}
        {onManageTags && (
          <button
            onClick={onManageTags}
            className="text-xs text-muted-foreground hover:text-primary transition-colors ml-auto"
          >
            <Plus className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Last update */}
      {monitor.latest_reading && (
        <p className="text-[10px] text-muted-foreground mt-2 text-center">
          {formatTimestamp(monitor.latest_reading.timestamp)}
        </p>
      )}
    </div>
  );
}
