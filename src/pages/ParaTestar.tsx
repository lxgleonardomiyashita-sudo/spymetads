import { useState, useCallback, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, GripVertical, ExternalLink, Globe, Tags as TagsIcon, Settings2 } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useMonitorData } from "@/hooks/useMonitorData";
import { useKanbanColumns } from "@/hooks/useKanbanColumns";
import { TagChip } from "@/components/ui/tag-chip";
import { KanbanCardDialog } from "@/components/kanban/KanbanCardDialog";
import { ColumnManagerDialog } from "@/components/kanban/ColumnManagerDialog";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Monitor } from "@/types/monitor";

function KanbanCard({ 
  monitor, 
  onDragStart,
  onClick,
}: { 
  monitor: Monitor; 
  onDragStart: (e: React.DragEvent, monitorId: string) => void;
  onClick: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, monitor.id)}
      onClick={onClick}
      className="bg-card border border-border rounded-lg p-3 cursor-pointer hover:border-primary/50 transition-colors group"
    >
      <div className="flex items-start gap-2">
        <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-foreground truncate">{monitor.name}</h4>
          
          {/* Ad count */}
          <div className="flex items-center justify-between mt-2">
            <span className="text-lg font-bold text-foreground">
              {monitor.latest_reading?.ads_active_count.toLocaleString('pt-BR') || '0'}
            </span>
            <span className="text-[10px] text-muted-foreground">anúncios</span>
          </div>
          
          {/* Tags - ALL visible */}
          {monitor.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {monitor.tags.map((tag) => (
                <TagChip key={tag.id} name={tag.name} type={tag.type} size="sm" />
              ))}
            </div>
          )}
          
          {/* Actions */}
          <div className="flex items-center gap-1 mt-2">
            {monitor.website_url && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(monitor.website_url!, '_blank');
                }}
                title="Abrir Site"
              >
                <Globe className="h-3 w-3" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                window.open(monitor.ad_library_url, '_blank');
              }}
              title="Abrir Ad Library"
            >
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function KanbanColumnComponent({
  column,
  monitors,
  onDragStart,
  onDragOver,
  onDrop,
  onCardClick,
}: {
  column: { id: string; name: string; color: string };
  monitors: Monitor[];
  onDragStart: (e: React.DragEvent, monitorId: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, columnId: string) => void;
  onCardClick: (monitor: Monitor) => void;
}) {
  return (
    <div
      className="flex flex-col min-w-[280px] max-w-[280px] bg-muted/30 rounded-lg"
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, column.id)}
    >
      {/* Column Header */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: column.color }}
            />
            <h3 className="text-sm font-semibold text-foreground">{column.name}</h3>
          </div>
          <Badge variant="secondary" className="text-xs">
            {monitors.length}
          </Badge>
        </div>
      </div>
      
      {/* Column Content */}
      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-280px)] custom-scrollbar">
        {monitors.map((monitor) => (
          <KanbanCard
            key={monitor.id}
            monitor={monitor}
            onDragStart={onDragStart}
            onClick={() => onCardClick(monitor)}
          />
        ))}
        {monitors.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-xs">
            Arraste cards aqui
          </div>
        )}
      </div>
    </div>
  );
}

