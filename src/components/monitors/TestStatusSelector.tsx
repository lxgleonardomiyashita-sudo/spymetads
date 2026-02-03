import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type TestStatus = 'backup_para_teste' | 'fazendo_ads' | 'configuracao' | 'pronto' | 'em_teste' | 'validado' | 'nova_leva' | 'descartado' | null;

interface TestStatusOption {
  value: TestStatus;
  label: string;
  color: string;
}

const STATUS_OPTIONS: TestStatusOption[] = [
  { value: null, label: 'Sem status', color: 'hsl(var(--muted-foreground))' },
  { value: 'backup_para_teste', label: 'Backup Para Teste', color: 'hsl(var(--muted))' },
  { value: 'fazendo_ads', label: 'Fazendo Ads', color: 'hsl(217, 91%, 60%)' },
  { value: 'configuracao', label: 'Configuração', color: 'hsl(45, 93%, 47%)' },
  { value: 'pronto', label: 'Pronto', color: 'hsl(280, 87%, 65%)' },
  { value: 'em_teste', label: 'Em Teste', color: 'hsl(25, 95%, 53%)' },
  { value: 'validado', label: 'Validado', color: 'hsl(142, 71%, 45%)' },
  { value: 'nova_leva', label: 'Nova Leva', color: 'hsl(199, 89%, 48%)' },
  { value: 'descartado', label: 'Descartado', color: 'hsl(0, 84%, 60%)' },
];

interface TestStatusSelectorProps {
  monitorId: string;
  currentStatus: TestStatus;
  onStatusChange?: () => void;
  compact?: boolean;
}

export function TestStatusSelector({
  monitorId,
  currentStatus,
  onStatusChange,
  compact = false,
}: TestStatusSelectorProps) {
  const { toast } = useToast();

  const handleStatusChange = async (value: string) => {
    const newStatus = value === 'null' ? null : value as TestStatus;
    
    try {
      const { error } = await supabase
        .from('monitors')
        .update({ test_status: newStatus })
        .eq('id', monitorId);
      
      if (error) throw error;
      
      const statusLabel = STATUS_OPTIONS.find(s => s.value === newStatus)?.label || 'Sem status';
      
      toast({
        title: "Status atualizado",
        description: `Status alterado para: ${statusLabel}`,
      });
      
      onStatusChange?.();
    } catch (error) {
      console.error('Error updating test status:', error);
      toast({
        title: "Erro ao atualizar status",
        description: "Tente novamente",
        variant: "destructive",
      });
    }
  };

  const currentOption = STATUS_OPTIONS.find(s => s.value === currentStatus) || STATUS_OPTIONS[0];

  return (
    <Select
      value={currentStatus || 'null'}
      onValueChange={handleStatusChange}
    >
      <SelectTrigger 
        className={cn(
          "border-dashed",
          compact ? "h-7 text-xs px-2" : "h-8"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1.5">
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: currentOption.color }}
          />
          <SelectValue placeholder="Status">
            {compact ? (currentOption.value ? currentOption.label.substring(0, 10) + '...' : 'Status') : currentOption.label}
          </SelectValue>
        </div>
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPTIONS.map((option) => (
          <SelectItem
            key={option.value || 'null'}
            value={option.value || 'null'}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: option.color }}
              />
              {option.label}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
