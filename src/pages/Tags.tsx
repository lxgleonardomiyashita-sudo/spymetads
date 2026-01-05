import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TagChip } from "@/components/ui/tag-chip";
import { Plus, Search, Hash, MoreVertical, Edit, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface Tag {
  id: string;
  name: string;
  type: 'nicho' | 'idioma' | 'pais' | 'custom';
  monitorsCount: number;
}

const mockTags: Tag[] = [
  { id: '1', name: 'ED', type: 'nicho', monitorsCount: 5 },
  { id: '2', name: 'Diabetes', type: 'nicho', monitorsCount: 3 },
  { id: '3', name: 'Emagrecimento', type: 'nicho', monitorsCount: 4 },
  { id: '4', name: 'Skincare', type: 'nicho', monitorsCount: 2 },
  { id: '5', name: 'EN-US', type: 'idioma', monitorsCount: 8 },
  { id: '6', name: 'PT-BR', type: 'idioma', monitorsCount: 6 },
  { id: '7', name: 'DE', type: 'idioma', monitorsCount: 2 },
  { id: '8', name: 'ES', type: 'idioma', monitorsCount: 3 },
  { id: '9', name: 'FR', type: 'idioma', monitorsCount: 1 },
  { id: '10', name: 'USA', type: 'pais', monitorsCount: 7 },
  { id: '11', name: 'Brasil', type: 'pais', monitorsCount: 5 },
  { id: '12', name: 'Alemanha', type: 'pais', monitorsCount: 2 },
  { id: '13', name: 'Alta Prioridade', type: 'custom', monitorsCount: 4 },
  { id: '14', name: 'Teste A/B', type: 'custom', monitorsCount: 2 },
];

const typeLabels = {
  nicho: 'Nicho',
  idioma: 'Idioma',
  pais: 'País',
  custom: 'Personalizado',
};

export default function Tags() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  const filteredTags = mockTags.filter((tag) => {
    const matchesSearch = tag.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || tag.type === filterType;
    return matchesSearch && matchesType;
  });

  const groupedTags = filteredTags.reduce((acc, tag) => {
    const type = tag.type;
    if (!acc[type]) acc[type] = [];
    acc[type].push(tag);
    return acc;
  }, {} as Record<string, Tag[]>);

  return (
    <AppLayout>
      <div className="space-y-6 fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Tags</h1>
            <p className="text-muted-foreground mt-1">
              Organize seus monitores com tags
            </p>
          </div>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90 glow-hover">
            <Plus className="h-4 w-4 mr-2" />
            Nova Tag
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-card border-border"
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[180px] bg-card border-border">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="nicho">Nicho</SelectItem>
              <SelectItem value="idioma">Idioma</SelectItem>
              <SelectItem value="pais">País</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="metric-card">
            <p className="text-sm text-muted-foreground">Total de Tags</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {mockTags.length}
            </p>
          </div>
          <div className="metric-card">
            <p className="text-sm text-muted-foreground">Nichos</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {mockTags.filter((t) => t.type === 'nicho').length}
            </p>
          </div>
          <div className="metric-card">
            <p className="text-sm text-muted-foreground">Idiomas</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {mockTags.filter((t) => t.type === 'idioma').length}
            </p>
          </div>
          <div className="metric-card">
            <p className="text-sm text-muted-foreground">Países</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {mockTags.filter((t) => t.type === 'pais').length}
            </p>
          </div>
        </div>

        {/* Tags Grid by Type */}
        {Object.entries(groupedTags).map(([type, tags]) => (
          <div key={type} className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Hash className="h-5 w-5 text-primary" />
              {typeLabels[type as keyof typeof typeLabels]}
              <span className="text-sm font-normal text-muted-foreground">
                ({tags.length})
              </span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {tags.map((tag) => (
                <div
                  key={tag.id}
                  className="metric-card flex items-center justify-between hover:border-primary/30 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <TagChip name={tag.name} type={tag.type} />
                    <span className="text-sm text-muted-foreground">
                      {tag.monitorsCount} monitores
                    </span>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          </div>
        ))}

        {filteredTags.length === 0 && (
          <div className="text-center py-12">
            <Hash className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground">
              Nenhuma tag encontrada
            </h3>
            <p className="text-muted-foreground mt-1">
              Tente ajustar sua busca ou crie uma nova tag.
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
