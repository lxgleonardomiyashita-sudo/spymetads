import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Check, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tag, TagType } from "@/types/monitor";
import { TAG_TYPE_CONFIG, TAG_TYPES, getTagColor } from "@/lib/tag-constants";

/** Sugestões prontas por categoria — viram tags reais com um clique. */
const SUGGESTED_TAGS: Partial<Record<TagType, string[]>> = {
  nicho: ["Emagrecimento", "Relacionamento", "Finanças", "Saúde", "Beleza", "Espiritualidade"],
  idioma: ["Português", "Inglês", "Espanhol", "Francês"],
  pais: ["Brasil", "EUA", "México", "Portugal"],
  modelo_funil: ["VSL", "Quiz", "Presell + Quiz", "Presell + VSL", "TSL", "Página de Vendas", "App"],
  faixa_preco: ["Low ticket", "Mid ticket", "High ticket"],
};

interface TagPickerListProps {
  allTags: Tag[];
  selectedIds: Set<string>;
  onToggle: (tag: Tag) => void;
  onCreate: (name: string, type: TagType) => Promise<void> | void;
  busy?: boolean;
}

export function TagPickerList({ allTags, selectedIds, onToggle, onCreate, busy }: TagPickerListProps) {
  const [search, setSearch] = useState("");
  const [addingIn, setAddingIn] = useState<TagType | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const term = search.trim().toLowerCase();
  const existingNames = new Set(allTags.map((t) => t.name.toLowerCase()));

  const handleCreate = async (name: string, type: TagType) => {
    const trimmed = name.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    try {
      await onCreate(trimmed, type);
      setNewName("");
      setAddingIn(null);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-3">
      <Input
        placeholder="Buscar tag..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-8 text-sm"
      />

      <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
        {TAG_TYPES.map((type) => {
          const color = getTagColor(type);
          const tags = allTags
            .filter((t) => t.type === type)
            .filter((t) => !term || t.name.toLowerCase().includes(term));
          const suggestions = (SUGGESTED_TAGS[type] ?? [])
            .filter((s) => !existingNames.has(s.toLowerCase()))
            .filter((s) => !term || s.toLowerCase().includes(term));

          if (term && tags.length === 0 && suggestions.length === 0) return null;

          return (
            <div key={type}>
              {/* Cabeçalho da categoria */}
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color }}>
                  {TAG_TYPE_CONFIG[type].label}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setAddingIn(addingIn === type ? null : type);
                    setNewName("");
                  }}
                  className="ml-auto text-muted-foreground hover:text-primary transition-colors"
                  title={`Adicionar ${TAG_TYPE_CONFIG[type].label.toLowerCase()}`}
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>

              {/* Campo de criação inline */}
              {addingIn === type && (
                <div className="flex items-center gap-1 mb-1.5">
                  <Input
                    autoFocus
                    placeholder={`Nova tag de ${TAG_TYPE_CONFIG[type].label.toLowerCase()}...`}
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleCreate(newName, type);
                      }
                      if (e.key === "Escape") setAddingIn(null);
                    }}
                    className="h-7 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => handleCreate(newName, type)}
                    disabled={!newName.trim() || creating}
                    className="text-primary disabled:opacity-40"
                  >
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  </button>
                </div>
              )}

              {/* Tags existentes + sugestões */}
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => {
                  const selected = selectedIds.has(tag.id);
                  const tagColor = getTagColor(tag.type as TagType, tag.color);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      disabled={busy}
                      onClick={() => onToggle(tag)}
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full transition-all border",
                        selected ? "font-medium" : "border-border text-muted-foreground hover:border-primary/50"
                      )}
                      style={
                        selected
                          ? {
                              backgroundColor: `${tagColor}22`,
                              color: tagColor,
                              borderColor: tagColor,
                            }
                          : undefined
                      }
                    >
                      {selected && <Check className="h-2.5 w-2.5" />}
                      {tag.name}
                    </button>
                  );
                })}

                {suggestions.map((name) => (
                  <button
                    key={name}
                    type="button"
                    disabled={busy || creating}
                    onClick={() => handleCreate(name, type)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border border-dashed border-border text-muted-foreground/70 hover:text-primary hover:border-primary/50 transition-colors"
                    title="Sugestão — clique para criar"
                  >
                    <Plus className="h-2.5 w-2.5" />
                    {name}
                  </button>
                ))}

                {tags.length === 0 && suggestions.length === 0 && (
                  <span className="text-[10px] text-muted-foreground/60">Nenhuma tag — use o + acima</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
