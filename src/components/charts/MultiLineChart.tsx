import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface DataSeries {
  id: string;
  name: string;
  color: string;
  data: { time: string; value: number }[];
}

interface MultiLineChartProps {
  series: DataSeries[];
  title?: string;
}

// 10 distinct colors for chart lines
const CHART_COLORS = [
  "hsl(190, 95%, 55%)",  // cyan
  "hsl(142, 76%, 46%)",  // green
  "hsl(262, 83%, 63%)",  // purple
  "hsl(38, 92%, 55%)",   // orange
  "hsl(0, 72%, 55%)",    // red
  "hsl(199, 89%, 55%)",  // blue
  "hsl(330, 80%, 60%)",  // pink
  "hsl(60, 70%, 50%)",   // yellow
  "hsl(280, 65%, 55%)",  // violet
  "hsl(170, 70%, 45%)",  // teal
];

export function getChartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg max-w-xs">
        <p className="text-sm font-medium text-foreground mb-2">{label}</p>
        <div className="space-y-1">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground truncate max-w-[120px]">
                {entry.name}:
              </span>
              <span className="font-bold" style={{ color: entry.color }}>
                {entry.value?.toLocaleString('pt-BR')}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export function MultiLineChart({ series, title }: MultiLineChartProps) {
  // Merge all data points into a unified dataset
  const mergedData = (() => {
    const timeMap: Record<string, Record<string, number>> = {};
    
    series.forEach((s) => {
      s.data.forEach((point) => {
        if (!timeMap[point.time]) {
          timeMap[point.time] = {};
        }
        timeMap[point.time][s.id] = point.value;
      });
    });

    return Object.entries(timeMap)
      .map(([time, values]) => ({
        time,
        ...values,
      }))
      .sort((a, b) => a.time.localeCompare(b.time));
  })();

  if (series.length === 0 || mergedData.length === 0) {
    return (
      <div className="metric-card flex items-center justify-center h-[220px]">
        <p className="text-muted-foreground">
          Selecione grupos ou tags para visualizar o comparativo
        </p>
      </div>
    );
  }

  return (
    <div className="metric-card h-full">
      {title && (
        <h3 className="text-lg font-semibold text-foreground mb-4">{title}</h3>
      )}
      <div className="chart-container h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={mergedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(220, 20%, 18%)"
              vertical={false}
            />
            <XAxis
              dataKey="time"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'hsl(215, 20%, 55%)', fontSize: 11 }}
              dy={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'hsl(215, 20%, 55%)', fontSize: 11 }}
              tickFormatter={(value) => value.toLocaleString('pt-BR')}
              dx={-10}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ paddingTop: '20px' }}
              formatter={(value) => (
                <span className="text-xs text-muted-foreground">{value}</span>
              )}
            />
            {series.map((s, index) => (
              <Line
                key={s.id}
                type="monotone"
                dataKey={s.id}
                name={s.name}
                stroke={s.color || getChartColor(index)}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
