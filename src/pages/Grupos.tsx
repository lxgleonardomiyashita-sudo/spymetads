import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import {
  Plus,
  Search,
  Folder,
  MoreVertical,
  Edit,
  Trash2,
  Loader2,
  Radio,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Group {
  id: string;
  name: string;
  description: string | null;
  color: string;
  monitors_count: number;
}

const COLORS = [
  '#22d3ee', // cyan
  '#a855f7', // purple
  '#22c55e', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#3b82f6', // blue
  '#ec4899', // pink
  '#6366f1', // indigo
];

function GruposContent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formColor, setFormColor] = useState(COLORS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchGroups = async () => {
    if (!user) return;

    try {
      const { data: groupsData, error } = await supabase
        .from('groups')
        .select(`
          *,
          monitors (id)
        `)
        .eq('user_id', user.id)
        .order('name');

      if (error) throw error;

      const transformedGroups: Group[] = (groupsData || []).map((g) => ({
        id: g.id,
        name: g.name,
        description: g.description,
        color: g.color || COLORS[0],
        monitors_count: g.monitors?.length || 0,
      }));

      setGroups(transformedGroups);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar grupos",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, [user]);

  const openCreateDialog = () => {
    setEditingGroup(null);
    setFormName("");
    setFormDescription("");
    setFormColor(COLORS[0]);
    setDialogOpen(true);
  };

  const openEditDialog = (group: Group) => {
    setEditingGroup(group);
    setFormName(group.name);
    setFormDescription(group.description || "");
    setFormColor(group.color);
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !user) return;

    setIsSubmitting(true);

    try {
      if (editingGroup) {
        const { error } = await supabase
          .from('groups')
          .update({
            name: formName.trim(),
            description: formDescription.trim() || null,
            color: formColor,
          })
          .eq('id', editingGroup.id);

        if (error) throw error;

        toast({ title: "Grupo atualizado!" });
      } else {
        const { error } = await supabase
          .from('groups')
          .insert({
            user_id: user.id,
            name: formName.trim(),
            description: formDescription.trim() || null,
            color: formColor,
          });

        if (error) throw error;

        toast({ title: "Grupo criado!" });
      }

      setDialogOpen(false);
      fetchGroups();
    } catch (error: any) {
      if (error.message?.includes("duplicate")) {
        toast({
          title: "Grupo já existe",
          description: "Você já tem um grupo com esse nome",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro",
          description: error.message,
          variant: "destructive",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteGroup = async (groupId: string) => {
    try {
      const { error } = await supabase
        .from('groups')
        .delete()
        .eq('id', groupId);

      if (error) throw error;

      setGroups(prev => prev.filter(g => g.id !== groupId));
      toast({ title: "Grupo excluído" });
    } catch (error: any) {
      toast({
        title: "Erro ao excluir grupo",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const filteredGroups = groups.filter((group) =>
    group.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
            <h1 className="text-2xl font-bold text-foreground">Grupos</h1>
            <p className="text-muted-foreground mt-1">
              Organize seus monitores em grupos
            </p>
          </div>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90 glow-hover"
            onClick={openCreateDialog}
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Grupo
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar grupos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-card border-border"
          />
        </div>

        {/* Groups Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredGroups.map((group) => (
            <div
              key={group.id}
              className="metric-card hover:border-primary/30 transition-colors cursor-pointer group"
              onClick={() => navigate(`/grupos/${group.id}`)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${group.color}20` }}
                  >
                    <Folder className="h-5 w-5" style={{ color: group.color }} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{group.name}</h3>
                    {group.description && (
                      <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                        {group.description}
                      </p>
                    )}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation();
                      openEditDialog(group);
                    }}>
                      <Edit className="h-4 w-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteGroup(group.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="mt-4 flex items-center gap-2 text-muted-foreground">
                <Radio className="h-4 w-4" />
                <span className="text-sm">{group.monitors_count} monitores</span>
              </div>
            </div>
          ))}
        </div>

        {filteredGroups.length === 0 && !isLoading && (
          <div className="text-center py-12">
            <Folder className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground">
              {groups.length === 0 ? "Nenhum grupo criado" : "Nenhum grupo encontrado"}
            </h3>
            <p className="text-muted-foreground mt-1">
              {groups.length === 0
                ? "Crie grupos para organizar seus monitores."
                : "Tente ajustar sua busca."}
            </p>
            {groups.length === 0 && (
              <Button
                className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={openCreateDialog}
              >
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeiro Grupo
              </Button>
            )}
          </div>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground">
                {editingGroup ? "Editar Grupo" : "Novo Grupo"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-foreground">Nome</Label>
                <Input
                  id="name"
                  placeholder="Ex: Saúde, E-commerce, Finanças..."
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="bg-muted border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description" className="text-foreground">Descrição (opcional)</Label>
                <Input
                  id="description"
                  placeholder="Descrição do grupo..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="bg-muted border-border"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Cor</Label>
                <div className="flex gap-2">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormColor(color)}
                      className={cn(
                        "w-8 h-8 rounded-full transition-all",
                        formColor === color && "ring-2 ring-offset-2 ring-offset-card ring-primary"
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || !formName.trim()}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : editingGroup ? "Salvar" : "Criar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

export default function Grupos() {
  return (
    <ProtectedRoute>
      <GruposContent />
    </ProtectedRoute>
  );
}
