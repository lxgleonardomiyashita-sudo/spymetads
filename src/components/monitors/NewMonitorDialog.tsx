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
import { X, Loader2, Plus, Link as LinkIcon, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { TAG_TYPE_CONFIG, TAG_TYPES, PRESET_TAG_COLORS } from "@/lib/tag-constants";
import type { TagType } from "@/types/monitor";

interface Group {
  id: string;
  name: string;
  color: string;
}

interface NewMonitorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  existingTags: Array<{ id: string; name: string; type: string; color?: string | null }>;
  existingGroups: Group[];
  defaultGroupId?: string;
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
  { value: 'dawn', label: 'Madrugada (00:00-04:59)' },
  { value: 'morning', label: 'Manhã (05:00-11:59)' },
  { value: 'afternoon', label: 'Tarde (12:00-17:59)' },
  { value: 'evening', label: 'Noite (18:00-23:59)' },
];

const INTERVALS = [
  { value: 15, label: 'A cada 15 minutos' },
  { value: 30, label: 'A cada 30 minutos' },
  { value: 60, label: 'A cada 60 minutos' },
];

export function NewMonitorDialog({ open, onOpenChange, onSuccess, existingTags, existingGroups, defaultGroupId }: NewMonitorDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [interval, setInterval] = useState<number>(60);
  const [selectedDays, setSelectedDays] = useState<string[]>(DAYS.map(d => d.value));
  const [selectedWindows, setSelectedWindows] = useState<string[]>(WINDOWS.map(w => w.value));
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(defaultGroupId || null);
  const [newTagName, setNewTagName] = useState("");
  const [newTagType, setNewTagType] = useState<TagType>('nicho');
  const [newTagColor, setNewTagColor] = useState<string>(TAG_TYPE_CONFIG.nicho.defaultColor);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; url?: string }>({});
  
  // Local tags list (includes newly created tags)
  const [localTags, setLocalTags] = useState<Array<{ id: string; name: string; type: string; color?: string | null }>>([]);
  
  // Merge existing + local tags
  const allTags = [...existingTags, ...localTags.filter(lt => !existingTags.some(et => et.id === lt.id))];

  const toggleDay = (day: string) => {
    setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const toggleWindow = (window: string) => {
    setSelectedWindows(prev => prev.includes(window) ? prev.filter(w => w !== window) : [...prev, window]);
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev => prev.includes(tagId) ? prev.filter(t => t !== tagId) : [...prev, tagId]);
  };

  const handleDeleteTag = async (tagId: string) => {
    try {
      const { error } = await supabase.from('tags').delete().eq('id', tagId);
      if (error) throw error;
      setSelectedTags(prev => prev.filter(t => t !== tagId));
      setLocalTags(prev => prev.filter(t => t.id !== tagId));
      toast({ title: "Tag excluída" });
      onSuccess?.(); // refresh parent's tags
    } catch (error: any) {
      toast({ title: "Erro ao excluir tag", description: error.message, variant: "destructive" });
    }
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
          color: newTagColor,
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setSelectedTags(prev => [...prev, data.id]);
        setLocalTags(prev => [...prev, { id: data.id, name: data.name, type: data.type, color: data.color }]);
        setNewTagName("");
        toast({ title: "Tag criada!", description: `Tag "${data.name}" foi adicionada` });
      }
    } catch (error: any) {
      if (error.message?.includes("duplicate")) {
        toast({ title: "Tag já existe", description: "Você já tem uma tag com esse nome", variant: "destructive" });
      } else {
        toast({ title: "Erro ao criar tag", description: error.message, variant: "destructive" });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

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
      toast({ title: "Selecione ao menos um dia", variant: "destructive" });
      return;
    }
    if (selectedWindows.length === 0) {
      toast({ title: "Selecione ao menos uma janela", variant: "destructive" });
      return;
    }
    if (!user) return;

    setIsLoading(true);
    try {
      const { data: monitor, error: monitorError } = await supabase
        .from('monitors')
        .insert({
          user_id: user.id,
          name: name.trim(),
          ad_library_url: url.trim(),
          group_id: selectedGroupId,
          schedule_config: { interval, days: selectedDays, windows: selectedWindows },
          timezone: 'America/Sao_Paulo',
          is_active: true,
        })
        .select()
        .single();

      if (monitorError) throw monitorError;

      if (monitor && selectedTags.length > 0) {
        const tagLinks = selectedTags.map(tagId => ({ monitor_id: monitor.id, tag_id: tagId }));
        const { error: tagsError } = await supabase.from('monitor_tags').insert(tagLinks);
        if (tagsError) throw tagsError;
      }

      toast({ title: "Monitor criado!", description: `"${name}" foi adicionado. Iniciando primeira leitura...` });

      onOpenChange(false);
      onSuccess?.();

      // Background first scrape — re-fetch monitors when done to show reading
      if (monitor) {
        supabase.functions.invoke('scrape-ad-library', {
          body: { monitor_id: monitor.id, url: url.trim(), allow_firecrawl_fallback: true },
        }).then(({ data, error }) => {
          if (data?.success) {
            toast({ title: "Primeira leitura concluída!", description: `${data.ads_count.toLocaleString('pt-BR')} anúncios ativos encontrados` });
          } else if (error) {
            console.error('First scrape error:', error);
          }
          // Always re-fetch to show the new reading
          onSuccess?.();
        });
      }
      setName(""); setUrl(""); setInterval(60);
      setSelectedDays(DAYS.map(d => d.value));
      setSelectedWindows(WINDOWS.map(w => w.value));
      setSelectedTags([]); setSelectedGroupId(null); setLocalTags([]);
    } catch (error: any) {
      toast({ title: "Erro ao criar monitor", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-foreground">Novo Monitor</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-foreground">Nome do Monitor</Label>
            <Input id="name" placeholder="Ex: ED Offers - US" value={name} onChange={(e) => setName(e.target.value)} className="bg-muted border-border" />
            {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
          </div>

          {/* URL */}
          <div className="space-y-2">
            <Label htmlFor="url" className="text-foreground flex items-center gap-2">
              <LinkIcon className="h-4 w-4" /> URL da Biblioteca de Anúncios
            </Label>
            <Input id="url" placeholder="https://www.facebook.com/ads/library/?..." value={url} onChange={(e) => setUrl(e.target.value)} className="bg-muted border-border font-mono text-sm" />
            {errors.url && <p className="text-sm text-destructive">{errors.url}</p>}
            <p className="text-xs text-muted-foreground">Cole o link completo da pesquisa na Biblioteca de Anúncios do Meta</p>
          </div>

          {/* Group */}
          {existingGroups.length > 0 && (
            <div className="space-y-2">
              <Label className="text-foreground">Grupo (opcional)</Label>
              <Select value={selectedGroupId || "no-group"} onValueChange={(v) => setSelectedGroupId(v === "no-group" ? null : v)}>
                <SelectTrigger className="bg-muted border-border"><SelectValue placeholder="Selecione um grupo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="no-group">Sem grupo</SelectItem>
                  {existingGroups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: group.color }} />
                        {group.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Schedule */}
          <div className="space-y-4">
            <Label className="text-foreground">Agendamento</Label>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Intervalo de coleta</p>
                <Select value={interval.toString()} onValueChange={(v) => setInterval(Number(v))}>
                  <SelectTrigger className="w-full bg-muted border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INTERVALS.map((i) => (
                      <SelectItem key={i.value} value={i.value.toString()}>{i.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">Dias ativos</p>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((day) => (
                    <Button key={day.value} type="button" size="sm"
                      variant={selectedDays.includes(day.value) ? "default" : "outline"}
                      onClick={() => toggleDay(day.value)}
                      className={selectedDays.includes(day.value) ? "bg-primary text-primary-foreground" : ""}
                    >{day.label}</Button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">Janelas de horário</p>
                <div className="space-y-2">
                  {WINDOWS.map((window) => (
                    <div key={window.value} className="flex items-center space-x-2">
                      <Checkbox id={window.value} checked={selectedWindows.includes(window.value)} onCheckedChange={() => toggleWindow(window.value)} />
                      <label htmlFor={window.value} className="text-sm text-foreground cursor-pointer">{window.label}</label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Tags - Enhanced with create, delete, color, custom classes */}
          <div className="space-y-3">
            <Label className="text-foreground">Tags (opcional)</Label>
            
            {allTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {allTags.map((tag) => (
                  <div key={tag.id} className="flex items-center gap-0.5 group/tag">
                    <button
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={`transition-all ${selectedTags.includes(tag.id) ? 'ring-2 ring-primary ring-offset-2 ring-offset-card rounded-full' : 'opacity-60 hover:opacity-100'}`}
                    >
                      <TagChip name={tag.name} type={tag.type as any} color={tag.color} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteTag(tag.id)}
                      className="opacity-0 group-hover/tag:opacity-100 transition-opacity p-0.5 rounded-full hover:bg-destructive/20"
                      title="Excluir tag"
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Create new tag with type and color */}
            <div className="space-y-2 p-3 rounded-lg bg-muted/50 border border-border">
              <p className="text-xs text-muted-foreground font-medium">Criar nova tag:</p>
              <div className="flex gap-2">
                <Input
                  placeholder="Nome da tag..."
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  className="bg-background border-border flex-1"
                />
                <Select value={newTagType} onValueChange={(v: TagType) => {
                  setNewTagType(v);
                  setNewTagColor(TAG_TYPE_CONFIG[v].defaultColor);
                }}>
                  <SelectTrigger className="w-40 bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TAG_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{TAG_TYPE_CONFIG[t].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={handleAddNewTag} disabled={!newTagName.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {/* Color picker */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">Cor:</span>
                {PRESET_TAG_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewTagColor(c)}
                    className={`w-5 h-5 rounded-full transition-all border-2 ${
                      newTagColor === c ? 'border-foreground scale-125' : 'border-transparent hover:scale-110'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              {newTagName && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Preview:</span>
                  <TagChip name={newTagName} type={newTagType} color={newTagColor} />
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isLoading} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar Monitor"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
