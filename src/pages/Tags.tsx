import { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TagChip } from "@/components/ui/tag-chip";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { TAG_TYPE_CONFIG, TAG_TYPES, PRESET_TAG_COLORS, getTagColor } from "@/lib/tag-constants";
import type { TagType } from "@/types/monitor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, 
  Search, 
  Hash, 
  MoreVertical, 
  Edit, 
  Trash2, 
  Loader2,
  X,
  ExternalLink,
  BarChart3,
  Activity,
  TrendingUp,
  TrendingDown,
  ChevronRight
} from "lucide-react";
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
import { MonitorInsightsDialog } from "@/components/monitors/MonitorInsightsDialog";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Cell,
} from "recharts";

interface Tag {
  id: string;
  name: string;
  type: string;
  color?: string | null;
  monitorsCount: number;
}

interface Monitor {
  id: string;
  name: string;
  ad_library_url: string;
  is_active: boolean;
  group?: {
    id: string;
    name: string;
    color: string;
  };
  tags: Array<{
    id: string;
    name: string;
    type: string;
  }>;
  latestReading?: {
    ads_active_count: number;
    timestamp: string;
  };
}

const typeLabels: Record<string, string> = {
  nicho: 'Nicho',
  idioma: 'Idioma',
  pais: 'País',
  modelo_funil: 'Modelo de Funil',
  faixa_preco: 'Faixa de Preço',
  custom: 'Personalizado',
};

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

