import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, GripVertical, Loader2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export interface KanbanColumn {
  id: string;
  name: string;
  color: string;
  position: number;
}

const DEFAULT_COLORS = [
  '#6b7280', // gray
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#a855f7', // purple
  '#f97316', // orange
  '#22c55e', // green
  '#06b6d4', // cyan
  '#ef4444', // red
  '#ec4899', // pink
  '#8b5cf6', // violet
];

interface ColumnManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: KanbanColumn[];
  onColumnsChange: () => void;
}

export function ColumnManagerDialog({
  open,
  onOpenChange,
  columns,
  onColumnsChange,
}: ColumnManagerDialogProps) {
  const [localColumns, setLocalColumns] = useState<KanbanColumn[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    setLocalColumns([...columns].sort((a, b) => a.position - b.position));
  }, [columns, open]);

  const handleAddColumn = () => {
    const newColumn: KanbanColumn = {
      id: `temp-${Date.now()}`,
      name: "Nova Coluna",
      color: DEFAULT_COLORS[localColumns.length % DEFAULT_COLORS.length],
      position: localColumns.length,
    };
    setLocalColumns([...localColumns, newColumn]);
  };

  const handleRemoveColumn = (index: number) => {
    const updated = localColumns.filter((_, i) => i !== index);
    // Recalculate positions
    updated.forEach((col, i) => col.position = i);
    setLocalColumns(updated);
  };

  const handleUpdateColumn = (index: number, field: 'name' | 'color', value: string) => {
    const updated = [...localColumns];
    updated[index] = { ...updated[index], [field]: value };
    setLocalColumns(updated);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    const updated = [...localColumns];
    const [dragged] = updated.splice(draggedIndex, 1);
    updated.splice(index, 0, dragged);
    
    // Recalculate positions
    updated.forEach((col, i) => col.position = i);
    
    setLocalColumns(updated);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleSave = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // Delete all existing columns
      await supabase
        .from('kanban_columns')
        .delete()
        .eq('user_id', user.id);
      
      // Insert new columns
      if (localColumns.length > 0) {
        const { error } = await supabase
          .from('kanban_columns')
          .insert(
            localColumns.map((col, index) => ({
              user_id: user.id,
              name: col.name,
              color: col.color,
              position: index,
            }))
          );
        
        if (error) throw error;
      }
      
      toast({
        title: "Colunas salvas",
        description: "A configuração do Kanban foi atualizada",
      });
      
      onColumnsChange();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    }
    setIsLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-card border-border max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-foreground">Gerenciar Colunas</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto py-4 space-y-2">
          {localColumns.map((column, index) => (
            <div
              key={column.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={cn(
                "flex items-center gap-2 p-2 bg-muted/30 rounded-lg border border-border",
                draggedIndex === index && "opacity-50"
              )}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab flex-shrink-0" />
              
              <input
                type="color"
                value={column.color}
                onChange={(e) => handleUpdateColumn(index, 'color', e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                title="Escolher cor"
              />
              
              <Input
                value={column.name}
                onChange={(e) => handleUpdateColumn(index, 'name', e.target.value)}
                className="flex-1 bg-background h-8"
                placeholder="Nome da coluna"
              />
              
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => handleRemoveColumn(index)}
                title="Remover coluna"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          
          {localColumns.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-4">
              Nenhuma coluna configurada. Adicione sua primeira coluna.
            </p>
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-border">
          <Button variant="outline" onClick={handleAddColumn}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Coluna
          </Button>
          
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
