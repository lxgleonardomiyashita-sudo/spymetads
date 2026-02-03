import { useState, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NewMonitorDialog } from "@/components/monitors/NewMonitorDialog";
import { ManageTagsDialog } from "@/components/monitors/ManageTagsDialog";
import { EditMonitorDialog } from "@/components/monitors/EditMonitorDialog";
import { MonitorInsightsDialog } from "@/components/monitors/MonitorInsightsDialog";
import { MonitorCard } from "@/components/monitors/MonitorCard";
import { Plus, Search, Radio, Loader2 } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useMonitorData } from "@/hooks/useMonitorData";
import { useSavedMonitors } from "@/hooks/useSavedMonitors";
import type { Monitor } from "@/types/monitor";

function MonitoresContent() {
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tagsDialogOpen, setTagsDialogOpen] = useState(false);
  const [selectedMonitorForTags, setSelectedMonitorForTags] = useState<Monitor | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedMonitorForEdit, setSelectedMonitorForEdit] = useState<Monitor | null>(null);
  const [insightsDialogOpen, setInsightsDialogOpen] = useState(false);
  const [selectedMonitorForInsights, setSelectedMonitorForInsights] = useState<Monitor | null>(null);

  const {
    monitors,
    tags,
    groups,
    isLoading,
    scrapingMonitors,
    fetchMonitors,
    fetchTags,
    fetchGroups,
    toggleMonitorStatus,
    deleteMonitor,
    scrapeMonitor,
  } = useMonitorData();

  const { isSaved, toggleSave } = useSavedMonitors();

  const openTagsDialog = useCallback((monitor: Monitor) => {
    setSelectedMonitorForTags(monitor);
    setTagsDialogOpen(true);
  }, []);

  const openEditDialog = useCallback((monitor: Monitor) => {
    setSelectedMonitorForEdit(monitor);
    setEditDialogOpen(true);
  }, []);

  const openInsightsDialog = useCallback((monitor: Monitor) => {
    setSelectedMonitorForInsights(monitor);
    setInsightsDialogOpen(true);
  }, []);

  const filteredMonitors = monitors.filter(
    (monitor) =>
      monitor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      monitor.tags.some((tag) =>
        tag.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
  );

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

        {/* Monitors Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredMonitors.map((monitor) => (
            <MonitorCard
              key={monitor.id}
              monitor={monitor}
              groups={groups}
              allTags={tags}
              isSaved={isSaved(monitor.id)}
              isScraping={scrapingMonitors.has(monitor.id)}
              onToggleSave={() => toggleSave(monitor.id)}
              onInsights={() => openInsightsDialog(monitor)}
              onEdit={() => openEditDialog(monitor)}
              onDelete={() => deleteMonitor(monitor.id)}
              onToggleStatus={() => toggleMonitorStatus(monitor.id, monitor.is_active)}
              onScrape={() => scrapeMonitor(monitor.id, monitor.ad_library_url, monitor.name)}
              onManageTags={() => openTagsDialog(monitor)}
              onTagsUpdated={() => {
                fetchMonitors();
                fetchTags();
              }}
            />
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
            allTags={tags}
            onSuccess={() => {
              fetchMonitors();
              fetchGroups();
              fetchTags();
            }}
          />
        )}

        <MonitorInsightsDialog
          open={insightsDialogOpen}
          onOpenChange={setInsightsDialogOpen}
          monitor={selectedMonitorForInsights}
        />
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
