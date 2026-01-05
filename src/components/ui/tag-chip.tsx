import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface TagChipProps {
  name: string;
  type: 'nicho' | 'idioma' | 'pais' | 'custom';
  size?: 'sm' | 'md';
  removable?: boolean;
  onRemove?: () => void;
  className?: string;
}

export function TagChip({
  name,
  type,
  size = 'md',
  removable = false,
  onRemove,
  className,
}: TagChipProps) {
  const typeClasses = {
    nicho: 'tag-chip-niche',
    idioma: 'tag-chip-idioma',
    pais: 'tag-chip-pais',
    custom: 'tag-chip-custom',
  };

  const sizeClasses = {
    sm: 'text-[10px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
  };

  return (
    <span
      className={cn(
        "tag-chip",
        typeClasses[type],
        sizeClasses[size],
        className
      )}
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
