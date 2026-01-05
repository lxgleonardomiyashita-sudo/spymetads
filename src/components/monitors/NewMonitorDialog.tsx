import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { TagChip } from "@/components/ui/tag-chip";
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
import { X, Loader2, Plus, Link as LinkIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

interface NewMonitorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  existingTags: Array<{ id: string; name: string; type: 'nicho' | 'idioma' | 'pais' | 'custom' }>;
}

const monitorSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(100, "Nome muito longo"),
  ad_library_url: z.string()
    .url("URL inválida")
    .refine(
      (url) => url.includes("facebook.com/ads/library"),
      "URL deve ser da Biblioteca de Anúncios do Meta (facebook.com/ads/library)"
    ),
});

const DAYS = [
  { value: 'mon', label: 'Seg' },
  { value: 'tue', label: 'Ter' },
  { value: 'wed', label: 'Qua' },
  { value: 'thu', label: 'Qui' },
  { value: 'fri', label: 'Sex' },
  { value: 'sat', label: 'Sáb' },
  { value: 'sun', label: 'Dom' },
];

const WINDOWS = [
  { value: 'morning', label: 'Manhã (05:00-11:59)' },
  { value: 'afternoon', label: 'Tarde (12:00-17:59)' },
  { value: 'evening', label: 'Noite (18:00-23:59)' },
];

const INTERVALS = [
  { value: 15, label: 'A cada 15 minutos' },
  { value: 30, label: 'A cada 30 minutos' },
  { value: 60, label: 'A cada 60 minutos' },
];

