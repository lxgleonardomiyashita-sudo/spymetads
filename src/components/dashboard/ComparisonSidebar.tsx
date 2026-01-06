import { useState } from "react";
import { X, Layers, Tag, ChevronRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { getChartColor } from "@/components/charts/MultiLineChart";

interface Group {
  id: string;
  name: string;
  color: string;
  totalAds: number;
}

interface TagItem {
  id: string;
  name: string;
  type: string;
  totalAds: number;
}

type GroupByMode = 'group' | 'tag';

interface ComparisonSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  groups: Group[];
  tags: TagItem[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  groupByMode: GroupByMode;
  onGroupByModeChange: (mode: GroupByMode) => void;
  maxSelections?: number;
}

export function ComparisonSidebar({
  isOpen,
  onClose,
  groups,
  tags,
  selectedIds,
  onSelectionChange,
  groupByMode,
  onGroupByModeChange,
  maxSelections = 10,
}: ComparisonSidebarProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    groups: true,
    tags: true,
  });

  const items = groupByMode === 'group' ? groups : tags;

  const toggleItem = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((i) => i !== id));
    } else if (selectedIds.length < maxSelections) {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const clearAll = () => {
    onSelectionChange([]);
  };

  const selectTop = (count: number) => {
    const sorted = [...items].sort((a, b) => b.totalAds - a.totalAds);
    onSelectionChange(sorted.slice(0, count).map((i) => i.id));
  };

  if (!isOpen) return null;

  return (
    <div className="w-72 border-l border-border bg-card h-full flex flex-col slide-in-right">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="font-semibold text-foreground">Comparativo</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Mode Toggle */}
      <div className="p-4 border-b border-border">
        <p className="text-xs text-muted-foreground mb-2">Agrupar por</p>
        <div className="flex gap-2">
          <Button
            variant={groupByMode === 'group' ? 'default' : 'outline'}
            size="sm"
            className="flex-1"
            onClick={() => onGroupByModeChange('group')}
          >
            <Layers className="h-4 w-4 mr-1" />
            Grupo
          </Button>
          <Button
            variant={groupByMode === 'tag' ? 'default' : 'outline'}
            size="sm"
            className="flex-1"
            onClick={() => onGroupByModeChange('tag')}
          >
            <Tag className="h-4 w-4 mr-1" />
            Tag
          </Button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="p-4 border-b border-border flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => selectTop(5)}
        >
          Top 5
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => selectTop(10)}
        >
          Top 10
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAll}
          disabled={selectedIds.length === 0}
        >
          Limpar
        </Button>
      </div>

      {/* Selection Count */}
      <div className="px-4 py-2 bg-muted/30">
        <p className="text-xs text-muted-foreground">
          {selectedIds.length} de {maxSelections} selecionados
        </p>
      </div>

      {/* Items List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {/* Groups Section (when in group mode) */}
          {groupByMode === 'group' && (
            <div className="mb-2">
              <button
                onClick={() => toggleSection('groups')}
                className="flex items-center gap-2 w-full p-2 rounded-md hover:bg-accent/50 transition-colors"
              >
                {expandedSections.groups ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <Layers className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-foreground">Grupos</span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {groups.length}
                </span>
              </button>
              {expandedSections.groups && (
                <div className="ml-6 mt-1 space-y-1">
                  {groups
                    .sort((a, b) => b.totalAds - a.totalAds)
                    .map((group, index) => {
                      const isSelected = selectedIds.includes(group.id);
                      const selectedIndex = selectedIds.indexOf(group.id);
                      return (
                        <label
                          key={group.id}
                          className={cn(
                            "flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors",
                            isSelected ? "bg-primary/10" : "hover:bg-accent/50",
                            !isSelected && selectedIds.length >= maxSelections && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleItem(group.id)}
                            disabled={!isSelected && selectedIds.length >= maxSelections}
                          />
                          {isSelected && (
                            <span
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: getChartColor(selectedIndex) }}
                            />
                          )}
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: group.color }}
                          />
                          <span className="text-sm text-foreground truncate flex-1">
                            {group.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {group.totalAds.toLocaleString('pt-BR')}
                          </span>
                        </label>
                      );
                    })}
                </div>
              )}
            </div>
          )}

          {/* Tags Section (when in tag mode) */}
          {groupByMode === 'tag' && (
            <div className="mb-2">
              <button
                onClick={() => toggleSection('tags')}
                className="flex items-center gap-2 w-full p-2 rounded-md hover:bg-accent/50 transition-colors"
              >
                {expandedSections.tags ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <Tag className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-foreground">Tags</span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {tags.length}
                </span>
              </button>
              {expandedSections.tags && (
                <div className="ml-6 mt-1 space-y-1">
                  {tags
                    .sort((a, b) => b.totalAds - a.totalAds)
                    .map((tag, index) => {
                      const isSelected = selectedIds.includes(tag.id);
                      const selectedIndex = selectedIds.indexOf(tag.id);
                      return (
                        <label
                          key={tag.id}
                          className={cn(
                            "flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors",
                            isSelected ? "bg-primary/10" : "hover:bg-accent/50",
                            !isSelected && selectedIds.length >= maxSelections && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleItem(tag.id)}
                            disabled={!isSelected && selectedIds.length >= maxSelections}
                          />
                          {isSelected && (
                            <span
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: getChartColor(selectedIndex) }}
                            />
                          )}
                          <span className="text-sm text-foreground truncate flex-1">
                            {tag.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {tag.totalAds.toLocaleString('pt-BR')}
                          </span>
                        </label>
                      );
                    })}
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