function ParaTestarContent() {
  const [searchTerm, setSearchTerm] = useState("");
  const [draggedMonitorId, setDraggedMonitorId] = useState<string | null>(null);
  const [selectedMonitor, setSelectedMonitor] = useState<Monitor | null>(null);
  const [cardDialogOpen, setCardDialogOpen] = useState(false);
  const [columnManagerOpen, setColumnManagerOpen] = useState(false);
  
  const { monitors, isLoading: monitorsLoading, fetchMonitors } = useMonitorData();
  const { columns, isLoading: columnsLoading, refetch: refetchColumns } = useKanbanColumns();
  const { toast } = useToast();

  const isLoading = monitorsLoading || columnsLoading;

  // Filter only monitors with test_status set (matching any column ID)
  const testingMonitors = useMemo(() => {
    const columnIds = columns.map(c => c.id);
    return monitors.filter((m) => m.test_status && columnIds.includes(m.test_status));
  }, [monitors, columns]);

  const filteredMonitors = useMemo(() => 
    testingMonitors.filter(
      (monitor) =>
        monitor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        monitor.tags.some((tag) =>
          tag.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
    ),
    [testingMonitors, searchTerm]
  );

  const monitorsByColumn = useMemo(() => {
    const result: Record<string, Monitor[]> = {};
    columns.forEach(col => {
      result[col.id] = [];
    });
    
    filteredMonitors.forEach((monitor) => {
      if (monitor.test_status && result[monitor.test_status]) {
        result[monitor.test_status].push(monitor);
      }
    });
    
    return result;
  }, [filteredMonitors, columns]);

  const handleDragStart = useCallback((e: React.DragEvent, monitorId: string) => {
    setDraggedMonitorId(monitorId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    
    if (!draggedMonitorId) return;
    
    const monitor = monitors.find((m) => m.id === draggedMonitorId);
    if (!monitor || monitor.test_status === columnId) {
      setDraggedMonitorId(null);
      return;
    }
    
    const targetColumn = columns.find(c => c.id === columnId);
    
    try {
      const { error } = await supabase
        .from('monitors')
        .update({ test_status: columnId })
        .eq('id', draggedMonitorId);
      
      if (error) throw error;
      
      toast({
        title: "Status atualizado",
        description: `${monitor.name} movido para ${targetColumn?.name || 'coluna'}`,
      });
      
      fetchMonitors();
    } catch (error) {
      console.error('Error updating test status:', error);
      toast({
        title: "Erro ao atualizar status",
        description: "Tente novamente",
        variant: "destructive",
      });
    }
    
    setDraggedMonitorId(null);
  }, [draggedMonitorId, monitors, columns, fetchMonitors, toast]);

  const handleCardClick = useCallback((monitor: Monitor) => {
    setSelectedMonitor(monitor);
    setCardDialogOpen(true);
  }, []);

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
            <h1 className="text-2xl font-bold text-foreground">Para Testar</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie o status de testes dos seus monitores
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setColumnManagerOpen(true)}
            >
              <Settings2 className="h-4 w-4 mr-2" />
              Gerenciar Colunas
            </Button>
            <Badge variant="outline" className="text-xs">
              <TagsIcon className="h-3 w-3 mr-1" />
              {testingMonitors.length} monitores em teste
            </Badge>
          </div>
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

        {/* Info */}
        {testingMonitors.length === 0 && (
          <div className="text-center py-12 bg-muted/30 rounded-lg">
            <TagsIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground">
              Nenhum monitor para testar
            </h3>
            <p className="text-muted-foreground mt-1 max-w-md mx-auto">
              Para adicionar um monitor aqui, vá até a página de Monitores e altere o status de um card para uma das colunas do Kanban.
            </p>
          </div>
        )}

        {/* Kanban Board */}
        {columns.length > 0 && (
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4 min-w-max">
              {columns
                .sort((a, b) => a.position - b.position)
                .map((column) => (
                  <KanbanColumnComponent
                    key={column.id}
                    column={column}
                    monitors={monitorsByColumn[column.id] || []}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onCardClick={handleCardClick}
                  />
                ))}
            </div>
          </div>
        )}

        {/* Card Dialog */}
        <KanbanCardDialog
          open={cardDialogOpen}
          onOpenChange={setCardDialogOpen}
          monitor={selectedMonitor}
          onUpdate={() => {
            fetchMonitors();
            setCardDialogOpen(false);
          }}
        />

        {/* Column Manager Dialog */}
        <ColumnManagerDialog
          open={columnManagerOpen}
          onOpenChange={setColumnManagerOpen}
          columns={columns}
          onColumnsChange={refetchColumns}
        />
      </div>
    </AppLayout>
  );
}

export default function ParaTestar() {
  return (
    <ProtectedRoute>
      <ParaTestarContent />
    </ProtectedRoute>
  );
}
