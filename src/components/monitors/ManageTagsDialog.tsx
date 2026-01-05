import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Plus, Loader2, Tags } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface Tag {
  id: string;
  name: string;
  type: 'nicho' | 'idioma' | 'pais' | 'custom';
}

interface ManageTagsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  monitorId: string;
  monitorName: string;
  currentTags: Tag[];
  allTags: Tag[];
  onSuccess: () => void;
}

export function ManageTagsDialog({
  open,
  onOpenChange,
  monitorId,
  monitorName,
  currentTags,
  allTags,
  onSuccess,
}: ManageTagsDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedTags, setSelectedTags] = useState<string[]>(currentTags.map(t => t.id));
  const [newTagName, setNewTagName] = useState("");
  const [newTagType, setNewTagType] = useState<'nicho' | 'idioma' | 'pais' | 'custom'>('nicho');
  const [isLoading, setIsLoading] = useState(false);
  const [isAddingTag, setIsAddingTag] = useState(false);

  // Reset selected tags when dialog opens
  useState(() => {
    setSelectedTags(currentTags.map(t => t.id));
  });

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev =>
      prev.includes(tagId) ? prev.filter(t => t !== tagId) : [...prev, tagId]
    );
  };

  const handleAddNewTag = async () => {
    if (!newTagName.trim() || !user) return;

    setIsAddingTag(true);
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
        onSuccess(); // Refresh tags list
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
    } finally {
      setIsAddingTag(false);
    }
  };

  const handleSave = async () => {
    setIsLoading(true);

    try {
      // Remove all current tags
      const { error: deleteError } = await supabase
        .from('monitor_tags')
        .delete()
        .eq('monitor_id', monitorId);

      if (deleteError) throw deleteError;

      // Add selected tags
      if (selectedTags.length > 0) {
        const tagLinks = selectedTags.map(tagId => ({
          monitor_id: monitorId,
          tag_id: tagId,
        }));

        const { error: insertError } = await supabase
          .from('monitor_tags')
          .insert(tagLinks);

        if (insertError) throw insertError;
      }

      toast({
        title: "Tags atualizadas!",
        description: `Tags do monitor "${monitorName}" foram atualizadas`,
      });

      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar tags",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Combine current tags with all available tags (without duplicates)
  const availableTags = [...allTags];
  currentTags.forEach(ct => {
    if (!availableTags.find(t => t.id === ct.id)) {
      availableTags.push(ct);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
            <Tags className="h-5 w-5 text-primary" />
            Gerenciar Tags
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <p className="text-sm text-muted-foreground">
            Monitor: <span className="text-foreground font-medium">{monitorName}</span>
          </p>

          {/* Current/Available Tags */}
          {availableTags.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Clique para adicionar/remover:</p>
              <div className="flex flex-wrap gap-2">
                {availableTags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={`transition-all ${
                      selectedTags.includes(tag.id)
                        ? 'ring-2 ring-primary ring-offset-2 ring-offset-card rounded-full'
                        : 'opacity-50 hover:opacity-100'
                    }`}
                  >
                    <TagChip name={tag.name} type={tag.type} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Create New Tag */}
          <div className="space-y-2 pt-4 border-t border-border">
            <p className="text-sm text-muted-foreground">Criar nova tag:</p>
            <div className="flex gap-2">
              <Input
                placeholder="Nome da tag..."
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                className="bg-muted border-border flex-1"
              />
              <Select value={newTagType} onValueChange={(v: any) => setNewTagType(v)}>
                <SelectTrigger className="w-28 bg-muted border-border">
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
                disabled={!newTagName.trim() || isAddingTag}
              >
                {isAddingTag ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={isLoading}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
