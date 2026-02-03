import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface KanbanColumn {
  id: string;
  name: string;
  color: string;
  position: number;
}

const DEFAULT_COLUMNS: Omit<KanbanColumn, 'id'>[] = [
  { name: 'Backup Para Teste', color: '#6b7280', position: 0 },
  { name: 'Fazendo Ads', color: '#3b82f6', position: 1 },
  { name: 'Configuração', color: '#f59e0b', position: 2 },
  { name: 'Pronto', color: '#a855f7', position: 3 },
  { name: 'Em Teste', color: '#f97316', position: 4 },
  { name: 'Validado', color: '#22c55e', position: 5 },
  { name: 'Nova Leva', color: '#06b6d4', position: 6 },
  { name: 'Descartado', color: '#ef4444', position: 7 },
];

export function useKanbanColumns() {
  const { user } = useAuth();
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchColumns = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('kanban_columns')
        .select('*')
        .eq('user_id', user.id)
        .order('position');

      if (error) throw error;

      if (data && data.length > 0) {
        setColumns(data.map(col => ({
          id: col.id,
          name: col.name,
          color: col.color,
          position: col.position,
        })));
      } else {
        // Initialize with default columns
        const { data: inserted, error: insertError } = await supabase
          .from('kanban_columns')
          .insert(DEFAULT_COLUMNS.map(col => ({
            user_id: user.id,
            name: col.name,
            color: col.color,
            position: col.position,
          })))
          .select();

        if (insertError) throw insertError;
        
        if (inserted) {
          setColumns(inserted.map(col => ({
            id: col.id,
            name: col.name,
            color: col.color,
            position: col.position,
          })));
        }
      }
    } catch (error) {
      console.error('Error fetching kanban columns:', error);
      // Fallback to default columns structure without IDs
      setColumns(DEFAULT_COLUMNS.map((col, i) => ({
        id: `default-${i}`,
        ...col,
      })));
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchColumns();
  }, [fetchColumns]);

  return {
    columns,
    isLoading,
    refetch: fetchColumns,
  };
}
