import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Group {
  id: string;
  name: string;
  color: string;
}

interface Monitor {
  id: string;
  name: string;
  ad_library_url: string;
  group_id: string | null;
  schedule_config: {
    interval: number;
    days: string[];
    windows: string[];
  };
}

interface EditMonitorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  monitor: Monitor;
  groups: Group[];
  onSuccess: () => void;
}

export function EditMonitorDialog({
  open,
  onOpenChange,
  monitor,
  groups,
  onSuccess,
}: EditMonitorDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState(monitor.name);
  const [url, setUrl] = useState(monitor.ad_library_url);
  const [groupId, setGroupId] = useState<string>(monitor.group_id || "none");
  const [interval, setInterval] = useState(monitor.schedule_config.interval.toString());

  useEffect(() => {
    setName(monitor.name);
    setUrl(monitor.ad_library_url);
    setGroupId(monitor.group_id || "none");
    setInterval(monitor.schedule_config.interval.toString());
  }, [monitor]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from("monitors")
        .update({
          name: name.trim(),
          ad_library_url: url.trim(),
          group_id: groupId === "none" ? null : groupId,
          schedule_config: {
            ...monitor.schedule_config,
            interval: parseInt(interval),
          },
        })
        .eq("id", monitor.id);

      if (error) throw error;

      toast({ title: "Monitor atualizado!" });
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar monitor",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-foreground">Editar Monitor</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name" className="text-foreground">
              Nome do Monitor
            </Label>
            <Input
              id="edit-name"
              placeholder="Ex: Concorrente XYZ"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-muted border-border"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-url" className="text-foreground">
              URL da Biblioteca de Anúncios
            </Label>
            <Input
              id="edit-url"
              placeholder="https://www.facebook.com/ads/library/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="bg-muted border-border"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-group" className="text-foreground">
              Grupo
            </Label>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger className="bg-muted border-border">
                <SelectValue placeholder="Selecione um grupo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem grupo</SelectItem>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: group.color }}
                      />
                      {group.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-interval" className="text-foreground">
              Intervalo de Coleta (minutos)
            </Label>
            <Select value={interval} onValueChange={setInterval}>
              <SelectTrigger className="bg-muted border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 minutos</SelectItem>
                <SelectItem value="60">1 hora</SelectItem>
                <SelectItem value="120">2 horas</SelectItem>
                <SelectItem value="240">4 horas</SelectItem>
                <SelectItem value="480">8 horas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !name.trim() || !url.trim()}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Salvar"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
