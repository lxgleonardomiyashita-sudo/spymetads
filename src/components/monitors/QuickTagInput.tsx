import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TagChip } from "@/components/ui/tag-chip";
import { TagPickerList } from "./TagPickerList";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import type { Tag, TagType } from "@/types/monitor";

interface QuickTagInputProps {
  monitorId: string;
  currentTags: Tag[];
  allTags: Tag[];
  onTagsUpdated: () => void;
  compact?: boolean;
}

export function QuickTagInput({
  monitorId,
  currentTags,
  allTags,
  onTagsUpdated,
  compact = false,
}: QuickTagInputProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const currentTagIds = new Set(currentTags.map((t) => t.id));

  const handleToggleTag = async (tag: Tag) => {
    setIsLoading(true);
    try {
      if (currentTagIds.has(tag.id)) {
        const { error } = await supabase
          .from("monitor_tags")
          .delete()
          .eq("monitor_id", monitorId)
          .eq("tag_id", tag.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("monitor_tags")
          .insert({ monitor_id: monitorId, tag_id: tag.id });
        if (error) throw error;
      }
      onTagsUpdated();
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

  const handleRemoveTag = async (tagId: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("monitor_tags")
        .delete()
        .eq("monitor_id", monitorId)
        .eq("tag_id", tagId);
      if (error) throw error;
      onTagsUpdated();
    } catch (error: any) {
      toast({
        title: "Erro ao remover tag",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAndAddTag = async (name: string, type: TagType) => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data: newTag, error: createError } = await supabase
        .from("tags")
        .insert({ user_id: user.id, name, type })
        .select()
        .single();

      if (createError) throw createError;

      const { error: linkError } = await supabase
        .from("monitor_tags")
        .insert({ monitor_id: monitorId, tag_id: newTag.id });

      if (linkError) throw linkError;

      toast({
        title: "Tag criada e adicionada!",
        description: `"${newTag.name}" foi criada e vinculada ao monitor`,
      });
      onTagsUpdated();
    } catch (error: any) {
      if (error.message?.includes("duplicate")) {
        toast({
          title: "Tag já existe",
          description: "Use a tag existente da lista",
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
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-1 items-center">
      {currentTags.map((tag) => (
        <div key={tag.id} className="group relative">
          <TagChip name={tag.name} type={tag.type} color={tag.color} size="sm" />
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleRemoveTag(tag.id);
            }}
            className="absolute -top-1 -right-1 h-3.5 w-3.5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            disabled={isLoading}
          >
            <X className="h-2 w-2" />
          </button>
        </div>
      ))}

      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-6 px-2 text-xs text-muted-foreground hover:text-primary",
              compact && "h-5 px-1.5"
            )}
            onClick={(e) => e.stopPropagation()}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="top"
          className="w-[360px] max-w-[92vw] p-3"
          onClick={(e) => e.stopPropagation()}
        >
          <TagPickerList
            allTags={allTags}
            selectedIds={currentTagIds}
            onToggle={handleToggleTag}
            onCreate={handleCreateAndAddTag}
            busy={isLoading}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
