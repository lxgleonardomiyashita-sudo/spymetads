import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TagChip } from "@/components/ui/tag-chip";
import {
  Plus,
  Search,
  Radio,
  MoreVertical,
  Play,
  Pause,
  Trash2,
  Edit,
  Clock,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface Monitor {
  id: string;
  name: string;
  url: string;
  currentCount: number;
  lastReading: string;
  status: 'active' | 'paused' | 'error';
  schedule: string;
  tags: Array<{ name: string; type: 'nicho' | 'idioma' | 'pais' | 'custom' }>;
}

const mockMonitors: Monitor[] = [
  {
    id: '1',
    name: "ED Offers - US",
    url: "https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=US&q=ed%20supplement",
    currentCount: 15234,
    lastReading: "2024-01-05 14:32:15",
    status: 'active',
    schedule: "A cada 30 min • 08:00-22:00",
    tags: [
      { name: "ED", type: 'nicho' },
      { name: "EN-US", type: 'idioma' },
      { name: "USA", type: 'pais' },
    ],
  },
  {
    id: '2',
    name: "Diabetes - BR",
    url: "https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=BR&q=diabetes",
    currentCount: 8742,
    lastReading: "2024-01-05 14:30:00",
    status: 'active',
    schedule: "A cada 60 min • Manhã/Tarde",
    tags: [
      { name: "Diabetes", type: 'nicho' },
      { name: "PT-BR", type: 'idioma' },
    ],
  },
  {
    id: '3',
    name: "Weight Loss - DE",
    url: "https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=DE&q=abnehmen",
    currentCount: 4521,
    lastReading: "2024-01-05 14:28:45",
    status: 'paused',
    schedule: "Pausado",
    tags: [
      { name: "Emagrecimento", type: 'nicho' },
      { name: "DE", type: 'idioma' },
    ],
  },
  {
    id: '4',
    name: "Skincare - ES",
    url: "https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ES&q=skincare",
    currentCount: 0,
    lastReading: "2024-01-05 13:45:22",
    status: 'error',
    schedule: "A cada 15 min • Todos os dias",
    tags: [
      { name: "Skincare", type: 'nicho' },
      { name: "ES", type: 'idioma' },
    ],
  },
];

export default function Monitores() {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredMonitors = mockMonitors.filter(
    (monitor) =>
      monitor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      monitor.tags.some((tag) =>
        tag.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
  );

  const getStatusConfig = (status: Monitor['status']) => {
    switch (status) {
      case 'active':
        return {
          label: 'Ativo',
          dotClass: 'bg-success animate-pulse',
          textClass: 'text-success',
        };
      case 'paused':
        return {
          label: 'Pausado',
          dotClass: 'bg-muted-foreground',
          textClass: 'text-muted-foreground',
        };
      case 'error':
        return {
          label: 'Erro',
          dotClass: 'bg-destructive',
          textClass: 'text-destructive',
        };
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Monitores</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie seus monitores de anúncios
            </p>
          </div>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90 glow-hover">
            <Plus className="h-4 w-4 mr-2" />
            Novo Monitor
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou tag..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-card border-border"
          />
        </div>

        {/* Monitors List */}
        <div className="space-y-3">
          {filteredMonitors.map((monitor) => {
            const statusConfig = getStatusConfig(monitor.status);
            return (
              <div
                key={monitor.id}
                className="metric-card flex flex-col lg:flex-row lg:items-center gap-4 hover:border-primary/30 transition-colors"
              >
                {/* Left: Icon and Info */}
                <div className="flex items-start gap-4 flex-1">
                  <div
                    className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-xl flex-shrink-0",
                      monitor.status === 'active'
                        ? "bg-success/10 text-success"
                        : monitor.status === 'error'
                        ? "bg-destructive/10 text-destructive"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <Radio className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-foreground">
                        {monitor.name}
                      </h3>
                      <div className="flex items-center gap-1.5">
                        <div className={cn("w-2 h-2 rounded-full", statusConfig.dotClass)} />
                        <span className={cn("text-sm", statusConfig.textClass)}>
                          {statusConfig.label}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground truncate mt-1">
                      {monitor.url}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {monitor.tags.map((tag, idx) => (
                        <TagChip key={idx} name={tag.name} type={tag.type} size="sm" />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right: Stats and Actions */}
                <div className="flex items-center gap-6 lg:gap-8">
                  <div className="text-right">
                    <p className="text-2xl font-bold text-foreground">
                      {monitor.currentCount.toLocaleString('pt-BR')}
                    </p>
                    <p className="text-xs text-muted-foreground">anúncios ativos</p>
                  </div>
                  <div className="text-right hidden md:block">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      <span className="text-sm">{monitor.schedule}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Última: {monitor.lastReading}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem>
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      {monitor.status === 'active' ? (
                        <DropdownMenuItem>
                          <Pause className="h-4 w-4 mr-2" />
                          Pausar
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem>
                          <Play className="h-4 w-4 mr-2" />
                          Ativar
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>

        {filteredMonitors.length === 0 && (
          <div className="text-center py-12">
            <Radio className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground">
              Nenhum monitor encontrado
            </h3>
            <p className="text-muted-foreground mt-1">
              Tente ajustar sua busca ou crie um novo monitor.
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
