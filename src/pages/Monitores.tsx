import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TagChip } from "@/components/ui/tag-chip";
import { NewMonitorDialog } from "@/components/monitors/NewMonitorDialog";
import { ManageTagsDialog } from "@/components/monitors/ManageTagsDialog";
import { EditMonitorDialog } from "@/components/monitors/EditMonitorDialog";
import {
  Plus,
  Search,
  Radio,
  MoreVertical,
  Play,
  Pause,
  Trash2,
  Edit,
  Clock,
  Loader2,
  RefreshCw,
  Tags,
  Folder,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

interface Tag {
  id: string;
  name: string;
  type: 'nicho' | 'idioma' | 'pais' | 'custom';
}

interface Group {
  id: string;
  name: string;
  color: string;
}

interface Monitor {
  id: string;
  name: string;
  ad_library_url: string;
  is_active: boolean;
  group_id: string | null;
  group_name?: string;
  schedule_config: {
    interval: number;
    days: string[];
    windows: string[];
  };
  created_at: string;
  tags: Tag[];
  latest_reading?: {
    ads_active_count: number;
    timestamp: string;
    status: string;
  };
}

function MonitoresContent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [scrapingMonitors, setScrapingMonitors] = useState<Set<string>>(new Set());
  const [tagsDialogOpen, setTagsDialogOpen] = useState(false);
  const [selectedMonitorForTags, setSelectedMonitorForTags] = useState<Monitor | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedMonitorForEdit, setSelectedMonitorForEdit] = useState<Monitor | null>(null);

  const fetchMonitors = async () => {
    if (!user) return;

    try {
      // Fetch monitors
      const { data: monitorsData, error: monitorsError } = await supabase
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

      if (monitorsError) throw monitorsError;

      // Fetch latest readings for each monitor
      const monitorIds = monitorsData?.map(m => m.id) || [];
      let readingsMap: Record<string, any> = {};

      if (monitorIds.length > 0) {
        const { data: readingsData } = await supabase
          .from('readings')
          .select('*')
          .in('monitor_id', monitorIds)
          .order('timestamp', { ascending: false });

        if (readingsData) {
          readingsData.forEach((reading) => {
            if (!readingsMap[reading.monitor_id]) {
              readingsMap[reading.monitor_id] = reading;
            }
          });
        }
      }

      // Transform data
      const transformedMonitors: Monitor[] = (monitorsData || []).map((m) => ({
        id: m.id,
        name: m.name,
        ad_library_url: m.ad_library_url,
        is_active: m.is_active,
        group_id: m.group_id,
        schedule_config: m.schedule_config as Monitor['schedule_config'],
        created_at: m.created_at,
        tags: m.monitor_tags?.map((mt: any) => mt.tags).filter(Boolean) || [],
        latest_reading: readingsMap[m.id] ? {
          ads_active_count: readingsMap[m.id].ads_active_count,
          timestamp: readingsMap[m.id].timestamp,
          status: readingsMap[m.id].status,
        } : undefined,
      }));

      setMonitors(transformedMonitors);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar monitores",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTags = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .eq('user_id', user.id)
      .order('name');

    if (!error && data) {
      setTags(data as Tag[]);
    }
  };

  const fetchGroups = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('groups')
      .select('id, name, color')
      .eq('user_id', user.id)
      .order('name');

    if (!error && data) {
      setGroups(data as Group[]);
    }
  };

  useEffect(() => {
    fetchMonitors();
    fetchTags();
    fetchGroups();
  }, [user]);

  const toggleMonitorStatus = async (monitorId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('monitors')
        .update({ is_active: !currentStatus })
        .eq('id', monitorId);

      if (error) throw error;

      setMonitors(prev =>
        prev.map(m =>
          m.id === monitorId ? { ...m, is_active: !currentStatus } : m
        )
      );

      toast({
        title: currentStatus ? "Monitor pausado" : "Monitor ativado",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar monitor",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteMonitor = async (monitorId: string) => {
    try {
      const { error } = await supabase
        .from('monitors')
        .delete()
        .eq('id', monitorId);

      if (error) throw error;

      setMonitors(prev => prev.filter(m => m.id !== monitorId));

      toast({
        title: "Monitor excluído",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao excluir monitor",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const scrapeMonitor = async (monitorId: string, url: string, name: string) => {
    setScrapingMonitors(prev => new Set(prev).add(monitorId));

    try {
      const { data, error } = await supabase.functions.invoke('scrape-ad-library', {
        body: { monitor_id: monitorId, url },
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Coleta realizada!",
          description: `${name}: ${data.ads_count.toLocaleString('pt-BR')} anúncios ativos`,
        });
        // Refresh monitors to show updated reading
        fetchMonitors();
      } else {
        toast({
          title: "Coleta com problemas",
          description: data.error || "Não foi possível extrair o número de anúncios",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro na coleta",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setScrapingMonitors(prev => {
        const next = new Set(prev);
        next.delete(monitorId);
        return next;
      });
    }
  };

  const openTagsDialog = (monitor: Monitor) => {
    setSelectedMonitorForTags(monitor);
    setTagsDialogOpen(true);
  };

  const openEditDialog = (monitor: Monitor) => {
    setSelectedMonitorForEdit(monitor);
    setEditDialogOpen(true);
  };

  const removeTagFromMonitor = async (monitorId: string, tagId: string) => {
    try {
      const { error } = await supabase
        .from('monitor_tags')
        .delete()
        .eq('monitor_id', monitorId)
        .eq('tag_id', tagId);

      if (error) throw error;

      // Update local state
      setMonitors(prev =>
        prev.map(m =>
          m.id === monitorId
            ? { ...m, tags: m.tags.filter(t => t.id !== tagId) }
            : m
        )
      );

      toast({ title: "Tag removida" });
    } catch (error: any) {
      toast({
        title: "Erro ao remover tag",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const filteredMonitors = monitors.filter(
    (monitor) =>
      monitor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      monitor.tags.some((tag) =>
        tag.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
  );

  const getScheduleLabel = (config: Monitor['schedule_config']) => {
    const windowLabels: Record<string, string> = {
      dawn: 'Madrugada',
      morning: 'Manhã',
      afternoon: 'Tarde',
      evening: 'Noite',
    };
    const windows = config.windows.map(w => windowLabels[w]).filter(Boolean).join('/');
    return `A cada ${config.interval} min • ${windows || '24h'}`;
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Monitores</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie seus monitores de anúncios
            </p>
          </div>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90 glow-hover"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Monitor
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou tag..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-card border-border"
          />
        </div>

        {/* Monitors List */}
        <div className="space-y-3">
          {filteredMonitors.map((monitor) => (
            <div
              key={monitor.id}
              className="metric-card flex flex-col lg:flex-row lg:items-center gap-4 hover:border-primary/30 transition-colors"
            >
              {/* Left: Icon and Info */}
              <div className="flex items-start gap-4 flex-1">
                <div
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-xl flex-shrink-0",
                    monitor.is_active
                      ? "bg-success/10 text-success"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  <Radio className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-lg font-semibold text-foreground">
                      {monitor.name}
                    </h3>
                    {monitor.group_id && groups.find((g) => g.id === monitor.group_id) && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1"
                        style={{
                          backgroundColor: `${groups.find((g) => g.id === monitor.group_id)?.color}20`,
                          color: groups.find((g) => g.id === monitor.group_id)?.color,
                        }}
                      >
                        <Folder className="h-3 w-3" />
                        {groups.find((g) => g.id === monitor.group_id)?.name}
                      </span>
                    )}
                    <div className="flex items-center gap-1.5">
                      <div
                        className={cn(
                          "w-2 h-2 rounded-full",
                          monitor.is_active ? "bg-success animate-pulse" : "bg-muted-foreground"
                        )}
                      />
                      <span
                        className={cn(
                          "text-sm",
                          monitor.is_active ? "text-success" : "text-muted-foreground"
                        )}
                      >
                        {monitor.is_active ? "Ativo" : "Pausado"}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground truncate mt-1">
                    {monitor.ad_library_url}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {monitor.tags.map((tag) => (
                      <TagChip
                        key={tag.id}
                        name={tag.name}
                        type={tag.type}
                        size="sm"
                        removable
                        onRemove={() => removeTagFromMonitor(monitor.id, tag.id)}
                      />
                    ))}
                    <button
                      onClick={() => openTagsDialog(monitor)}
                      className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" />
                      Tags
                    </button>
                  </div>
                </div>
              </div>

              {/* Right: Stats and Actions */}
              <div className="flex items-center gap-6 lg:gap-8">
                <div className="text-right">
                  <p className="text-2xl font-bold text-foreground">
                    {monitor.latest_reading
                      ? monitor.latest_reading.ads_active_count.toLocaleString('pt-BR')
                      : '-'}
                  </p>
                  <p className="text-xs text-muted-foreground">anúncios ativos</p>
                </div>
                <div className="text-right hidden md:block">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span className="text-sm">{getScheduleLabel(monitor.schedule_config)}</span>
                  </div>
                  {monitor.latest_reading && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Última: {formatTimestamp(monitor.latest_reading.timestamp)}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => scrapeMonitor(monitor.id, monitor.ad_library_url, monitor.name)}
                  disabled={scrapingMonitors.has(monitor.id)}
                  className="h-8"
                >
                  {scrapingMonitors.has(monitor.id) ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem
                      onClick={() => scrapeMonitor(monitor.id, monitor.ad_library_url, monitor.name)}
                      disabled={scrapingMonitors.has(monitor.id)}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Coletar Agora
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={(e) => {
                        e.preventDefault();
                        openTagsDialog(monitor);
                      }}
                    >
                      <Tags className="h-4 w-4 mr-2" />
                      Gerenciar Tags
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={(e) => {
                        e.preventDefault();
                        openEditDialog(monitor);
                      }}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toggleMonitorStatus(monitor.id, monitor.is_active)}>
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
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => deleteMonitor(monitor.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>

        {filteredMonitors.length === 0 && !isLoading && (
          <div className="text-center py-12">
            <Radio className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground">
              {monitors.length === 0
                ? "Nenhum monitor cadastrado"
                : "Nenhum monitor encontrado"}
            </h3>
            <p className="text-muted-foreground mt-1">
              {monitors.length === 0
                ? "Crie seu primeiro monitor para começar a monitorar anúncios."
                : "Tente ajustar sua busca."}
            </p>
            {monitors.length === 0 && (
              <Button
                className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => setDialogOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeiro Monitor
              </Button>
            )}
          </div>
        )}

        <NewMonitorDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSuccess={() => {
            fetchMonitors();
            fetchTags();
            fetchGroups();
          }}
          existingTags={tags}
          existingGroups={groups}
        />

        {selectedMonitorForTags && (
          <ManageTagsDialog
            open={tagsDialogOpen}
            onOpenChange={setTagsDialogOpen}
            monitorId={selectedMonitorForTags.id}
            monitorName={selectedMonitorForTags.name}
            currentTags={selectedMonitorForTags.tags}
            allTags={tags}
            onSuccess={() => {
              fetchMonitors();
              fetchTags();
            }}
          />
        )}

        {selectedMonitorForEdit && (
          <EditMonitorDialog
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            monitor={selectedMonitorForEdit}
            groups={groups}
            onSuccess={() => {
              fetchMonitors();
              fetchGroups();
            }}
          />
        )}
      </div>
    </AppLayout>
  );
}

export default function Monitores() {
  return (
    <ProtectedRoute>
      <MonitoresContent />
    </ProtectedRoute>
  );
}
