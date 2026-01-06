import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Radio } from "lucide-react";

interface Monitor {
  id: string;
  name: string;
  ad_library_url: string;
}

interface LinkMonitorsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  groupName: string;
  onSuccess: () => void;
}

export function LinkMonitorsDialog({
  open,
  onOpenChange,
  groupId,
  groupName,
  onSuccess,
}: LinkMonitorsDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [availableMonitors, setAvailableMonitors] = useState<Monitor[]>([]);
  const [selectedMonitors, setSelectedMonitors] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open && user) {
      fetchAvailableMonitors();
      setSelectedMonitors(new Set());
    }
  }, [open, user]);

  const fetchAvailableMonitors = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      const { data, error } = await supabase
        .from('monitors')
        .select('id, name, ad_library_url')
        .eq('user_id', user.id)
        .is('group_id', null)
        .order('name');

      if (error) throw error;
      setAvailableMonitors(data || []);
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

  const toggleMonitor = (monitorId: string) => {
    setSelectedMonitors((prev) => {
      const next = new Set(prev);
      if (next.has(monitorId)) {
        next.delete(monitorId);
      } else {
        next.add(monitorId);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (selectedMonitors.size === 0) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('monitors')
        .update({ group_id: groupId })
        .in('id', Array.from(selectedMonitors));

      if (error) throw error;

      toast({
        title: "Monitores vinculados!",
        description: `${selectedMonitors.size} monitor(es) adicionado(s) ao grupo.`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Erro ao vincular monitores",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Vincular Monitores</DialogTitle>
          <DialogDescription>
            Selecione os monitores que deseja adicionar ao grupo "{groupName}".
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : availableMonitors.length === 0 ? (
            <div className="text-center py-8">
              <Radio className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">
                Todos os monitores já estão vinculados a grupos.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {availableMonitors.map((monitor) => (
                <label
                  key={monitor.id}
                  className="flex items-center gap-3 p-2 rounded-lg border border-border hover:border-primary/30 cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={selectedMonitors.has(monitor.id)}
                    onCheckedChange={() => toggleMonitor(monitor.id)}
                  />
                  <span className="font-medium text-foreground text-sm truncate">{monitor.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={selectedMonitors.size === 0 || isSaving}
          >
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Vincular {selectedMonitors.size > 0 && `(${selectedMonitors.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
