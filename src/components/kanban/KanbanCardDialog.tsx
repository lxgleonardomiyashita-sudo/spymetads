import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { TagChip } from "@/components/ui/tag-chip";
import { ExternalLink, Globe, Save, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Monitor } from "@/types/monitor";

interface KanbanCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  monitor: Monitor | null;
  onUpdate?: () => void;
}

export function KanbanCardDialog({
  open,
  onOpenChange,
  monitor,
  onUpdate,
}: KanbanCardDialogProps) {
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (monitor) {
      setWebsiteUrl(monitor.website_url || "");
      setNotes("");
    }
  }, [monitor]);

  const handleSave = async () => {
    if (!monitor) return;
    
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('monitors')
        .update({ website_url: websiteUrl.trim() || null })
        .eq('id', monitor.id);
      
      if (error) throw error;
      
      toast({
        title: "Salvo com sucesso",
        description: "As informações foram atualizadas",
      });
      
      onUpdate?.();
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

  if (!monitor) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">{monitor.name}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Stats */}
          <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
            <div>
              <p className="text-3xl font-bold text-foreground">
                {monitor.latest_reading?.ads_active_count.toLocaleString('pt-BR') || '0'}
              </p>
              <p className="text-sm text-muted-foreground">anúncios ativos</p>
            </div>
            {monitor.stats && monitor.stats.max_ads > 0 && (
              <div className="text-right">
                <p className="text-sm font-medium text-foreground">
                  Máx: {monitor.stats.max_ads.toLocaleString('pt-BR')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {monitor.stats.total_readings} leituras
                </p>
              </div>
            )}
          </div>

          {/* Tags - ALL visible */}
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Tags</Label>
            <div className="flex flex-wrap gap-1.5">
              {monitor.tags.length > 0 ? (
                monitor.tags.map((tag) => (
                  <TagChip key={tag.id} name={tag.name} type={tag.type} size="sm" />
                ))
              ) : (
                <span className="text-xs text-muted-foreground">Sem tags</span>
              )}
            </div>
          </div>

          {/* Links */}
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">
                Link da Ad Library
              </Label>
              <a
                href={monitor.ad_library_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <ExternalLink className="h-4 w-4" />
                Abrir Ad Library
              </a>
            </div>

            <div>
              <Label htmlFor="website-url" className="text-xs text-muted-foreground mb-2 block">
                Link do Site (opcional)
              </Label>
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <Input
                  id="website-url"
                  type="url"
                  placeholder="https://exemplo.com"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  className="flex-1 bg-background"
                />
              </div>
              {websiteUrl && (
                <a
                  href={websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-primary hover:underline mt-1 ml-6"
                >
                  Abrir site
                </a>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes" className="text-xs text-muted-foreground mb-2 block">
              Anotações
            </Label>
            <Textarea
              id="notes"
              placeholder="Adicione observações sobre este monitor..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-background resize-none"
              rows={3}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
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
      </DialogContent>
    </Dialog>
  );
}
