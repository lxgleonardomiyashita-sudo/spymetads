import { useState, useCallback, useMemo, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, GripVertical, ExternalLink, Globe, Tags as TagsIcon, Settings2, Layers } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useMonitorData } from "@/hooks/useMonitorData";
import { useKanbanColumns } from "@/hooks/useKanbanColumns";
import { TagChip } from "@/components/ui/tag-chip";
import { KanbanCardDialog } from "@/components/kanban/KanbanCardDialog";
import { ColumnManagerDialog } from "@/components/kanban/ColumnManagerDialog";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import type { Monitor } from "@/types/monitor";

interface SuperGroupCard {
  id: string;
  name: string;
  color: string;
  description: string | null;
  test_status: string | null;
  monitors: Array<{ id: string; name: string; latest_ads: number }>;
  totalAds: number;
  type: 'super_group';
}

type KanbanItem = (Monitor & { type: 'monitor' }) | SuperGroupCard;

function KanbanCard({ 
  item, 
  onDragStart,
  onClick,
}: { 
  item: KanbanItem; 
  onDragStart: (e: React.DragEvent, itemId: string, itemType: string) => void;
  onClick: () => void;
}) {
  if (item.type === 'super_group') {
    const sg = item as SuperGroupCard;
    return (
      <div
        draggable
        onDragStart={(e) => onDragStart(e, sg.id, 'super_group')}
        onClick={onClick}
        className="bg-card border-2 rounded-lg p-3 cursor-pointer hover:border-primary/50 transition-colors group"
        style={{ borderColor: sg.color + '40' }}
      >
        <div className="flex items-start gap-2">
          <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Layers className="h-3.5 w-3.5" style={{ color: sg.color }} />
              <h4 className="text-sm font-medium text-foreground truncate">{sg.name}</h4>
            </div>
            {sg.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{sg.description}</p>
            )}
            <div className="flex items-center justify-between mt-2">
              <span className="text-lg font-bold text-foreground">
                {sg.totalAds.toLocaleString('pt-BR')}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {sg.monitors.length} monitores
              </span>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {sg.monitors.slice(0, 3).map((m) => (
                <Badge key={m.id} variant="secondary" className="text-[10px] py-0">
                  {m.name}
                </Badge>
              ))}
              {sg.monitors.length > 3 && (
                <Badge variant="outline" className="text-[10px] py-0">
                  +{sg.monitors.length - 3}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const monitor = item as Monitor & { type: 'monitor' };
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, monitor.id, 'monitor')}
      onClick={onClick}
      className="bg-card border border-border rounded-lg p-3 cursor-pointer hover:border-primary/50 transition-colors group"
    >
      <div className="flex items-start gap-2">
        <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-foreground truncate">{monitor.name}</h4>
          <div className="flex items-center justify-between mt-2">
            <span className="text-lg font-bold text-foreground">
              {monitor.latest_reading?.ads_active_count.toLocaleString('pt-BR') || '0'}
            </span>
            <span className="text-[10px] text-muted-foreground">anúncios</span>
          </div>
          {monitor.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {monitor.tags.map((tag) => (
                <TagChip key={tag.id} name={tag.name} type={tag.type} color={tag.color} size="sm" />
              ))}
            </div>
          )}
          <div className="flex items-center gap-1 mt-2">
            {monitor.website_url && (
              <Button variant="ghost" size="icon" className="h-6 w-6"
                onClick={(e) => { e.stopPropagation(); window.open(monitor.website_url!, '_blank'); }}
                title="Abrir Site">
                <Globe className="h-3 w-3" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-6 w-6"
              onClick={(e) => { e.stopPropagation(); window.open(monitor.ad_library_url, '_blank'); }}
              title="Abrir Ad Library">
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
  items,
  onDragStart,
  onDragOver,
  onDrop,
  onCardClick,
}: {
  column: { id: string; name: string; color: string };
  items: KanbanItem[];
  onDragStart: (e: React.DragEvent, itemId: string, itemType: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, columnId: string) => void;
  onCardClick: (item: KanbanItem) => void;
}) {
  return (
    <div
      className="flex flex-col min-w-[280px] max-w-[280px] bg-muted/30 rounded-lg"
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, column.id)}
    >
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: column.color }} />
            <h3 className="text-sm font-semibold text-foreground">{column.name}</h3>
          </div>
          <Badge variant="secondary" className="text-xs">{items.length}</Badge>
        </div>
      </div>
      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-280px)] custom-scrollbar">
        {items.map((item) => (
          <KanbanCard
            key={item.id}
            item={item}
            onDragStart={onDragStart}
            onClick={() => onCardClick(item)}
          />
        ))}
        {items.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-xs">
            Arraste cards aqui
          </div>
        )}
      </div>
    </div>
  );
}

