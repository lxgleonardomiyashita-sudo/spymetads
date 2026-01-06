import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LabelList,
} from "recharts";

interface GroupDistribution {
  name: string;
  value: number;
  color: string;
}

interface TagDistribution {
  name: string;
  value: number;
  type: string;
}

interface DistributionChartsProps {
  groupDistribution: GroupDistribution[];
  tagDistribution: TagDistribution[];
}

const TAG_COLORS: Record<string, string> = {
  idioma: "#22d3ee",
  nicho: "#a855f7",
  pais: "#22c55e",
  tipo: "#f59e0b",
  custom: "#3b82f6",
};

export function DistributionCharts({ groupDistribution, tagDistribution }: DistributionChartsProps) {
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-2 shadow-lg">
          <p className="text-sm font-medium text-foreground">{payload[0].name}</p>
          <p className="text-sm text-muted-foreground">
            {payload[0].value.toLocaleString("pt-BR")} ads
          </p>
        </div>
      );
    }
    return null;
  };

  const sortedTags = [...tagDistribution].sort((a, b) => b.value - a.value).slice(0, 10);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">Distribuição de Anúncios</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart - Group Distribution */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Por Grupo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {groupDistribution.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum dado disponível
              </p>
            ) : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={groupDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      nameKey="name"
                    >
                      {groupDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            {groupDistribution.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-3 justify-center">
                {groupDistribution.map((g, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: g.color }} />
                    <span className="text-xs text-muted-foreground">{g.name}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bar Chart - Tag Distribution */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Por Tag (Top 10)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sortedTags.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum dado disponível
              </p>
            ) : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sortedTags} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={11}
                      width={100}
                      tickFormatter={(value) => value.length > 12 ? `${value.slice(0, 12)}...` : value}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {sortedTags.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={TAG_COLORS[entry.type] || TAG_COLORS.custom} 
                        />
                      ))}
                      <LabelList 
                        dataKey="value" 
                        position="right" 
                        fill="hsl(var(--foreground))"
                        fontSize={11}
                        formatter={(value: number) => value.toLocaleString("pt-BR")}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {sortedTags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-3 justify-center">
                {Array.from(new Set(sortedTags.map(t => t.type))).map((type) => (
                  <div key={type} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: TAG_COLORS[type] || TAG_COLORS.custom }} />
                    <span className="text-xs text-muted-foreground capitalize">{type}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
