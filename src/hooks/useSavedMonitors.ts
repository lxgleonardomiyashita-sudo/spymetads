import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export function useSavedMonitors() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: savedMonitorIds = [], isLoading } = useQuery({
    queryKey: ["saved-monitor-ids", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("saved_monitors")
        .select("monitor_id")
        .eq("user_id", user.id);
      if (error) throw error;
      return data?.map(s => s.monitor_id) || [];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const toggleSaveMutation = useMutation({
    mutationFn: async (monitorId: string) => {
      if (!user?.id) throw new Error("User not authenticated");
      
      const isSaved = savedMonitorIds.includes(monitorId);
      
      if (isSaved) {
        const { error } = await supabase
          .from("saved_monitors")
          .delete()
          .eq("monitor_id", monitorId)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("saved_monitors")
          .insert({ monitor_id: monitorId, user_id: user.id });
        if (error) throw error;
      }
      
      return { monitorId, wasSaved: isSaved };
    },
    onSuccess: ({ wasSaved }) => {
      queryClient.invalidateQueries({ queryKey: ["saved-monitor-ids"] });
      queryClient.invalidateQueries({ queryKey: ["saved-monitors"] });
      toast({
        title: wasSaved ? "Removido do Spy Especial" : "Adicionado ao Spy Especial",
      });
    },
    onError: () => {
      toast({
        title: "Erro ao salvar",
        variant: "destructive",
      });
    },
  });

  const isSaved = (monitorId: string) => savedMonitorIds.includes(monitorId);

  return {
    savedMonitorIds,
    isLoading,
    toggleSave: toggleSaveMutation.mutate,
    isToggling: toggleSaveMutation.isPending,
    isSaved,
  };
}
