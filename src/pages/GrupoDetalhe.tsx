import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { MonitorCard } from "@/components/monitors/MonitorCard";
import {
  ArrowLeft,
  Radio,
  Loader2,
  Plus,
  Folder,
  Link2,
} from "lucide-react";
import { ManageTagsDialog } from "@/components/monitors/ManageTagsDialog";
import { EditMonitorDialog } from "@/components/monitors/EditMonitorDialog";
import { NewMonitorDialog } from "@/components/monitors/NewMonitorDialog";
import { LinkMonitorsDialog } from "@/components/monitors/LinkMonitorsDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useMonitorData } from "@/hooks/useMonitorData";
import { useSavedMonitors } from "@/hooks/useSavedMonitors";
import type { Monitor, Group } from "@/types/monitor";

function GrupoDetalheContent() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [group, setGroup] = useState<Group | null>(null);
  const [allGroups, setAllGroups] = useState<Group[]>([]);
  const [tagsDialogOpen, setTagsDialogOpen] = useState(false);
  const [selectedMonitorForTags, setSelectedMonitorForTags] = useState<Monitor | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedMonitorForEdit, setSelectedMonitorForEdit] = useState<Monitor | null>(null);
  const [newMonitorDialogOpen, setNewMonitorDialogOpen] = useState(false);
  const [linkMonitorsDialogOpen, setLinkMonitorsDialogOpen] = useState(false);
  const [isGroupLoading, setIsGroupLoading] = useState(true);

  const {
    monitors,
    tags,
    isLoading,
    scrapingMonitors,
    fetchMonitors,
    fetchTags,
    toggleMonitorStatus,
    deleteMonitor,
    scrapeMonitor,
  } = useMonitorData({ groupId: id });

  const { isSaved, toggleSave } = useSavedMonitors();

  const fetchGroup = useCallback(async () => {
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
    } finally {
      setIsGroupLoading(false);
    }
  }, [user, id, navigate, toast]);

  const fetchAllGroups = useCallback(async () => {
    if (!user) return;

    const { data } = await supabase
      .from('groups')
      .select('id, name, color, description')
      .eq('user_id', user.id)
      .order('name');

    if (data) setAllGroups(data as Group[]);
  }, [user]);

  useEffect(() => {
    fetchGroup();
    fetchAllGroups();
  }, [fetchGroup, fetchAllGroups]);

  const openTagsDialog = useCallback((monitor: Monitor) => {
    setSelectedMonitorForTags(monitor);
    setTagsDialogOpen(true);
  }, []);

  const openEditDialog = useCallback((monitor: Monitor) => {
    setSelectedMonitorForEdit(monitor);
    setEditDialogOpen(true);
  }, []);

  if (isLoading || isGroupLoading) {
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
              <MonitorCard
                key={monitor.id}
                monitor={monitor}
                groups={allGroups}
                isSaved={isSaved(monitor.id)}
                isScraping={scrapingMonitors.has(monitor.id)}
                onToggleSave={() => toggleSave(monitor.id)}
                onEdit={() => openEditDialog(monitor)}
                onDelete={() => deleteMonitor(monitor.id)}
                onToggleStatus={() => toggleMonitorStatus(monitor.id, monitor.is_active)}
                onScrape={() => scrapeMonitor(monitor.id, monitor.ad_library_url, monitor.name)}
                onManageTags={() => openTagsDialog(monitor)}
                showGroupBadge={false}
              />
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
