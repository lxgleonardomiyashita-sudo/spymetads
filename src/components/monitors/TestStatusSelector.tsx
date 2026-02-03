import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface KanbanColumn {
  id: string;
  name: string;
  color: string;
  position: number;
}

interface TestStatusSelectorProps {
  monitorId: string;
  currentStatus: string | null;
  onStatusChange?: () => void;
  compact?: boolean;
}

export function TestStatusSelector({
  monitorId,
  currentStatus,
  onStatusChange,
  compact = false,
}: TestStatusSelectorProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchColumns = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('kanban_columns')
          .select('*')
          .eq('user_id', user.id)
          .order('position');
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          setColumns(data);
        }
      } catch (error) {
        console.error('Error fetching columns:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchColumns();
  }, [user]);

  const handleStatusChange = async (value: string) => {
    const newStatus = value === 'null' ? null : value;
    
    try {
      const { error } = await supabase
        .from('monitors')
        .update({ test_status: newStatus })
        .eq('id', monitorId);
      
      if (error) throw error;
      
      const statusLabel = columns.find(c => c.id === newStatus)?.name || 'Sem status';
      
      toast({
        title: "Status atualizado",
        description: `Status alterado para: ${statusLabel}`,
      });
      
      onStatusChange?.();
    } catch (error: any) {
      console.error('Error updating test status:', error);
      toast({
        title: "Erro ao atualizar status",
        description: "Tente novamente",
        variant: "destructive",
      });
    }
  };

  const currentColumn = columns.find(c => c.id === currentStatus);

  if (isLoading) {
    return (
      <div className={cn("border border-dashed rounded-md flex items-center justify-center", compact ? "h-7" : "h-8")}>
        <span className="text-xs text-muted-foreground">...</span>
      </div>
    );
  }

  return (
    <Select
      value={currentStatus || 'null'}
      onValueChange={handleStatusChange}
    >
      <SelectTrigger 
        className={cn(
          "border-dashed",
          compact ? "h-7 text-xs px-2" : "h-8"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1.5">
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: currentColumn?.color || 'hsl(var(--muted-foreground))' }}
          />
          <SelectValue placeholder="Status">
            {compact 
              ? (currentColumn?.name ? currentColumn.name.substring(0, 12) + (currentColumn.name.length > 12 ? '...' : '') : 'Sem status') 
              : (currentColumn?.name || 'Sem status')
            }
          </SelectValue>
        </div>
      </SelectTrigger>
      <SelectContent className="bg-popover border-border z-50">
        <SelectItem value="null">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-muted-foreground" />
            Sem status
          </div>
        </SelectItem>
        {columns
          .sort((a, b) => a.position - b.position)
          .map((column) => (
            <SelectItem key={column.id} value={column.id}>
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: column.color }}
                />
                {column.name}
              </div>
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
}