export function NewMonitorDialog({ open, onOpenChange, onSuccess, existingTags }: NewMonitorDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [interval, setInterval] = useState<number>(60);
  const [selectedDays, setSelectedDays] = useState<string[]>(DAYS.map(d => d.value));
  const [selectedWindows, setSelectedWindows] = useState<string[]>(WINDOWS.map(w => w.value));
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [newTagType, setNewTagType] = useState<'nicho' | 'idioma' | 'pais' | 'custom'>('nicho');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; url?: string }>({});

  const toggleDay = (day: string) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const toggleWindow = (window: string) => {
    setSelectedWindows(prev =>
      prev.includes(window) ? prev.filter(w => w !== window) : [...prev, window]
    );
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev =>
      prev.includes(tagId) ? prev.filter(t => t !== tagId) : [...prev, tagId]
    );
  };

  const handleAddNewTag = async () => {
    if (!newTagName.trim() || !user) return;

    try {
      const { data, error } = await supabase
        .from('tags')
        .insert({
          user_id: user.id,
          name: newTagName.trim(),
          type: newTagType,
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setSelectedTags(prev => [...prev, data.id]);
        setNewTagName("");
        toast({
          title: "Tag criada!",
          description: `Tag "${data.name}" foi adicionada`,
        });
      }
    } catch (error: any) {
      if (error.message?.includes("duplicate")) {
        toast({
          title: "Tag já existe",
          description: "Você já tem uma tag com esse nome",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro ao criar tag",
          description: error.message,
          variant: "destructive",
        });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate
    const result = monitorSchema.safeParse({ name, ad_library_url: url });
    if (!result.success) {
      const fieldErrors: { name?: string; url?: string } = {};
      result.error.errors.forEach((err) => {
        if (err.path[0] === 'name') fieldErrors.name = err.message;
        if (err.path[0] === 'ad_library_url') fieldErrors.url = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    if (selectedDays.length === 0) {
      toast({
        title: "Selecione ao menos um dia",
        description: "O monitor precisa de pelo menos um dia ativo",
        variant: "destructive",
      });
      return;
    }

    if (selectedWindows.length === 0) {
      toast({
        title: "Selecione ao menos uma janela",
        description: "O monitor precisa de pelo menos uma janela de horário",
        variant: "destructive",
      });
      return;
    }

    if (!user) return;

    setIsLoading(true);

    try {
      // Create monitor
      const { data: monitor, error: monitorError } = await supabase
        .from('monitors')
        .insert({
          user_id: user.id,
          name: name.trim(),
          ad_library_url: url.trim(),
          schedule_config: {
            interval,
            days: selectedDays,
            windows: selectedWindows,
          },
          timezone: 'America/Sao_Paulo',
          is_active: true,
        })
        .select()
        .single();

      if (monitorError) throw monitorError;

      // Link tags
      if (monitor && selectedTags.length > 0) {
        const tagLinks = selectedTags.map(tagId => ({
          monitor_id: monitor.id,
          tag_id: tagId,
        }));

        const { error: tagsError } = await supabase
          .from('monitor_tags')
          .insert(tagLinks);

        if (tagsError) throw tagsError;
      }

      toast({
        title: "Monitor criado!",
        description: `"${name}" foi adicionado com sucesso`,
      });

      onOpenChange(false);
      onSuccess?.();

      // Reset form
      setName("");
      setUrl("");
      setInterval(60);
      setSelectedDays(DAYS.map(d => d.value));
      setSelectedWindows(WINDOWS.map(w => w.value));
      setSelectedTags([]);
    } catch (error: any) {
      toast({
        title: "Erro ao criar monitor",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-foreground">
            Novo Monitor
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-foreground">Nome do Monitor</Label>
            <Input
              id="name"
              placeholder="Ex: ED Offers - US"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-muted border-border"
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>

          {/* URL */}
          <div className="space-y-2">
            <Label htmlFor="url" className="text-foreground flex items-center gap-2">
              <LinkIcon className="h-4 w-4" />
              URL da Biblioteca de Anúncios
            </Label>
            <Input
              id="url"
              placeholder="https://www.facebook.com/ads/library/?active_status=all&ad_type=all&..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="bg-muted border-border font-mono text-sm"
            />
            {errors.url && (
              <p className="text-sm text-destructive">{errors.url}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Cole o link completo da pesquisa na Biblioteca de Anúncios do Meta
            </p>
          </div>

          {/* Schedule */}
          <div className="space-y-4">
            <Label className="text-foreground">Agendamento</Label>
            
            <div className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Intervalo de coleta</p>
                <Select value={interval.toString()} onValueChange={(v) => setInterval(Number(v))}>
                  <SelectTrigger className="w-full bg-muted border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERVALS.map((i) => (
                      <SelectItem key={i.value} value={i.value.toString()}>
                        {i.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Dias ativos</p>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((day) => (
                    <Button
                      key={day.value}
                      type="button"
                      size="sm"
                      variant={selectedDays.includes(day.value) ? "default" : "outline"}
                      onClick={() => toggleDay(day.value)}
                      className={selectedDays.includes(day.value) ? "bg-primary text-primary-foreground" : ""}
                    >
                      {day.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Janelas de horário</p>
                <div className="space-y-2">
                  {WINDOWS.map((window) => (
                    <div key={window.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={window.value}
                        checked={selectedWindows.includes(window.value)}
                        onCheckedChange={() => toggleWindow(window.value)}
                      />
                      <label
                        htmlFor={window.value}
                        className="text-sm text-foreground cursor-pointer"
                      >
                        {window.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-3">
            <Label className="text-foreground">Tags (opcional)</Label>
            
            {existingTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {existingTags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={`transition-all ${selectedTags.includes(tag.id) ? 'ring-2 ring-primary ring-offset-2 ring-offset-card rounded-full' : ''}`}
                  >
                    <TagChip name={tag.name} type={tag.type} />
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Input
                placeholder="Nova tag..."
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                className="bg-muted border-border flex-1"
              />
              <Select value={newTagType} onValueChange={(v: any) => setNewTagType(v)}>
                <SelectTrigger className="w-32 bg-muted border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nicho">Nicho</SelectItem>
                  <SelectItem value="idioma">Idioma</SelectItem>
                  <SelectItem value="pais">País</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                onClick={handleAddNewTag}
                disabled={!newTagName.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Criar Monitor"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
