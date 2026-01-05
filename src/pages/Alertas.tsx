import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { TagChip } from "@/components/ui/tag-chip";
import {
  Plus,
  Bell,
  BellOff,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  MoreVertical,
  Edit,
  Trash2,
  Mail,
  Webhook,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface Alert {
  id: string;
  name: string;
  type: 'threshold_above' | 'threshold_below' | 'percentage_change' | 'failures';
  target: {
    type: 'monitor' | 'tag';
    name: string;
    tagType?: 'nicho' | 'idioma' | 'pais' | 'custom';
  };
  condition: string;
  enabled: boolean;
  lastTriggered?: string;
  channels: ('email' | 'webhook')[];
}

const mockAlerts: Alert[] = [
  {
    id: '1',
    name: 'ED acima de 20k',
    type: 'threshold_above',
    target: { type: 'tag', name: 'ED', tagType: 'nicho' },
    condition: '> 20.000 anúncios',
    enabled: true,
    lastTriggered: '2024-01-05 10:32',
    channels: ['email', 'webhook'],
  },
  {
    id: '2',
    name: 'Queda brusca EN-US',
    type: 'percentage_change',
    target: { type: 'tag', name: 'EN-US', tagType: 'idioma' },
    condition: 'Variação > -15% em 1h',
    enabled: true,
    channels: ['email'],
  },
  {
    id: '3',
    name: 'Diabetes abaixo do limite',
    type: 'threshold_below',
    target: { type: 'monitor', name: 'Diabetes - BR' },
    condition: '< 5.000 anúncios',
    enabled: false,
    channels: ['email'],
  },
  {
    id: '4',
    name: 'Falhas consecutivas',
    type: 'failures',
    target: { type: 'monitor', name: 'Skincare - ES' },
    condition: '3+ falhas seguidas',
    enabled: true,
    lastTriggered: '2024-01-05 14:15',
    channels: ['email', 'webhook'],
  },
];

const typeIcons = {
  threshold_above: TrendingUp,
  threshold_below: TrendingDown,
  percentage_change: AlertTriangle,
  failures: AlertTriangle,
};

const typeColors = {
  threshold_above: 'text-success bg-success/10',
  threshold_below: 'text-warning bg-warning/10',
  percentage_change: 'text-info bg-info/10',
  failures: 'text-destructive bg-destructive/10',
};

export default function Alertas() {
  const [alerts, setAlerts] = useState(mockAlerts);

  const toggleAlert = (id: string) => {
    setAlerts((prev) =>
      prev.map((alert) =>
        alert.id === id ? { ...alert, enabled: !alert.enabled } : alert
      )
    );
  };

  const activeCount = alerts.filter((a) => a.enabled).length;

  return (
    <AppLayout>
      <div className="space-y-6 fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Alertas</h1>
            <p className="text-muted-foreground mt-1">
              Configure notificações para seus monitores
            </p>
          </div>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90 glow-hover">
            <Plus className="h-4 w-4 mr-2" />
            Novo Alerta
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="metric-card">
            <p className="text-sm text-muted-foreground">Total de Alertas</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {alerts.length}
            </p>
          </div>
          <div className="metric-card">
            <p className="text-sm text-muted-foreground">Alertas Ativos</p>
            <p className="text-2xl font-bold text-success mt-1">{activeCount}</p>
          </div>
          <div className="metric-card">
            <p className="text-sm text-muted-foreground">Disparados Hoje</p>
            <p className="text-2xl font-bold text-foreground mt-1">2</p>
          </div>
          <div className="metric-card">
            <p className="text-sm text-muted-foreground">Por Tag</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {alerts.filter((a) => a.target.type === 'tag').length}
            </p>
          </div>
        </div>

        {/* Alerts List */}
        <div className="space-y-3">
          {alerts.map((alert) => {
            const Icon = typeIcons[alert.type];
            return (
              <div
                key={alert.id}
                className={cn(
                  "metric-card flex flex-col lg:flex-row lg:items-center gap-4 transition-colors",
                  !alert.enabled && "opacity-60"
                )}
              >
                {/* Left: Icon and Info */}
                <div className="flex items-start gap-4 flex-1">
                  <div
                    className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-xl flex-shrink-0",
                      typeColors[alert.type]
                    )}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="text-lg font-semibold text-foreground">
                        {alert.name}
                      </h3>
                      {alert.target.type === 'tag' && alert.target.tagType && (
                        <TagChip
                          name={alert.target.name}
                          type={alert.target.tagType}
                          size="sm"
                        />
                      )}
                      {alert.target.type === 'monitor' && (
                        <span className="text-sm text-muted-foreground">
                          Monitor: {alert.target.name}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Condição: {alert.condition}
                    </p>
                    {alert.lastTriggered && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Último disparo: {alert.lastTriggered}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: Channels and Actions */}
                <div className="flex items-center gap-4 lg:gap-6">
                  <div className="flex items-center gap-2">
                    {alert.channels.includes('email') && (
                      <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-muted text-muted-foreground">
                        <Mail className="h-4 w-4" />
                      </div>
                    )}
                    {alert.channels.includes('webhook') && (
                      <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-muted text-muted-foreground">
                        <Webhook className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={alert.enabled}
                      onCheckedChange={() => toggleAlert(alert.id)}
                    />
                    <span className="text-sm text-muted-foreground w-16">
                      {alert.enabled ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
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
              </div>
            );
          })}
        </div>

        {alerts.length === 0 && (
          <div className="text-center py-12">
            <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground">
              Nenhum alerta configurado
            </h3>
            <p className="text-muted-foreground mt-1">
              Crie alertas para ser notificado sobre mudanças importantes.
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
