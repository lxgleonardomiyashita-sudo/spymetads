import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Reading {
  id: string;
  monitorName: string;
  timestamp: string;
  adsCount: number;
  method: 'api' | 'public_parse';
  status: 'ok' | 'falha';
}

interface RecentReadingsTableProps {
  readings: Reading[];
}

export function RecentReadingsTable({ readings }: RecentReadingsTableProps) {
  return (
    <div className="metric-card overflow-hidden p-0">
      <div className="px-6 py-4 border-b border-border">
        <h3 className="text-lg font-semibold text-foreground">Leituras Recentes</h3>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border">
              <TableHead className="text-muted-foreground">Monitor</TableHead>
              <TableHead className="text-muted-foreground">Horário</TableHead>
              <TableHead className="text-muted-foreground text-right">Anúncios</TableHead>
              <TableHead className="text-muted-foreground">Método</TableHead>
              <TableHead className="text-muted-foreground">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {readings.map((reading) => (
              <TableRow key={reading.id} className="border-border hover:bg-muted/50">
                <TableCell className="font-medium text-foreground">
                  {reading.monitorName}
                </TableCell>
                <TableCell className="text-muted-foreground font-mono text-sm">
                  {reading.timestamp}
                </TableCell>
                <TableCell className="text-right font-semibold text-foreground">
                  {reading.adsCount.toLocaleString('pt-BR')}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {reading.method === 'api' ? 'API' : 'Parse'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full",
                        reading.status === 'ok' ? "bg-success" : "bg-destructive"
                      )}
                    />
                    <span
                      className={cn(
                        "text-sm",
                        reading.status === 'ok' ? "text-success" : "text-destructive"
                      )}
                    >
                      {reading.status === 'ok' ? 'OK' : 'Falha'}
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
