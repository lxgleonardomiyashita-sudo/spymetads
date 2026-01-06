import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import {
  ArrowLeft,
  Radio,
  Loader2,
  RefreshCw,
  Edit,
  Trash2,
  Plus,
  MoreVertical,
  Play,
  Pause,
  Tags,
  Folder,
  Link2,
  ExternalLink,
  BarChart3,
  Star,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TagChip } from "@/components/ui/tag-chip";
import { ManageTagsDialog } from "@/components/monitors/ManageTagsDialog";
import { EditMonitorDialog } from "@/components/monitors/EditMonitorDialog";
import { NewMonitorDialog } from "@/components/monitors/NewMonitorDialog";
import { LinkMonitorsDialog } from "@/components/monitors/LinkMonitorsDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Tag {
  id: string;
  name: string;
  type: 'nicho' | 'idioma' | 'pais' | 'custom';
}

interface Group {
  id: string;
  name: string;
  description: string | null;
  color: string;
}

interface Monitor {
  id: string;
  name: string;
  ad_library_url: string;
  is_active: boolean;
  group_id: string | null;
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

function GrupoDetalheContent() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [group, setGroup] = useState<Group | null>(null);
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [allGroups, setAllGroups] = useState<Group[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [scrapingMonitors, setScrapingMonitors] = useState<Set<string>>(new Set());
  const [tagsDialogOpen, setTagsDialogOpen] = useState(false);
  const [selectedMonitorForTags, setSelectedMonitorForTags] = useState<Monitor | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedMonitorForEdit, setSelectedMonitorForEdit] = useState<Monitor | null>(null);
  const [newMonitorDialogOpen, setNewMonitorDialogOpen] = useState(false);
  const [linkMonitorsDialogOpen, setLinkMonitorsDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  // Fetch saved monitors
  const { data: savedMonitorIds = [] } = useQuery({
    queryKey: ["saved-monitor-ids", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saved_monitors")
        .select("monitor_id")
        .eq("user_id", user?.id);
      if (error) throw error;
      return data?.map(s => s.monitor_id) || [];
    },
    enabled: !!user,
  });

  // Save/unsave mutation
  const toggleSaveMutation = useMutation({
    mutationFn: async (monitorId: string) => {
      const isSaved = savedMonitorIds.includes(monitorId);
      if (isSaved) {
        const { error } = await supabase
          .from("saved_monitors")
          .delete()
          .eq("monitor_id", monitorId)
          .eq("user_id", user?.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("saved_monitors")
          .insert({ monitor_id: monitorId, user_id: user?.id });
        if (error) throw error;
      }
      return { monitorId, isSaved };
    },
    onSuccess: ({ isSaved }) => {
      queryClient.invalidateQueries({ queryKey: ["saved-monitor-ids"] });
      queryClient.invalidateQueries({ queryKey: ["saved-monitors"] });
      toast({
        title: isSaved ? "Removido do Spy Especial" : "Adicionado ao Spy Especial",
      });
    },
    onError: () => {
      toast({
        title: "Erro ao salvar",
        variant: "destructive",
      });
    },
  });

  const fetchGroup = async () => {
    if (!user || !id) return;

    try {
      const { data, error } = await supabase
        .from('groups')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        navigate('/grupos');
        return;
      }

      setGroup(data as Group);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar grupo",
        description: error.message,
        variant: "destructive",
      });
      navigate('/grupos');
    }
  };

  const fetchMonitors = async () => {
    if (!user || !id) return;

    try {
      const { data: monitorsData, error } = await supabase
        .from('monitors')
        .select(`
          *,
          monitor_tags (
            tag_id,
            tags (id, name, type)
          )
        `)
        .eq('user_id', user.id)
        .eq('group_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;

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

  const fetchAllGroups = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('groups')
      .select('id, name, color')
      .eq('user_id', user.id)
      .order('name');

    if (data) setAllGroups(data as Group[]);
  };

  const fetchTags = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('tags')
      .select('*')
      .eq('user_id', user.id)
      .order('name');

    if (data) setTags(data as Tag[]);
  };

  useEffect(() => {
    fetchGroup();
    fetchMonitors();
    fetchAllGroups();
    fetchTags();
  }, [user, id]);

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

  const toggleMonitorStatus = async (monitorId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('monitors')
        .update({ is_active: !currentStatus })
        .eq('id', monitorId);

      if (error) throw error;

      setMonitors(prev =>
        prev.map(m => m.id === monitorId ? { ...m, is_active: !currentStatus } : m)
      );

      toast({ title: currentStatus ? "Monitor pausado" : "Monitor ativado" });
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
      toast({ title: "Monitor excluído" });
    } catch (error: any) {
      toast({
        title: "Erro ao excluir monitor",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const removeTagFromMonitor = async (monitorId: string, tagId: string) => {
    try {
      const { error } = await supabase
        .from('monitor_tags')
        .delete()
        .eq('monitor_id', monitorId)
        .eq('tag_id', tagId);

      if (error) throw error;

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

  const openTagsDialog = (monitor: Monitor) => {
    setSelectedMonitorForTags(monitor);
    setTagsDialogOpen(true);
  };

  const openEditDialog = (monitor: Monitor) => {
    setSelectedMonitorForEdit(monitor);
    setEditDialogOpen(true);
  };

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
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/grupos')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              {group && (
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${group.color}20` }}
                >
                  <Folder className="h-5 w-5" style={{ color: group.color }} />
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold text-foreground">{group?.name}</h1>
                {group?.description && (
                  <p className="text-muted-foreground text-sm">{group.description}</p>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setLinkMonitorsDialogOpen(true)}
            >
              <Link2 className="h-4 w-4 mr-2" />
              Vincular Existentes
            </Button>
            <Button onClick={() => setNewMonitorDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Monitor
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="metric-card">
            <p className="text-sm text-muted-foreground">Monitores</p>
            <p className="text-2xl font-bold text-foreground">{monitors.length}</p>
          </div>
          <div className="metric-card">
            <p className="text-sm text-muted-foreground">Ativos</p>
            <p className="text-2xl font-bold text-success">
              {monitors.filter(m => m.is_active).length}
            </p>
          </div>
          <div className="metric-card">
            <p className="text-sm text-muted-foreground">Total Anúncios</p>
            <p className="text-2xl font-bold text-foreground">
              {monitors
                .reduce((sum, m) => sum + (m.latest_reading?.ads_active_count || 0), 0)
                .toLocaleString('pt-BR')}
            </p>
          </div>
          <div className="metric-card">
            <p className="text-sm text-muted-foreground">Pausados</p>
            <p className="text-2xl font-bold text-muted-foreground">
              {monitors.filter(m => !m.is_active).length}
            </p>
          </div>
        </div>

        {/* Monitors List */}
        {monitors.length === 0 ? (
          <div className="metric-card text-center py-12">
            <Radio className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground">
              Nenhum monitor neste grupo
            </h3>
            <p className="text-muted-foreground mt-1">
              Crie um novo monitor ou vincule monitores existentes a este grupo.
            </p>
            <div className="flex items-center justify-center gap-3 mt-4">
              <Button
                variant="outline"
                onClick={() => setLinkMonitorsDialogOpen(true)}
              >
                <Link2 className="h-4 w-4 mr-2" />
                Vincular Existentes
              </Button>
              <Button onClick={() => setNewMonitorDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Monitor
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {monitors.map((monitor) => (
              <div
                key={monitor.id}
                className="metric-card p-4 hover:border-primary/30 transition-colors flex flex-col"
              >
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
                        savedMonitorIds.includes(monitor.id) && "text-yellow-500"
                      )}
                      onClick={() => toggleSaveMutation.mutate(monitor.id)}
                      title={savedMonitorIds.includes(monitor.id) ? "Remover do Spy Especial" : "Salvar no Spy Especial"}
                    >
                      <Star className={cn("h-3.5 w-3.5", savedMonitorIds.includes(monitor.id) && "fill-yellow-500")} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => window.open(monitor.ad_library_url, '_blank')}
                      title="Abrir Ad Library"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => scrapeMonitor(monitor.id, monitor.ad_library_url, monitor.name)}
                      disabled={scrapingMonitors.has(monitor.id)}
                      title="Coletar agora"
                    >
                      {scrapingMonitors.has(monitor.id) ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreVertical className="h-3.5 w-3.5" />
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

                {/* Name */}
                <div className="mb-2">
                  <h3 className="text-sm font-semibold text-foreground truncate" title={monitor.name}>
                    {monitor.name}
                  </h3>
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
                  <button
                    onClick={() => openTagsDialog(monitor)}
                    className="text-xs text-muted-foreground hover:text-primary transition-colors ml-auto"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>

                {/* Last update */}
                {monitor.latest_reading && (
                  <p className="text-[10px] text-muted-foreground mt-2 text-center">
                    {formatTimestamp(monitor.latest_reading.timestamp)}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

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
            groups={allGroups}
            allTags={tags}
            onSuccess={() => {
              fetchMonitors();
              fetchAllGroups();
              fetchTags();
            }}
          />
        )}

        {group && (
          <>
            <NewMonitorDialog
              open={newMonitorDialogOpen}
              onOpenChange={setNewMonitorDialogOpen}
              onSuccess={() => {
                fetchMonitors();
                fetchTags();
              }}
              existingTags={tags}
              existingGroups={allGroups}
              defaultGroupId={group.id}
            />

            <LinkMonitorsDialog
              open={linkMonitorsDialogOpen}
              onOpenChange={setLinkMonitorsDialogOpen}
              groupId={group.id}
              groupName={group.name}
              onSuccess={fetchMonitors}
            />
          </>
        )}
      </div>
    </AppLayout>
  );
}

export default function GrupoDetalhe() {
  return (
    <ProtectedRoute>
      <GrupoDetalheContent />
    </ProtectedRoute>
  );
}
