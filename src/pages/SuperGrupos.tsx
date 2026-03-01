import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useKanbanColumns } from "@/hooks/useKanbanColumns";
import {
  Loader2,
  Plus,
  Layers,
  Trash2,
  FlaskConical,
  ExternalLink,
  Search,
} from "lucide-react";

interface SuperGroup {
  id: string;
  name: string;
  description: string | null;
  color: string;
  test_status: string | null;
  created_at: string;
  monitors: Array<{
    id: string;
    name: string;
    ad_library_url: string;
    latest_ads?: number;
  }>;
}

interface MonitorOption {
  id: string;
  name: string;
  ad_library_url: string;
}

function SuperGruposContent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { columns } = useKanbanColumns();
  const [isLoading, setIsLoading] = useState(true);
  const [superGroups, setSuperGroups] = useState<SuperGroup[]>([]);
  const [allMonitors, setAllMonitors] = useState<MonitorOption[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [addMonitorsOpen, setAddMonitorsOpen] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newColor, setNewColor] = useState("#8b5cf6");
  const [selectedMonitorIds, setSelectedMonitorIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [sgRes, monitorsRes] = await Promise.all([
        supabase
          .from("super_groups")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("monitors")
          .select("id, name, ad_library_url")
          .eq("user_id", user.id)
          .order("name"),
      ]);

      setAllMonitors(monitorsRes.data || []);

      if (sgRes.data) {
        // Fetch monitors for each super group
        const sgIds = sgRes.data.map((sg) => sg.id);
        const { data: sgmData } = await supabase
          .from("super_group_monitors")
          .select("super_group_id, monitor_id")
          .in("super_group_id", sgIds.length > 0 ? sgIds : ["none"]);

        // Fetch latest readings for monitors
        const monitorIds = (sgmData || []).map((m) => m.monitor_id);
        let readingsMap: Record<string, number> = {};
        if (monitorIds.length > 0) {
          const { data: readings } = await supabase
            .from("readings")
            .select("monitor_id, ads_active_count")
            .in("monitor_id", monitorIds)
            .eq("status", "ok")
            .order("timestamp", { ascending: false });
          
          (readings || []).forEach((r) => {
            if (!readingsMap[r.monitor_id]) {
              readingsMap[r.monitor_id] = r.ads_active_count;
            }
          });
        }

        const monitorsMap = Object.fromEntries(
          (monitorsRes.data || []).map((m) => [m.id, m])
        );

        const enriched: SuperGroup[] = sgRes.data.map((sg) => ({
          ...sg,
          monitors: (sgmData || [])
            .filter((sgm) => sgm.super_group_id === sg.id)
            .map((sgm) => {
              const mon = monitorsMap[sgm.monitor_id];
              return mon
                ? {
                    id: mon.id,
                    name: mon.name,
                    ad_library_url: mon.ad_library_url,
                    latest_ads: readingsMap[mon.id] || 0,
                  }
                : null;
            })
            .filter(Boolean) as any[],
        }));

        setSuperGroups(enriched);
      }
    } catch (error) {
      console.error("Error fetching super groups:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = async () => {
    if (!user || !newName.trim()) return;
    try {
      const { error } = await supabase.from("super_groups").insert({
        user_id: user.id,
        name: newName.trim(),
        description: newDescription.trim() || null,
        color: newColor,
      });
      if (error) throw error;
      toast({ title: "Super Grupo criado!" });
      setNewName("");
      setNewDescription("");
      setCreateOpen(false);
      fetchData();
    } catch (error) {
      toast({ title: "Erro ao criar", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("super_groups").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Super Grupo removido" });
      fetchData();
    } catch (error) {
      toast({ title: "Erro ao remover", variant: "destructive" });
    }
  };

  const handleAddMonitors = async (sgId: string) => {
    if (selectedMonitorIds.length === 0) return;
    try {
      const rows = selectedMonitorIds.map((mid) => ({
        super_group_id: sgId,
        monitor_id: mid,
      }));
      const { error } = await supabase.from("super_group_monitors").insert(rows);
      if (error) throw error;
      toast({ title: `${selectedMonitorIds.length} monitor(es) adicionado(s)` });
      setSelectedMonitorIds([]);
      setAddMonitorsOpen(null);
      fetchData();
    } catch (error) {
      toast({ title: "Erro ao adicionar monitores", variant: "destructive" });
    }
  };

  const handleRemoveMonitor = async (sgId: string, monitorId: string) => {
    try {
      const { error } = await supabase
        .from("super_group_monitors")
        .delete()
        .eq("super_group_id", sgId)
        .eq("monitor_id", monitorId);
      if (error) throw error;
      fetchData();
    } catch (error) {
      toast({ title: "Erro ao remover monitor", variant: "destructive" });
    }
  };

  const handleSetTestStatus = async (sgId: string, status: string | null) => {
    try {
      const { error } = await supabase
        .from("super_groups")
        .update({ test_status: status })
        .eq("id", sgId);
      if (error) throw error;
      toast({
        title: status
          ? "Super Grupo enviado para teste!"
          : "Status de teste removido",
      });
      fetchData();
    } catch (error) {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    }
  };

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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Super Grupos</h1>
            <p className="text-muted-foreground mt-1">
              Agrupe monitores de ofertas semelhantes para análise e teste de nichos
            </p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Super Grupo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Super Grupo</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Ex: Ofertas de Emagrecimento"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Descrição (opcional)</Label>
                  <Textarea
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Descreva o propósito deste super grupo..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cor</Label>
                  <div className="flex gap-2">
                    {["#8b5cf6", "#22d3ee", "#22c55e", "#f59e0b", "#ef4444", "#ec4899", "#3b82f6"].map(
                      (c) => (
                        <button
                          key={c}
                          className={`w-8 h-8 rounded-full border-2 transition-all ${
                            newColor === c ? "border-foreground scale-110" : "border-transparent"
                          }`}
                          style={{ backgroundColor: c }}
                          onClick={() => setNewColor(c)}
                        />
                      )
                    )}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreate} disabled={!newName.trim()}>
                  Criar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {superGroups.length === 0 ? (
          <div className="text-center py-12 bg-muted/30 rounded-lg">
            <Layers className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground">
              Nenhum super grupo criado
            </h3>
            <p className="text-muted-foreground mt-1 max-w-md mx-auto">
              Crie super grupos para agrupar monitores de ofertas semelhantes e
              enviá-los para teste.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {superGroups.map((sg) => {
              const totalAds = sg.monitors.reduce(
                (sum, m) => sum + (m.latest_ads || 0),
                0
              );
              const testColumn = columns.find((c) => c.id === sg.test_status);

              return (
                <Card key={sg.id} className="bg-card border-border">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: sg.color }}
                        />
                        <CardTitle className="text-lg">{sg.name}</CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        {testColumn ? (
                          <Badge
                            className="text-xs"
                            style={{
                              backgroundColor: testColumn.color + "20",
                              color: testColumn.color,
                              borderColor: testColumn.color,
                            }}
                          >
                            <FlaskConical className="h-3 w-3 mr-1" />
                            {testColumn.name}
                          </Badge>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => handleDelete(sg.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {sg.description && (
                      <p className="text-sm text-muted-foreground">
                        {sg.description}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Stats */}
                    <div className="flex gap-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-foreground">
                          {sg.monitors.length}
                        </p>
                        <p className="text-xs text-muted-foreground">monitores</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-primary">
                          {totalAds.toLocaleString("pt-BR")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          ads totais
                        </p>
                      </div>
                    </div>

                    {/* Monitor List */}
                    <div className="space-y-2">
                      {sg.monitors.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/40"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm truncate">{m.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {(m.latest_ads || 0).toLocaleString("pt-BR")} ads
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() =>
                                window.open(m.ad_library_url, "_blank")
                              }
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive"
                              onClick={() => handleRemoveMonitor(sg.id, m.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2">
                      <Dialog
                        open={addMonitorsOpen === sg.id}
                        onOpenChange={(open) =>
                          setAddMonitorsOpen(open ? sg.id : null)
                        }
                      >
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-1">
                            <Plus className="h-3 w-3" />
                            Adicionar Monitores
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>
                              Adicionar Monitores ao "{sg.name}"
                            </DialogTitle>
                          </DialogHeader>
                          <div className="space-y-3">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                placeholder="Buscar monitor..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10"
                              />
                            </div>
                            <div className="max-h-[300px] overflow-y-auto space-y-2">
                              {allMonitors
                                .filter(
                                  (m) =>
                                    !sg.monitors.some((sm) => sm.id === m.id) &&
                                    m.name
                                      .toLowerCase()
                                      .includes(searchTerm.toLowerCase())
                                )
                                .map((m) => (
                                  <label
                                    key={m.id}
                                    className="flex items-center gap-3 py-2 px-3 rounded hover:bg-muted/50 cursor-pointer"
                                  >
                                    <Checkbox
                                      checked={selectedMonitorIds.includes(m.id)}
                                      onCheckedChange={(checked) => {
                                        setSelectedMonitorIds((prev) =>
                                          checked
                                            ? [...prev, m.id]
                                            : prev.filter((id) => id !== m.id)
                                        );
                                      }}
                                    />
                                    <span className="text-sm">{m.name}</span>
                                  </label>
                                ))}
                            </div>
                          </div>
                          <DialogFooter>
                            <Button
                              onClick={() => handleAddMonitors(sg.id)}
                              disabled={selectedMonitorIds.length === 0}
                            >
                              Adicionar ({selectedMonitorIds.length})
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      <Select
                        value={sg.test_status || "none"}
                        onValueChange={(v) =>
                          handleSetTestStatus(sg.id, v === "none" ? null : v)
                        }
                      >
                        <SelectTrigger className="w-[180px] h-8 text-xs">
                          <SelectValue placeholder="Enviar para teste..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sem teste</SelectItem>
                          {columns.map((col) => (
                            <SelectItem key={col.id} value={col.id}>
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: col.color }}
                                />
                                {col.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default function SuperGrupos() {
  return (
    <ProtectedRoute>
      <SuperGruposContent />
    </ProtectedRoute>
  );
}
