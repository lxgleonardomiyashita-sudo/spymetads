import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface SparklineChartProps {
  data: number[];
  className?: string;
  color?: 'success' | 'destructive' | 'primary' | 'muted';
  height?: number;
}

export function SparklineChart({ 
  data, 
  className,
  color = 'primary',
  height = 24
}: SparklineChartProps) {
  const path = useMemo(() => {
    if (data.length < 2) return '';
    
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    
    const width = 100;
    const stepX = width / (data.length - 1);
    
    const points = data.map((value, index) => {
      const x = index * stepX;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    });
    
    return `M ${points.join(' L ')}`;
  }, [data, height]);

  const getStrokeColor = () => {
    switch (color) {
      case 'success': return 'hsl(var(--success))';
      case 'destructive': return 'hsl(var(--destructive))';
      case 'muted': return 'hsl(var(--muted-foreground))';
      default: return 'hsl(var(--primary))';
    }
  };

  if (data.length < 2) {
    return (
      <div 
        className={cn("flex items-center justify-center text-muted-foreground text-xs", className)}
        style={{ height }}
      >
        —
      </div>
    );
  }

  return (
    <svg 
      viewBox={`0 0 100 ${height}`} 
      className={cn("w-full", className)}
      style={{ height }}
      preserveAspectRatio="none"
    >
      <path
        d={path}
        fill="none"
        stroke={getStrokeColor()}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
