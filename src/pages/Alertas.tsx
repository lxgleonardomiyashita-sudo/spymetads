import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Bell } from "lucide-react";

function AlertasContent() {
  return (
    <AppLayout>
      <div className="space-y-6 fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Alertas</h1>
          <p className="text-muted-foreground mt-1">
            Configure notificações para seus monitores
          </p>
        </div>
        <div className="metric-card text-center py-12">
          <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground">
            Em breve
          </h3>
          <p className="text-muted-foreground mt-1">
            Sistema de alertas estará disponível em breve.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}

export default function Alertas() {
  return (
    <ProtectedRoute>
      <AlertasContent />
    </ProtectedRoute>
  );
}
