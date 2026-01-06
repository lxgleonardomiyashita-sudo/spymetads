import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Tags, ChevronDown, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Tag {
  id: string;
  name: string;
  type: string;
}

interface TagFilterProps {
  tags: Tag[];
  selectedTagIds: string[];
  onSelectionChange: (tagIds: string[]) => void;
}

export function TagFilter({ tags, selectedTagIds, onSelectionChange }: TagFilterProps) {
  const tagsByType = tags.reduce((acc, tag) => {
    if (!acc[tag.type]) acc[tag.type] = [];
    acc[tag.type].push(tag);
    return acc;
  }, {} as Record<string, Tag[]>);

  const toggleTag = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onSelectionChange(selectedTagIds.filter((id) => id !== tagId));
    } else {
      onSelectionChange([...selectedTagIds, tagId]);
    }
  };

  const clearAll = () => {
    onSelectionChange([]);
  };

  const selectedTags = tags.filter((t) => selectedTagIds.includes(t.id));

  return (
    <div className="flex items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="bg-card border-border gap-2">
            <Tags className="h-4 w-4" />
            Tags
            {selectedTagIds.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                {selectedTagIds.length}
              </Badge>
            )}
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0" align="start">
          <div className="p-3 border-b border-border flex items-center justify-between">
            <span className="text-sm font-medium">Filtrar por Tags</span>
            {selectedTagIds.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAll} className="h-7 px-2 text-xs">
                Limpar
              </Button>
            )}
          </div>
          <ScrollArea className="h-[300px]">
            <div className="p-3 space-y-4">
              {Object.entries(tagsByType).map(([type, typeTags]) => (
                <div key={type}>
                  <p className="text-xs font-medium text-muted-foreground uppercase mb-2">
                    {type}
                  </p>
                  <div className="space-y-2">
                    {typeTags.map((tag) => (
                      <label
                        key={tag.id}
                        className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1 rounded-md"
                      >
                        <Checkbox
                          checked={selectedTagIds.includes(tag.id)}
                          onCheckedChange={() => toggleTag(tag.id)}
                        />
                        <span className="text-sm">{tag.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              {tags.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma tag cadastrada
                </p>
              )}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedTags.slice(0, 3).map((tag) => (
            <Badge
              key={tag.id}
              variant="secondary"
              className="gap-1 cursor-pointer hover:bg-destructive/20"
              onClick={() => toggleTag(tag.id)}
            >
              {tag.name}
              <X className="h-3 w-3" />
            </Badge>
          ))}
          {selectedTags.length > 3 && (
            <Badge variant="outline">+{selectedTags.length - 3}</Badge>
          )}
        </div>
      )}
    </div>
  );
}
