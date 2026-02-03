import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Globe, Check, X, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface WebsiteUrlInputProps {
  monitorId: string;
  currentUrl: string | null;
  onUrlChange?: () => void;
  compact?: boolean;
}

export function WebsiteUrlInput({
  monitorId,
  currentUrl,
  onUrlChange,
  compact = false,
}: WebsiteUrlInputProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [url, setUrl] = useState(currentUrl || "");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const cleanUrl = url.trim() || null;
      
      const { error } = await supabase
        .from('monitors')
        .update({ website_url: cleanUrl })
        .eq('id', monitorId);
      
      if (error) throw error;
      
      toast({
        title: "URL atualizada",
        description: cleanUrl ? "Link do site salvo com sucesso" : "Link do site removido",
      });
      
      setIsEditing(false);
      onUrlChange?.();
    } catch (error) {
      console.error('Error updating website URL:', error);
      toast({
        title: "Erro ao atualizar URL",
        description: "Tente novamente",
        variant: "destructive",
      });
    }
    setIsLoading(false);
  };

  const handleCancel = () => {
    setUrl(currentUrl || "");
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <div className="flex items-center gap-1">
        {currentUrl ? (
          <a
            href={currentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex items-center gap-1 text-primary hover:underline",
              compact ? "text-[10px]" : "text-xs"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <Globe className={cn(compact ? "h-2.5 w-2.5" : "h-3 w-3")} />
            <span className="truncate max-w-[100px]">
              {currentUrl.replace('https://', '').replace('www.', '').substring(0, 20)}...
            </span>
          </a>
        ) : (
          <span className={cn("text-muted-foreground", compact ? "text-[10px]" : "text-xs")}>
            Sem site
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          className={cn(compact ? "h-5 w-5" : "h-6 w-6")}
          onClick={(e) => {
            e.stopPropagation();
            setIsEditing(true);
          }}
          title="Editar URL do site"
        >
          <Pencil className={cn(compact ? "h-2.5 w-2.5" : "h-3 w-3")} />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <Input
        type="url"
        placeholder="https://exemplo.com"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        className={cn("flex-1", compact ? "h-6 text-[10px] px-2" : "h-7 text-xs")}
        autoFocus
      />
      <Button
        variant="ghost"
        size="icon"
        className={cn(compact ? "h-5 w-5" : "h-6 w-6")}
        onClick={handleSave}
        disabled={isLoading}
      >
        <Check className={cn("text-success", compact ? "h-2.5 w-2.5" : "h-3 w-3")} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className={cn(compact ? "h-5 w-5" : "h-6 w-6")}
        onClick={handleCancel}
        disabled={isLoading}
      >
        <X className={cn("text-destructive", compact ? "h-2.5 w-2.5" : "h-3 w-3")} />
      </Button>
    </div>
  );
}
