import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ActiveAdsLineChart } from "@/components/charts/ActiveAdsLineChart";
import { MonthlyCalendarView } from "@/components/charts/MonthlyCalendarView";
import { Button } from "@/components/ui/button";
import { TagChip } from "@/components/ui/tag-chip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Clock, Download, Filter } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

// Mock data
const hourlyData = [
  { time: '05:00', value: 12100 },
  { time: '06:00', value: 12350 },
  { time: '07:00', value: 12800 },
  { time: '08:00', value: 13500 },
  { time: '09:00', value: 14200 },
  { time: '10:00', value: 14800 },
  { time: '11:00', value: 15100 },
  { time: '12:00', value: 15400 },
  { time: '13:00', value: 15200 },
  { time: '14:00', value: 15600 },
  { time: '15:00', value: 15800 },
  { time: '16:00', value: 16100 },
  { time: '17:00', value: 15900 },
  { time: '18:00', value: 15500 },
  { time: '19:00', value: 15200 },
  { time: '20:00', value: 14800 },
  { time: '21:00', value: 14400 },
  { time: '22:00', value: 14100 },
  { time: '23:00', value: 13800 },
];

const nicheData = [
  { name: 'ED', value: 15234, color: 'hsl(262, 83%, 63%)' },
  { name: 'Diabetes', value: 8742, color: 'hsl(142, 76%, 46%)' },
  { name: 'Emagrecimento', value: 6521, color: 'hsl(190, 95%, 55%)' },
  { name: 'Skincare', value: 4200, color: 'hsl(38, 92%, 55%)' },
  { name: 'Outros', value: 2800, color: 'hsl(215, 20%, 55%)' },
];

const languageData = [
  { name: 'EN-US', value: 18500 },
  { name: 'PT-BR', value: 8742 },
  { name: 'DE', value: 4521 },
  { name: 'ES', value: 3200 },
  { name: 'FR', value: 2534 },
];

const calendarData = Array.from({ length: 31 }, (_, i) => ({
  day: i + 1,
  morning: Math.floor(Math.random() * 5000) + 10000,
  afternoon: Math.floor(Math.random() * 6000) + 12000,
  evening: Math.floor(Math.random() * 4000) + 11000,
}));

const selectedTags = [
  { name: 'ED', type: 'nicho' as const },
  { name: 'EN-US', type: 'idioma' as const },
];

const CustomBarTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-sm text-primary font-bold">
          {payload[0].value.toLocaleString('pt-BR')} anúncios
        </p>
      </div>
    );
  }
  return null;
};

export default function Analises() {
  const [viewMode, setViewMode] = useState<'hourly' | 'monthly'>('hourly');

  return (
    <AppLayout>
      <div className="space-y-6 fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Análises</h1>
            <p className="text-muted-foreground mt-1">
              Visualize tendências e dados históricos
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Filtros
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
          </div>
        </div>

        {/* Active Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-muted-foreground">Filtros ativos:</span>
          {selectedTags.map((tag, idx) => (
            <TagChip
              key={idx}
              name={tag.name}
              type={tag.type}
              removable
              onRemove={() => {}}
            />
          ))}
        </div>

        {/* View Mode Selector */}
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'hourly' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('hourly')}
            className={viewMode === 'hourly' ? 'bg-primary text-primary-foreground' : ''}
          >
            <Clock className="h-4 w-4 mr-2" />
            Visão Horária
          </Button>
          <Button
            variant={viewMode === 'monthly' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('monthly')}
            className={viewMode === 'monthly' ? 'bg-primary text-primary-foreground' : ''}
          >
            <Calendar className="h-4 w-4 mr-2" />
            Visão Mensal
          </Button>
        </div>

        {/* Main Chart Area */}
        {viewMode === 'hourly' ? (
          <div className="grid gap-6">
            <ActiveAdsLineChart data={hourlyData} title="Anúncios Ativos por Hora - Hoje" />
          </div>
        ) : (
          <MonthlyCalendarView year={2024} month={0} data={calendarData} />
        )}

        {/* Analytics by Tags */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* By Niche */}
          <div className="metric-card">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Anúncios por Nicho
            </h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={nicheData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {nicheData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg">
                            <p className="text-sm font-medium text-foreground">
                              {payload[0].name}
                            </p>
                            <p className="text-sm text-primary font-bold">
                              {(payload[0].value as number).toLocaleString('pt-BR')} anúncios
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-3 mt-4">
              {nicheData.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm text-muted-foreground">{item.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* By Language */}
          <div className="metric-card">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Anúncios por Idioma
            </h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={languageData}
                  layout="vertical"
                  margin={{ top: 0, right: 20, left: 50, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(220, 20%, 18%)"
                    horizontal={true}
                    vertical={false}
                  />
                  <XAxis
                    type="number"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(215, 20%, 55%)', fontSize: 12 }}
                    tickFormatter={(value) => value.toLocaleString('pt-BR')}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(215, 20%, 55%)', fontSize: 12 }}
                  />
                  <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'hsl(220, 20%, 14%)' }} />
                  <Bar
                    dataKey="value"
                    fill="hsl(190, 95%, 55%)"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