function TagsContent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagType, setNewTagType] = useState<TagType>('nicho');
  const [newTagColor, setNewTagColor] = useState<string>(TAG_TYPE_CONFIG.nicho.defaultColor);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<TagType>('nicho');
  const [editColor, setEditColor] = useState<string>('#a855f7');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Selection state
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [readings, setReadings] = useState<any[]>([]);
  const [isLoadingMonitors, setIsLoadingMonitors] = useState(false);
  const [selectedMonitorForInsights, setSelectedMonitorForInsights] = useState<{
    id: string;
    name: string;
    ad_library_url: string;
    is_active: boolean;
  } | null>(null);

  const fetchTags = async () => {
    if (!user) return;

    try {
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
        type: t.type,
        color: t.color || null,
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

  const fetchMonitorsForTags = async (tagIds: string[]) => {
    if (!user || tagIds.length === 0) {
      setMonitors([]);
      setReadings([]);
      return;
    }

    setIsLoadingMonitors(true);

    try {
      // Fetch monitors that have ALL selected tags
      const { data: monitorTagsData, error: mtError } = await supabase
        .from('monitor_tags')
        .select('monitor_id, tag_id')
        .in('tag_id', tagIds);

      if (mtError) throw mtError;

      // Group by monitor_id and count how many of the selected tags each monitor has
      const monitorTagCounts: Record<string, number> = {};
      (monitorTagsData || []).forEach(mt => {
        monitorTagCounts[mt.monitor_id] = (monitorTagCounts[mt.monitor_id] || 0) + 1;
      });

      // Get monitors that have all selected tags
      const matchingMonitorIds = Object.entries(monitorTagCounts)
        .filter(([_, count]) => count === tagIds.length)
        .map(([id]) => id);

      if (matchingMonitorIds.length === 0) {
        setMonitors([]);
        setReadings([]);
        setIsLoadingMonitors(false);
        return;
      }

      // Fetch full monitor data
      const { data: monitorsData, error: monError } = await supabase
        .from('monitors')
        .select(`
          *,
          group:groups(*),
          monitor_tags(tag:tags(*))
        `)
        .in('id', matchingMonitorIds)
        .eq('user_id', user.id)
        .order('name');

      if (monError) throw monError;

      // Fetch latest readings
      const { data: readingsData, error: readError } = await supabase
        .from('readings')
        .select('*')
        .in('monitor_id', matchingMonitorIds)
        .gte('timestamp', subDays(new Date(), 30).toISOString())
        .order('timestamp', { ascending: true });

      if (readError) throw readError;

      // Get latest reading per monitor
      const latestByMonitor: Record<string, any> = {};
      (readingsData || []).forEach(r => {
        if (!latestByMonitor[r.monitor_id] || 
            new Date(r.timestamp) > new Date(latestByMonitor[r.monitor_id].timestamp)) {
          latestByMonitor[r.monitor_id] = r;
        }
      });

      const transformedMonitors: Monitor[] = (monitorsData || []).map(m => ({
        id: m.id,
        name: m.name,
        ad_library_url: m.ad_library_url,
        is_active: m.is_active,
        group: m.group || undefined,
        tags: m.monitor_tags?.map((mt: any) => mt.tag).filter(Boolean) || [],
        latestReading: latestByMonitor[m.id] ? {
          ads_active_count: latestByMonitor[m.id].ads_active_count,
          timestamp: latestByMonitor[m.id].timestamp,
        } : undefined,
      }));

      setMonitors(transformedMonitors);
      setReadings(readingsData || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar monitores",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoadingMonitors(false);
    }
  };

  useEffect(() => {
    fetchTags();
  }, [user]);

  useEffect(() => {
    fetchMonitorsForTags(selectedTagIds);
  }, [selectedTagIds, user]);

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
          color: newTagColor,
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
      setSelectedTagIds(prev => prev.filter(id => id !== tagId));
      toast({ title: "Tag excluída" });
    } catch (error: any) {
      toast({
        title: "Erro ao excluir tag",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEditTag = async () => {
    if (!editingTag || !editName.trim()) return;

    try {
      const { error } = await supabase
        .from('tags')
        .update({
          name: editName.trim(),
          type: editType,
          color: editColor,
        })
        .eq('id', editingTag.id);

      if (error) throw error;

      toast({ title: "Tag atualizada!" });
      setEditDialogOpen(false);
      setEditingTag(null);
      fetchTags();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar tag",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const toggleTagSelection = (tagId: string) => {
    setSelectedTagIds(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const clearSelection = () => {
    setSelectedTagIds([]);
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

  const selectedTags = tags.filter(t => selectedTagIds.includes(t.id));

  // Analytics for selected monitors
  const analytics = useMemo(() => {
    if (monitors.length === 0) return null;

    const totalAds = monitors.reduce((sum, m) => sum + (m.latestReading?.ads_active_count || 0), 0);
    const avgAds = totalAds / monitors.length;

    // Calculate activity by day
    const activityByDay: Record<string, number> = {};
    readings.forEach(r => {
      const day = format(new Date(r.timestamp), "yyyy-MM-dd");
      activityByDay[day] = (activityByDay[day] || 0) + r.ads_active_count;
    });

    const chartData = Object.entries(activityByDay)
      .map(([date, value]) => ({
        date: format(new Date(date), "dd/MM", { locale: ptBR }),
        value: Math.round(value / monitors.length),
      }))
      .slice(-14);

    // Top performers
    const topPerformers = [...monitors]
      .sort((a, b) => (b.latestReading?.ads_active_count || 0) - (a.latestReading?.ads_active_count || 0))
      .slice(0, 5);

    // Get readings from 7 days ago for growth calculation
    const sevenDaysAgo = subDays(new Date(), 7);
    const previousByMonitor: Record<string, number> = {};
    readings
      .filter(r => new Date(r.timestamp) <= sevenDaysAgo)
      .forEach(r => {
        previousByMonitor[r.monitor_id] = r.ads_active_count;
      });
    const previousTotal = Object.values(previousByMonitor).reduce((sum, v) => sum + v, 0);
    const growthRate = previousTotal > 0 ? ((totalAds - previousTotal) / previousTotal) * 100 : 0;

    return {
      totalAds,
      avgAds: Math.round(avgAds),
      growthRate: growthRate.toFixed(1),
      chartData,
      topPerformers,
      totalMonitors: monitors.length,
    };
  }, [monitors, readings]);

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
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Hash className="h-6 w-6 text-primary" />
              Tags
            </h1>
            <p className="text-muted-foreground mt-1">
              Organize e analise monitores por tags
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-lg px-4 py-2">
              {tags.length} tags
            </Badge>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90 glow-hover"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Nova Tag
            </Button>
          </div>
        </div>

        {/* Selected Tags Bar */}
        {selectedTagIds.length > 0 && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground">Tags selecionadas:</span>
                  {selectedTags.map(tag => (
                    <Badge 
                      key={tag.id} 
                      variant="secondary"
                      className="flex items-center gap-1 cursor-pointer hover:bg-destructive/20"
                      onClick={() => toggleTagSelection(tag.id)}
                    >
                      <TagChip type={tag.type as TagType} name={tag.name} color={tag.color} size="sm" />
                      <X className="h-3 w-3" />
                    </Badge>
                  ))}
                </div>
                <Button variant="ghost" size="sm" onClick={clearSelection}>
                  Limpar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="tags" className="space-y-4">
          <TabsList>
            <TabsTrigger value="tags">Todas as Tags</TabsTrigger>
            <TabsTrigger value="monitors" disabled={selectedTagIds.length === 0}>
              Monitores {monitors.length > 0 && `(${monitors.length})`}
            </TabsTrigger>
            <TabsTrigger value="analytics" disabled={selectedTagIds.length === 0}>
              Análises
            </TabsTrigger>
          </TabsList>

          {/* Tags Tab */}
          <TabsContent value="tags" className="space-y-6">
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
                  {TAG_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{TAG_TYPE_CONFIG[t].label}</SelectItem>
                  ))}
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
                  {typeTags.map((tag) => {
                    const isSelected = selectedTagIds.includes(tag.id);
                    return (
                      <div
                        key={tag.id}
                        onClick={() => toggleTagSelection(tag.id)}
                        className={`metric-card flex items-center justify-between transition-all cursor-pointer group ${
                          isSelected 
                            ? 'border-primary bg-primary/10 ring-2 ring-primary/30' 
                            : 'hover:border-primary/30'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <TagChip name={tag.name} type={tag.type as TagType} color={tag.color} />
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">
                              {tag.monitorsCount} monitores
                            </span>
                            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingTag(tag);
                                setEditName(tag.name);
                                setEditType(tag.type as TagType);
                                setEditColor(tag.color || getTagColor(tag.type as TagType));
                                setEditDialogOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteTag(tag.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    );
                  })}
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
          </TabsContent>

          {/* Monitors Tab */}
          <TabsContent value="monitors" className="space-y-4">
            {isLoadingMonitors ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : monitors.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="py-12 text-center">
                  <Hash className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">
                    Nenhum monitor encontrado com {selectedTagIds.length > 1 ? 'todas as tags selecionadas' : 'essa tag'}.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {monitors.map((monitor) => (
                  <Card key={monitor.id} className="bg-card border-border hover:border-primary/50 transition-colors">
                    <CardContent className="p-4 space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-foreground truncate">{monitor.name}</h3>
                          {monitor.group && (
                            <Badge 
                              variant="outline" 
                              className="mt-1 text-xs"
                              style={{ 
                                borderColor: monitor.group.color || undefined,
                                color: monitor.group.color || undefined
                              }}
                            >
                              {monitor.group.name}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setSelectedMonitorForInsights({
                              id: monitor.id,
                              name: monitor.name,
                              ad_library_url: monitor.ad_library_url,
                              is_active: monitor.is_active,
                            })}
                          >
                            <BarChart3 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => window.open(monitor.ad_library_url, "_blank")}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="flex items-center justify-between">
                        <div className="text-2xl font-bold text-primary">
                          {monitor.latestReading?.ads_active_count?.toLocaleString("pt-BR") || "—"}
                        </div>
                        <Badge variant={monitor.is_active ? "default" : "secondary"}>
                          {monitor.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>

                      {/* Tags */}
                      {monitor.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {monitor.tags.slice(0, 3).map((tag) => (
                            <TagChip key={tag.id} type={tag.type as any} name={tag.name} size="sm" />
                          ))}
                          {monitor.tags.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{monitor.tags.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            {analytics ? (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="bg-card border-border">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <Activity className="h-4 w-4" />
                        Total de Ads
                      </div>
                      <div className="text-2xl font-bold text-foreground mt-1">
                        {analytics.totalAds.toLocaleString("pt-BR")}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-card border-border">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <BarChart3 className="h-4 w-4" />
                        Média por Monitor
                      </div>
                      <div className="text-2xl font-bold text-foreground mt-1">
                        {analytics.avgAds.toLocaleString("pt-BR")}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-card border-border">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        {parseFloat(analytics.growthRate) >= 0 ? (
                          <TrendingUp className="h-4 w-4 text-green-500" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-500" />
                        )}
                        Crescimento 7d
                      </div>
                      <div className={`text-2xl font-bold mt-1 ${
                        parseFloat(analytics.growthRate) >= 0 ? 'text-green-500' : 'text-red-500'
                      }`}>
                        {parseFloat(analytics.growthRate) >= 0 ? '+' : ''}{analytics.growthRate}%
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-card border-border">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <Hash className="h-4 w-4" />
                        Monitores
                      </div>
                      <div className="text-2xl font-bold text-foreground mt-1">
                        {analytics.totalMonitors}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Activity Chart */}
                {analytics.chartData.length > 0 && (
                  <Card className="bg-card border-border">
                    <CardContent className="p-4">
                      <h3 className="text-lg font-semibold text-foreground mb-4">
                        Atividade (Últimos 14 dias)
                      </h3>
                      <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={analytics.chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis 
                              dataKey="date" 
                              stroke="hsl(var(--muted-foreground))"
                              fontSize={12}
                            />
                            <YAxis 
                              stroke="hsl(var(--muted-foreground))"
                              fontSize={12}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "8px",
                              }}
                              labelStyle={{ color: "hsl(var(--foreground))" }}
                            />
                            <Line
                              type="monotone"
                              dataKey="value"
                              stroke="hsl(var(--primary))"
                              strokeWidth={2}
                              dot={{ fill: "hsl(var(--primary))", r: 4 }}
                              name="Média de Ads"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Top Performers */}
                <Card className="bg-card border-border">
                  <CardContent className="p-4">
                    <h3 className="text-lg font-semibold text-foreground mb-4">
                      Top Performers
                    </h3>
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analytics.topPerformers} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis 
                            type="number" 
                            stroke="hsl(var(--muted-foreground))"
                            fontSize={12}
                          />
                          <YAxis 
                            type="category" 
                            dataKey="name" 
                            stroke="hsl(var(--muted-foreground))"
                            fontSize={12}
                            width={120}
                            tickFormatter={(value) => value.length > 15 ? value.slice(0, 15) + '...' : value}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                            }}
                            formatter={(value: number) => [value.toLocaleString("pt-BR"), "Ads Ativos"]}
                          />
                          <Bar 
                            dataKey="latestReading.ads_active_count" 
                            name="Ads Ativos"
                            radius={[0, 4, 4, 0]}
                          >
                            {analytics.topPerformers.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="bg-card border-border">
                <CardContent className="py-12 text-center">
                  <Activity className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">
                    Selecione uma ou mais tags para ver as análises.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

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
                <Select value={newTagType} onValueChange={(v: TagType) => {
                  setNewTagType(v);
                  setNewTagColor(TAG_TYPE_CONFIG[v].defaultColor);
                }}>
                  <SelectTrigger className="bg-muted border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TAG_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{TAG_TYPE_CONFIG[t].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Cor</Label>
                <div className="flex items-center gap-2 flex-wrap">
                  {PRESET_TAG_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewTagColor(c)}
                      className={`w-6 h-6 rounded-full transition-all border-2 ${
                        newTagColor === c ? 'border-foreground scale-125' : 'border-transparent hover:scale-110'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              {newTagName && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Preview:</span>
                  <TagChip name={newTagName} type={newTagType} color={newTagColor} />
                </div>
              )}
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

        {/* Edit Tag Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground">Editar Tag</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label className="text-foreground">Nome</Label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="bg-muted border-border"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Tipo</Label>
                <Select value={editType} onValueChange={(v: TagType) => {
                  setEditType(v);
                }}>
                  <SelectTrigger className="bg-muted border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TAG_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{TAG_TYPE_CONFIG[t].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Cor</Label>
                <div className="flex items-center gap-2 flex-wrap">
                  {PRESET_TAG_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditColor(c)}
                      className={`w-6 h-6 rounded-full transition-all border-2 ${
                        editColor === c ? 'border-foreground scale-125' : 'border-transparent hover:scale-110'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Preview:</span>
                <TagChip name={editName || 'exemplo'} type={editType} color={editColor} />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleEditTag}
                  disabled={!editName.trim()}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Salvar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Monitor Insights Dialog */}
        <MonitorInsightsDialog
          open={!!selectedMonitorForInsights}
          onOpenChange={(open) => !open && setSelectedMonitorForInsights(null)}
          monitor={selectedMonitorForInsights}
        />
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
