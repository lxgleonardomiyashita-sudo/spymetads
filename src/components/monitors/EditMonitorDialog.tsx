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
import { Loader2, ExternalLink, X, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { TagChip } from "@/components/ui/tag-chip";

interface Tag {
  id: string;
  name: string;
  type: string;
}

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
  tags?: Tag[];
}

interface EditMonitorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  monitor: Monitor;
  groups: Group[];
  allTags: Tag[];
  onSuccess: () => void;
}

export function EditMonitorDialog({
  open,
  onOpenChange,
  monitor,
  groups,
  allTags,
  onSuccess,
}: EditMonitorDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState(monitor.name);
  const [url, setUrl] = useState(monitor.ad_library_url);
  const [groupId, setGroupId] = useState<string>(monitor.group_id || "none");
  const [interval, setInterval] = useState(monitor.schedule_config.interval.toString());
  const [selectedTags, setSelectedTags] = useState<string[]>(monitor.tags?.map(t => t.id) || []);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    setName(monitor.name);
    setUrl(monitor.ad_library_url);
    setGroupId(monitor.group_id || "none");
    setInterval(monitor.schedule_config.interval.toString());
    setSelectedTags(monitor.tags?.map(t => t.id) || []);
  }, [monitor]);

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;

    setIsSubmitting(true);

    try {
      // Update monitor
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

      // Update tags - delete existing and insert new
      await supabase
        .from("monitor_tags")
        .delete()
        .eq("monitor_id", monitor.id);

      if (selectedTags.length > 0) {
        const tagsToInsert = selectedTags.map(tagId => ({
          monitor_id: monitor.id,
          tag_id: tagId,
        }));
        await supabase.from("monitor_tags").insert(tagsToInsert);
      }

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
            <div className="flex gap-2">
              <Input
                id="edit-url"
                placeholder="https://www.facebook.com/ads/library/..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="bg-muted border-border flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                asChild
              >
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
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
                <SelectItem value="15">15 minutos</SelectItem>
                <SelectItem value="30">30 minutos</SelectItem>
                <SelectItem value="60">1 hora</SelectItem>
                <SelectItem value="120">2 horas</SelectItem>
                <SelectItem value="240">4 horas</SelectItem>
                <SelectItem value="480">8 horas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-foreground">Tags</Label>
            <div className="flex flex-wrap gap-2 p-3 bg-muted rounded-md border border-border min-h-[60px]">
              {allTags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={`px-2.5 py-1 text-xs rounded-full transition-all ${
                    selectedTags.includes(tag.id)
                      ? "bg-primary text-primary-foreground"
                      : "bg-background border border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {tag.name}
                </button>
              ))}
              {allTags.length === 0 && (
                <span className="text-xs text-muted-foreground">
                  Nenhuma tag disponível
                </span>
              )}
            </div>
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