function ParaTestarContent() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [draggedItemType, setDraggedItemType] = useState<string | null>(null);
  const [selectedMonitor, setSelectedMonitor] = useState<Monitor | null>(null);
  const [cardDialogOpen, setCardDialogOpen] = useState(false);
  const [columnManagerOpen, setColumnManagerOpen] = useState(false);
  const [superGroups, setSuperGroups] = useState<SuperGroupCard[]>([]);
  
  const { monitors, isLoading: monitorsLoading, fetchMonitors } = useMonitorData();
  const { columns, isLoading: columnsLoading, refetch: refetchColumns } = useKanbanColumns();
  const { toast } = useToast();

  const isLoading = monitorsLoading || columnsLoading;

  // Fetch super groups with test_status
  const fetchSuperGroups = useCallback(async () => {
    if (!user) return;
    try {
      const { data: sgData } = await supabase
        .from('super_groups')
        .select('*')
        .eq('user_id', user.id)
        .not('test_status', 'is', null);
      
      if (!sgData || sgData.length === 0) { setSuperGroups([]); return; }

      const sgIds = sgData.map(sg => sg.id);
      const { data: sgmData } = await supabase
        .from('super_group_monitors')
        .select('super_group_id, monitor_id')
        .in('super_group_id', sgIds);

      const monitorIds = [...new Set((sgmData || []).map(m => m.monitor_id))];
      let readingsMap: Record<string, number> = {};
      if (monitorIds.length > 0) {
        const { data: readings } = await supabase
          .from('readings')
          .select('monitor_id, ads_active_count')
          .in('monitor_id', monitorIds)
          .eq('status', 'ok')
          .order('timestamp', { ascending: false });
        (readings || []).forEach(r => {
          if (!readingsMap[r.monitor_id]) readingsMap[r.monitor_id] = r.ads_active_count;
        });
      }

      const monitorNameMap: Record<string, string> = {};
      monitors.forEach(m => { monitorNameMap[m.id] = m.name; });

      const cards: SuperGroupCard[] = sgData.map(sg => {
        const sgMonitors = (sgmData || [])
          .filter(sgm => sgm.super_group_id === sg.id)
          .map(sgm => ({
            id: sgm.monitor_id,
            name: monitorNameMap[sgm.monitor_id] || 'Monitor',
            latest_ads: readingsMap[sgm.monitor_id] || 0,
          }));
        return {
          id: sg.id,
          name: sg.name,
          color: sg.color || '#8b5cf6',
          description: sg.description,
          test_status: sg.test_status,
          monitors: sgMonitors,
          totalAds: sgMonitors.reduce((sum, m) => sum + m.latest_ads, 0),
          type: 'super_group' as const,
        };
      });
      setSuperGroups(cards);
    } catch (error) {
      console.error('Error fetching super groups:', error);
    }
  }, [user, monitors]);

  useEffect(() => {
    if (!monitorsLoading) fetchSuperGroups();
  }, [monitorsLoading, fetchSuperGroups]);

  const columnIds = useMemo(() => columns.map(c => c.id), [columns]);

  // Monitors in test
  const testingMonitors = useMemo(() => {
    return monitors.filter((m) => m.test_status && columnIds.includes(m.test_status));
  }, [monitors, columnIds]);

  // All items by column
  const itemsByColumn = useMemo(() => {
    const result: Record<string, KanbanItem[]> = {};
    columns.forEach(col => { result[col.id] = []; });
    
    // Add monitors
    testingMonitors
      .filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()) || m.tags.some(t => t.name.toLowerCase().includes(searchTerm.toLowerCase())))
      .forEach(m => {
        if (m.test_status && result[m.test_status]) {
          result[m.test_status].push({ ...m, type: 'monitor' as const });
        }
      });

    // Add super groups
    superGroups
      .filter(sg => sg.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .forEach(sg => {
        if (sg.test_status && result[sg.test_status]) {
          result[sg.test_status].push(sg);
        }
      });

    return result;
  }, [testingMonitors, superGroups, columns, searchTerm]);

  const totalItems = useMemo(() => 
    testingMonitors.length + superGroups.length, 
    [testingMonitors, superGroups]
  );

  const handleDragStart = useCallback((e: React.DragEvent, itemId: string, itemType: string) => {
    setDraggedItemId(itemId);
    setDraggedItemType(itemType);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    if (!draggedItemId || !draggedItemType) return;

    try {
      if (draggedItemType === 'monitor') {
        const monitor = monitors.find(m => m.id === draggedItemId);
        if (!monitor || monitor.test_status === columnId) { setDraggedItemId(null); return; }
        
        const { error } = await supabase
          .from('monitors')
          .update({ test_status: columnId })
          .eq('id', draggedItemId);
        if (error) throw error;
        fetchMonitors();
      } else if (draggedItemType === 'super_group') {
        const sg = superGroups.find(s => s.id === draggedItemId);
        if (!sg || sg.test_status === columnId) { setDraggedItemId(null); return; }

        const { error } = await supabase
          .from('super_groups')
          .update({ test_status: columnId })
          .eq('id', draggedItemId);
        if (error) throw error;
        fetchSuperGroups();
      }

      const targetColumn = columns.find(c => c.id === columnId);
      toast({
        title: "Status atualizado",
        description: `Movido para ${targetColumn?.name || 'coluna'}`,
      });
    } catch (error) {
      console.error('Error updating status:', error);
      toast({ title: "Erro ao atualizar status", description: "Tente novamente", variant: "destructive" });
    }
    setDraggedItemId(null);
    setDraggedItemType(null);
  }, [draggedItemId, draggedItemType, monitors, superGroups, columns, fetchMonitors, fetchSuperGroups, toast]);

  const handleCardClick = useCallback((item: KanbanItem) => {
    if (item.type === 'monitor') {
      setSelectedMonitor(item as Monitor);
      setCardDialogOpen(true);
    }
    // Super group click could open detail in future
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Para Testar</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie o status de testes dos seus monitores e super grupos
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setColumnManagerOpen(true)}>
              <Settings2 className="h-4 w-4 mr-2" />
              Gerenciar Colunas
            </Button>
            <Badge variant="outline" className="text-xs">
              <TagsIcon className="h-3 w-3 mr-1" />
              {totalItems} em teste
            </Badge>
          </div>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou tag..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-card border-border"
          />
        </div>

        {totalItems === 0 && (
          <div className="text-center py-12 bg-muted/30 rounded-lg">
            <TagsIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground">Nenhum item para testar</h3>
            <p className="text-muted-foreground mt-1 max-w-md mx-auto">
              Altere o status de um monitor ou super grupo para adicioná-lo ao Kanban.
            </p>
          </div>
        )}

        {columns.length > 0 && (
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4 min-w-max">
              {columns.sort((a, b) => a.position - b.position).map((column) => (
                <KanbanColumnComponent
                  key={column.id}
                  column={column}
                  items={itemsByColumn[column.id] || []}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onCardClick={handleCardClick}
                />
              ))}
            </div>
          </div>
        )}

        <KanbanCardDialog
          open={cardDialogOpen}
          onOpenChange={setCardDialogOpen}
          monitor={selectedMonitor}
          onUpdate={() => { fetchMonitors(); setCardDialogOpen(false); }}
        />
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
