import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import type { TagType } from "@/types/monitor";
import { getTagColor } from "@/lib/tag-constants";

interface TagChipProps {
  name: string;
  type: TagType;
  color?: string | null;
  size?: 'sm' | 'md';
  removable?: boolean;
  onRemove?: () => void;
  className?: string;
}

export function TagChip({
  name,
  type,
  color,
  size = 'md',
  removable = false,
  onRemove,
  className,
}: TagChipProps) {
  const resolvedColor = getTagColor(type, color);

  const sizeClasses = {
    sm: 'text-[10px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
  };

  return (
    <span
      className={cn(
        "tag-chip",
        sizeClasses[size],
        className
      )}
      style={{
        backgroundColor: `${resolvedColor}20`,
        color: resolvedColor,
        borderColor: `${resolvedColor}30`,
        borderWidth: '1px',
        borderStyle: 'solid',
      }}
    >
      <span className="truncate max-w-[100px]">{name}</span>
      {removable && onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-1 hover:text-foreground transition-colors"
        >
          <X className={cn(size === 'sm' ? "h-2.5 w-2.5" : "h-3 w-3")} />
        </button>
      )}
    </span>
  );
}
