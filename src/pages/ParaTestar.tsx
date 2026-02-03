import { useState, useCallback, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, GripVertical, ExternalLink, Globe, Tags as TagsIcon } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useMonitorData } from "@/hooks/useMonitorData";
import { TagChip } from "@/components/ui/tag-chip";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Monitor } from "@/types/monitor";

type TestStatus = 'backup_para_teste' | 'fazendo_ads' | 'configuracao' | 'pronto' | 'em_teste' | 'validado' | 'nova_leva' | 'descartado';

interface KanbanColumn {
  id: TestStatus;
  title: string;
  color: string;
}

const KANBAN_COLUMNS: KanbanColumn[] = [
  { id: 'backup_para_teste', title: 'Backup Para Teste', color: 'hsl(var(--muted))' },
  { id: 'fazendo_ads', title: 'Fazendo Ads', color: 'hsl(217, 91%, 60%)' },
  { id: 'configuracao', title: 'Configuração', color: 'hsl(45, 93%, 47%)' },
  { id: 'pronto', title: 'Pronto', color: 'hsl(280, 87%, 65%)' },
  { id: 'em_teste', title: 'Em Teste', color: 'hsl(25, 95%, 53%)' },
  { id: 'validado', title: 'Validado', color: 'hsl(142, 71%, 45%)' },
  { id: 'nova_leva', title: 'Nova Leva', color: 'hsl(199, 89%, 48%)' },
  { id: 'descartado', title: 'Descartado', color: 'hsl(0, 84%, 60%)' },
];

function KanbanCard({ 
  monitor, 
  onDragStart 
}: { 
  monitor: Monitor; 
  onDragStart: (e: React.DragEvent, monitorId: string) => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, monitor.id)}
      className="bg-card border border-border rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-primary/50 transition-colors group"
    >
      <div className="flex items-start gap-2">
        <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-foreground truncate">{monitor.name}</h4>
          
          {/* Website URL */}
          {monitor.website_url && (
            <a
              href={monitor.website_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-primary hover:underline mt-1"
              onClick={(e) => e.stopPropagation()}
            >
              <Globe className="h-3 w-3" />
              <span className="truncate">{monitor.website_url.replace('https://', '').replace('www.', '').substring(0, 25)}...</span>
            </a>
          )}
          
          {/* Ad count */}
          <div className="flex items-center justify-between mt-2">
            <span className="text-lg font-bold text-foreground">
              {monitor.latest_reading?.ads_active_count.toLocaleString('pt-BR') || '0'}
            </span>
            <span className="text-[10px] text-muted-foreground">anúncios</span>
          </div>
          
          {/* Tags */}
          {monitor.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {monitor.tags.slice(0, 2).map((tag) => (
                <TagChip key={tag.id} name={tag.name} type={tag.type} size="sm" />
              ))}
              {monitor.tags.length > 2 && (
                <span className="text-[10px] text-muted-foreground">+{monitor.tags.length - 2}</span>
              )}
            </div>
          )}
          
          {/* Actions */}
          <div className="flex items-center gap-1 mt-2">
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
}: {
  column: KanbanColumn;
  monitors: Monitor[];
  onDragStart: (e: React.DragEvent, monitorId: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, columnId: TestStatus) => void;
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
            <h3 className="text-sm font-semibold text-foreground">{column.title}</h3>
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
  const { monitors, isLoading, fetchMonitors } = useMonitorData();
  const { toast } = useToast();

  // Filter only monitors with test_status set
  const testingMonitors = useMemo(() => 
    monitors.filter((m) => m.test_status !== null && m.test_status !== undefined),
    [monitors]
  );

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
    const result: Record<TestStatus, Monitor[]> = {
      backup_para_teste: [],
      fazendo_ads: [],
      configuracao: [],
      pronto: [],
      em_teste: [],
      validado: [],
      nova_leva: [],
      descartado: [],
    };
    
    filteredMonitors.forEach((monitor) => {
      if (monitor.test_status && result[monitor.test_status as TestStatus]) {
        result[monitor.test_status as TestStatus].push(monitor);
      }
    });
    
    return result;
  }, [filteredMonitors]);

  const handleDragStart = useCallback((e: React.DragEvent, monitorId: string) => {
    setDraggedMonitorId(monitorId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, columnId: TestStatus) => {
    e.preventDefault();
    
    if (!draggedMonitorId) return;
    
    const monitor = monitors.find((m) => m.id === draggedMonitorId);
    if (!monitor || monitor.test_status === columnId) {
      setDraggedMonitorId(null);
      return;
    }
    
    try {
      const { error } = await supabase
        .from('monitors')
        .update({ test_status: columnId })
        .eq('id', draggedMonitorId);
      
      if (error) throw error;
      
      toast({
        title: "Status atualizado",
        description: `${monitor.name} movido para ${KANBAN_COLUMNS.find(c => c.id === columnId)?.title}`,
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
  }, [draggedMonitorId, monitors, fetchMonitors, toast]);

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
              Para adicionar um monitor aqui, vá até a página de Monitores e altere o status de um card para "Para Testar".
            </p>
          </div>
        )}

        {/* Kanban Board */}
        {testingMonitors.length > 0 && (
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4 min-w-max">
              {KANBAN_COLUMNS.map((column) => (
                <KanbanColumnComponent
                  key={column.id}
                  column={column}
                  monitors={monitorsByColumn[column.id]}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                />
              ))}
            </div>
          </div>
        )}
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
