import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TagChip } from "@/components/ui/tag-chip";
import { Plus, X, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import type { Tag, TagType } from "@/types/monitor";
import { TAG_TYPE_CONFIG, TAG_TYPES, getTagColor } from "@/lib/tag-constants";

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
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<TagType>('nicho');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentTagIds = new Set(currentTags.map(t => t.id));
  
  // Filter tags not already assigned to this monitor
  const availableTags = allTags.filter(t => !currentTagIds.has(t.id));
  
  // Filter by search term
  const filteredTags = availableTags.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Popular tags (most used across all monitors)
  const popularTags = availableTags.slice(0, 5);

  const handleAddTag = async (tagId: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('monitor_tags')
        .insert({ monitor_id: monitorId, tag_id: tagId });

      if (error) throw error;
      
      onTagsUpdated();
      setSearchTerm("");
    } catch (error: any) {
      toast({
        title: "Erro ao adicionar tag",
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
        .from('monitor_tags')
        .delete()
        .eq('monitor_id', monitorId)
        .eq('tag_id', tagId);

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

  const handleCreateAndAddTag = async () => {
    if (!searchTerm.trim() || !user) return;
    
    setIsLoading(true);
    try {
      // Create tag
      const { data: newTag, error: createError } = await supabase
        .from('tags')
        .insert({
          user_id: user.id,
          name: searchTerm.trim(),
          type: selectedType,
        })
        .select()
        .single();

      if (createError) throw createError;

      // Link to monitor
      const { error: linkError } = await supabase
        .from('monitor_tags')
        .insert({ monitor_id: monitorId, tag_id: newTag.id });

      if (linkError) throw linkError;

      toast({
        title: "Tag criada e adicionada!",
        description: `"${newTag.name}" foi criada e vinculada ao monitor`,
      });

      onTagsUpdated();
      setSearchTerm("");
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

  const exactMatch = allTags.find(t => t.name.toLowerCase() === searchTerm.toLowerCase());

  return (
    <div ref={containerRef} className="relative">
      {/* Current Tags */}
      <div className="flex flex-wrap gap-1 items-center">
        {currentTags.map(tag => (
          <div key={tag.id} className="group relative">
            <TagChip name={tag.name} type={tag.type} color={tag.color} size="sm" />
            <button
              onClick={(e) => { e.stopPropagation(); handleRemoveTag(tag.id); }}
              className="absolute -top-1 -right-1 h-3.5 w-3.5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              disabled={isLoading}
            >
              <X className="h-2 w-2" />
            </button>
          </div>
        ))}
        
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-6 px-2 text-xs text-muted-foreground hover:text-primary",
            compact && "h-5 px-1.5"
          )}
          onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
          disabled={isLoading}
        >
          {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
        </Button>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div 
          className="absolute z-50 top-full left-0 mt-1 w-64 bg-popover border border-border rounded-lg shadow-lg p-2 space-y-2"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search Input */}
          <Input
            ref={inputRef}
            placeholder="Buscar ou criar tag..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8 text-sm"
            autoFocus
          />

          {/* Type selector for new tags */}
          {searchTerm && !exactMatch && (
            <div className="flex gap-1 flex-wrap">
              {TAG_TYPES.map(type => (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full transition-all"
                  )}
                  style={{
                    backgroundColor: `${getTagColor(type)}20`,
                    color: getTagColor(type),
                    ...(selectedType === type ? { boxShadow: `0 0 0 1px ${getTagColor(type)}` } : {}),
                  }}
                >
                  {TAG_TYPE_CONFIG[type].label}
                </button>
              ))}
            </div>
          )}

          {/* Suggestions / Results */}
          <div className="max-h-32 overflow-y-auto space-y-1">
            {/* Create new tag option */}
            {searchTerm && !exactMatch && (
              <button
                onClick={handleCreateAndAddTag}
                className="w-full flex items-center gap-2 p-1.5 rounded hover:bg-muted text-left text-sm"
                disabled={isLoading}
              >
                <Plus className="h-3.5 w-3.5 text-primary" />
                <span>Criar</span>
                <TagChip name={searchTerm} type={selectedType} color={getTagColor(selectedType)} size="sm" />
              </button>
            )}

            {/* Filtered tags */}
            {filteredTags.length > 0 ? (
              filteredTags.slice(0, 8).map(tag => (
                <button
                  key={tag.id}
                  onClick={() => handleAddTag(tag.id)}
                  className="w-full flex items-center gap-2 p-1.5 rounded hover:bg-muted text-left"
                  disabled={isLoading}
                >
                  <Check className="h-3.5 w-3.5 text-transparent" />
                  <TagChip name={tag.name} type={tag.type} color={tag.color} size="sm" />
                </button>
              ))
            ) : !searchTerm && popularTags.length > 0 ? (
              <>
                <p className="text-[10px] text-muted-foreground px-1">Sugestões:</p>
                {popularTags.map(tag => (
                  <button
                    key={tag.id}
                    onClick={() => handleAddTag(tag.id)}
                    className="w-full flex items-center gap-2 p-1.5 rounded hover:bg-muted text-left"
                    disabled={isLoading}
                  >
                    <Check className="h-3.5 w-3.5 text-transparent" />
                    <TagChip name={tag.name} type={tag.type} color={tag.color} size="sm" />
                  </button>
                ))}
              </>
            ) : searchTerm && filteredTags.length === 0 && exactMatch ? (
              <p className="text-xs text-muted-foreground text-center py-2">
                Tag já adicionada
              </p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}