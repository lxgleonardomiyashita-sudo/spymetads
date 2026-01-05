import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TagChip } from "@/components/ui/tag-chip";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Plus, Search, Hash, MoreVertical, Edit, Trash2, Loader2 } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface Tag {
  id: string;
  name: string;
  type: 'nicho' | 'idioma' | 'pais' | 'custom';
  monitorsCount: number;
}

const typeLabels = {
  nicho: 'Nicho',
  idioma: 'Idioma',
  pais: 'País',
  custom: 'Personalizado',
};

function TagsContent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagType, setNewTagType] = useState<'nicho' | 'idioma' | 'pais' | 'custom'>('nicho');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchTags = async () => {
    if (!user) return;

    try {
      // Fetch tags with monitor count
      const { data: tagsData, error: tagsError } = await supabase
        .from('tags')
        .select(`
          *,
          monitor_tags (monitor_id)
        `)
        .eq('user_id', user.id)
        .order('name');

      if (tagsError) throw tagsError;

      const transformedTags: Tag[] = (tagsData || []).map((t) => ({
        id: t.id,
        name: t.name,
        type: t.type as Tag['type'],
        monitorsCount: t.monitor_tags?.length || 0,
      }));

      setTags(transformedTags);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar tags",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTags();
  }, [user]);

  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim() || !user) return;

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('tags')
        .insert({
          user_id: user.id,
          name: newTagName.trim(),
          type: newTagType,
        });

      if (error) throw error;

      toast({
        title: "Tag criada!",
        description: `Tag "${newTagName}" foi adicionada`,
      });

      setNewTagName("");
      setDialogOpen(false);
      fetchTags();
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
      setIsSubmitting(false);
    }
  };

  const deleteTag = async (tagId: string) => {
    try {
      const { error } = await supabase
        .from('tags')
        .delete()
        .eq('id', tagId);

      if (error) throw error;

      setTags(prev => prev.filter(t => t.id !== tagId));
      toast({ title: "Tag excluída" });
    } catch (error: any) {
      toast({
        title: "Erro ao excluir tag",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const filteredTags = tags.filter((tag) => {
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

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

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
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90 glow-hover"
            onClick={() => setDialogOpen(true)}
          >
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
              {tags.length}
            </p>
          </div>
          <div className="metric-card">
            <p className="text-sm text-muted-foreground">Nichos</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {tags.filter((t) => t.type === 'nicho').length}
            </p>
          </div>
          <div className="metric-card">
            <p className="text-sm text-muted-foreground">Idiomas</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {tags.filter((t) => t.type === 'idioma').length}
            </p>
          </div>
          <div className="metric-card">
            <p className="text-sm text-muted-foreground">Países</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {tags.filter((t) => t.type === 'pais').length}
            </p>
          </div>
        </div>

        {/* Tags Grid by Type */}
        {Object.entries(groupedTags).map(([type, typeTags]) => (
          <div key={type} className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Hash className="h-5 w-5 text-primary" />
              {typeLabels[type as keyof typeof typeLabels]}
              <span className="text-sm font-normal text-muted-foreground">
                ({typeTags.length})
              </span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {typeTags.map((tag) => (
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
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => deleteTag(tag.id)}
                      >
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

        {filteredTags.length === 0 && !isLoading && (
          <div className="text-center py-12">
            <Hash className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground">
              {tags.length === 0 ? "Nenhuma tag cadastrada" : "Nenhuma tag encontrada"}
            </h3>
            <p className="text-muted-foreground mt-1">
              {tags.length === 0
                ? "Crie tags para organizar seus monitores."
                : "Tente ajustar sua busca."}
            </p>
            {tags.length === 0 && (
              <Button
                className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => setDialogOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeira Tag
              </Button>
            )}
          </div>
        )}

        {/* New Tag Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground">Nova Tag</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateTag} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="tagName" className="text-foreground">Nome</Label>
                <Input
                  id="tagName"
                  placeholder="Ex: ED, PT-BR, Brasil..."
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  className="bg-muted border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tagType" className="text-foreground">Tipo</Label>
                <Select value={newTagType} onValueChange={(v: any) => setNewTagType(v)}>
                  <SelectTrigger className="bg-muted border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nicho">Nicho</SelectItem>
                    <SelectItem value="idioma">Idioma</SelectItem>
                    <SelectItem value="pais">País</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || !newTagName.trim()}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

export default function Tags() {
  return (
    <ProtectedRoute>
      <TagsContent />
    </ProtectedRoute>
  );
}
