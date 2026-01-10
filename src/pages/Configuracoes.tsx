import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Save, User, Bell, Clock, Shield } from "lucide-react";

export default function Configuracoes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    timezone: "America/Sao_Paulo",
  });
  const [notifications, setNotifications] = useState({
    emailAlerts: true,
    dailyDigest: false,
    significantChanges: true,
  });

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (data) {
      setProfile({
        name: data.name || "",
        email: data.email || user.email || "",
        timezone: data.timezone || "America/Sao_Paulo",
      });
    } else {
      setProfile(prev => ({
        ...prev,
        email: user.email || "",
      }));
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          user_id: user.id,
          name: profile.name,
          email: profile.email,
          timezone: profile.timezone,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      if (error) throw error;

      toast({
        title: "Configurações salvas",
        description: "Suas preferências foram atualizadas com sucesso.",
      });
    } catch (error) {
      console.error('Error saving profile:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar suas configurações.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const timezones = [
    { value: "America/Sao_Paulo", label: "São Paulo (GMT-3)" },
    { value: "America/Fortaleza", label: "Fortaleza (GMT-3)" },
    { value: "America/Manaus", label: "Manaus (GMT-4)" },
    { value: "America/Rio_Branco", label: "Rio Branco (GMT-5)" },
    { value: "America/New_York", label: "New York (GMT-5)" },
    { value: "America/Los_Angeles", label: "Los Angeles (GMT-8)" },
    { value: "Europe/London", label: "Londres (GMT+0)" },
    { value: "Europe/Lisbon", label: "Lisboa (GMT+0)" },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground">
            Gerencie suas preferências e configurações da conta
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Perfil */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Perfil
              </CardTitle>
              <CardDescription>
                Informações básicas da sua conta
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  placeholder="Seu nome"
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={profile.email}
                  disabled
                  className="opacity-70"
                />
                <p className="text-xs text-muted-foreground">
                  O email não pode ser alterado
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Fuso Horário */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Fuso Horário
              </CardTitle>
              <CardDescription>
                Configure o fuso horário para seus monitores
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="timezone">Fuso Horário Padrão</Label>
                <Select
                  value={profile.timezone}
                  onValueChange={(value) => setProfile({ ...profile, timezone: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o fuso horário" />
                  </SelectTrigger>
                  <SelectContent>
                    {timezones.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Este fuso será usado para exibir horários e agendar coletas
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Notificações */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                Notificações
              </CardTitle>
              <CardDescription>
                Configure como deseja receber alertas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Alertas por Email</Label>
                  <p className="text-xs text-muted-foreground">
                    Receba alertas importantes por email
                  </p>
                </div>
                <Switch
                  checked={notifications.emailAlerts}
                  onCheckedChange={(checked) => 
                    setNotifications({ ...notifications, emailAlerts: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Resumo Diário</Label>
                  <p className="text-xs text-muted-foreground">
                    Receba um resumo diário das atividades
                  </p>
                </div>
                <Switch
                  checked={notifications.dailyDigest}
                  onCheckedChange={(checked) => 
                    setNotifications({ ...notifications, dailyDigest: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Mudanças Significativas</Label>
                  <p className="text-xs text-muted-foreground">
                    Alertas quando houver variações grandes nos anúncios
                  </p>
                </div>
                <Switch
                  checked={notifications.significantChanges}
                  onCheckedChange={(checked) => 
                    setNotifications({ ...notifications, significantChanges: checked })
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Segurança */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Segurança
              </CardTitle>
              <CardDescription>
                Configurações de segurança da conta
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Sessão Atual</Label>
                <p className="text-sm text-muted-foreground">
                  Conectado como: {user?.email}
                </p>
              </div>
              <Button variant="outline" className="w-full" disabled>
                Alterar Senha (em breve)
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSaveProfile} disabled={loading}>
            <Save className="h-4 w-4 mr-2" />
            {loading ? "Salvando..." : "Salvar Configurações"}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
