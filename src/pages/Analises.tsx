import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

function AnalisisContent() {
  return (
    <AppLayout>
      <div className="space-y-6 fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Análises</h1>
          <p className="text-muted-foreground mt-1">
            Visualize tendências e dados históricos
          </p>
        </div>
        <div className="metric-card text-center py-12">
          <p className="text-muted-foreground">
            As análises estarão disponíveis após a coleta de dados dos seus monitores.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}

export default function Analises() {
  return (
    <ProtectedRoute>
      <AnalisisContent />
    </ProtectedRoute>
  );
}
