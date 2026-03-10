import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import type { Monitor, Tag, Group, TestStatus } from "@/types/monitor";

interface UseMonitorDataOptions {
  groupId?: string;
}

export function useMonitorData(options: UseMonitorDataOptions = {}) {
  const { groupId } = options;
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [scrapingMonitors, setScrapingMonitors] = useState<Set<string>>(new Set());

  const fetchMonitors = useCallback(async () => {
    if (!user) return;

    try {
      let query = supabase
        .from('monitors')
        .select(`
          *,
          monitor_tags (
            tag_id,
            tags (id, name, type, color)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (groupId) {
        query = query.eq('group_id', groupId);
      }

      const { data: monitorsData, error: monitorsError } = await query;

      if (monitorsError) throw monitorsError;

      const monitorIds = monitorsData?.map(m => m.id) || [];
      let readingsMap: Record<string, any> = {};
      let statsMap: Record<string, { max_ads: number; total_readings: number }> = {};

      if (monitorIds.length > 0) {
        // Fetch latest OK reading per monitor (exclude suspect/error readings)
        const { data: readingsData } = await supabase
          .from('readings')
          .select('*')
          .in('monitor_id', monitorIds)
          .in('status', ['ok'])
          .order('timestamp', { ascending: false })
          .limit(monitorIds.length * 3);

        if (readingsData) {
          readingsData.forEach((reading) => {
            if (!readingsMap[reading.monitor_id]) {
              readingsMap[reading.monitor_id] = reading;
            }
          });
        }

        // Use RPC function for accurate stats (bypasses row limits, excludes suspect)
        const { data: statsData } = await supabase
          .rpc('get_monitor_stats', { p_monitor_ids: monitorIds });

        if (statsData) {
          for (const stat of statsData) {
            statsMap[stat.monitor_id] = {
              max_ads: stat.max_ads,
              total_readings: Number(stat.total_readings),
            };
          }
        }
      }

      const transformedMonitors: Monitor[] = (monitorsData || []).map((m) => ({
        id: m.id,
        name: m.name,
        ad_library_url: m.ad_library_url,
        is_active: m.is_active,
        group_id: m.group_id,
        schedule_config: m.schedule_config as unknown as Monitor['schedule_config'],
        created_at: m.created_at,
        tags: m.monitor_tags?.map((mt: any) => mt.tags).filter(Boolean) || [],
        latest_reading: readingsMap[m.id] ? {
          ads_active_count: readingsMap[m.id].ads_active_count,
          timestamp: readingsMap[m.id].timestamp,
          status: readingsMap[m.id].status,
        } : undefined,
        stats: statsMap[m.id] || { max_ads: 0, total_readings: 0 },
        website_url: m.website_url || null,
        test_status: (m.test_status as TestStatus) || null,
        extra_ad_library_urls: m.extra_ad_library_urls || [],
        extra_website_urls: m.extra_website_urls || [],
      }));

      setMonitors(transformedMonitors);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar monitores",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, groupId, toast]);

  const fetchTags = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .eq('user_id', user.id)
      .order('name');

    if (!error && data) {
      setTags(data as Tag[]);
    }
  }, [user]);

  const fetchGroups = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('groups')
      .select('id, name, color, description')
      .eq('user_id', user.id)
      .order('name');

    if (!error && data) {
      setGroups(data as Group[]);
    }
  }, [user]);

  const toggleMonitorStatus = useCallback(async (monitorId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('monitors')
        .update({ is_active: !currentStatus })
        .eq('id', monitorId);

      if (error) throw error;

      setMonitors(prev =>
        prev.map(m =>
          m.id === monitorId ? { ...m, is_active: !currentStatus } : m
        )
      );

      toast({
        title: currentStatus ? "Monitor pausado" : "Monitor ativado",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar monitor",
        description: error.message,
        variant: "destructive",
      });
    }
  }, [toast]);

  const deleteMonitor = useCallback(async (monitorId: string) => {
    try {
      const { error } = await supabase
        .from('monitors')
        .delete()
        .eq('id', monitorId);

      if (error) throw error;

      setMonitors(prev => prev.filter(m => m.id !== monitorId));

      toast({
        title: "Monitor excluído",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao excluir monitor",
        description: error.message,
        variant: "destructive",
      });
    }
  }, [toast]);

  const scrapeMultipleMonitors = useCallback(async (monitorIds: string[]) => {
    const monitorsToScrape = monitors.filter((m) => monitorIds.includes(m.id));
    
    // Add all to scraping set
    setScrapingMonitors(prev => {
      const next = new Set(prev);
      monitorIds.forEach(id => next.add(id));
      return next;
    });

    // Process all in parallel
    await Promise.all(
      monitorsToScrape.map(async (monitor) => {
        try {
          const { data, error } = await supabase.functions.invoke('scrape-ad-library', {
            body: { monitor_id: monitor.id, url: monitor.ad_library_url },
          });

          if (error) {
            console.error(`Error scraping ${monitor.name}:`, error.message);
          }
        } catch (error: any) {
          console.error(`Error scraping ${monitor.name}:`, error.message);
        }
      })
    );

    // Remove all from scraping set
    setScrapingMonitors(prev => {
      const next = new Set(prev);
      monitorIds.forEach(id => next.delete(id));
      return next;
    });

    // Refresh data
    await fetchMonitors();
    
    toast({
      title: "Atualização concluída",
      description: `${monitorsToScrape.length} monitores atualizados`,
    });
  }, [monitors, toast, fetchMonitors]);

  const scrapeMonitor = useCallback(async (monitorId: string, url: string, name: string) => {
    // Capture previous value before scraping
    const previousMonitor = monitors.find(m => m.id === monitorId);
    const previousCount = previousMonitor?.latest_reading?.ads_active_count ?? null;

    setScrapingMonitors(prev => new Set(prev).add(monitorId));

    try {
      const { data, error } = await supabase.functions.invoke('scrape-ad-library', {
        body: { monitor_id: monitorId, url },
      });

      if (error) throw error;

      if (data.success) {
        const newCount = data.ads_count;
        const variation = previousCount !== null ? newCount - previousCount : null;
        const variationPercent = previousCount !== null && previousCount > 0 
          ? ((variation! / previousCount) * 100).toFixed(1)
          : null;

        // Build comparison message
        let comparisonMessage = `${newCount.toLocaleString('pt-BR')} anúncios ativos`;
        
        if (variation !== null && variation !== 0) {
          const arrow = variation > 0 ? '↑' : '↓';
          const sign = variation > 0 ? '+' : '';
          comparisonMessage = `${previousCount?.toLocaleString('pt-BR')} → ${newCount.toLocaleString('pt-BR')} (${sign}${variation} ${arrow} ${variationPercent}%)`;
        } else if (variation === 0) {
          comparisonMessage = `${newCount.toLocaleString('pt-BR')} anúncios (sem alteração)`;
        }

        toast({
          title: variation !== null && variation !== 0 
            ? (variation > 0 ? "📈 Aumento detectado!" : "📉 Redução detectada!")
            : "✅ Coleta realizada!",
          description: `${name}: ${comparisonMessage}`,
          variant: variation !== null && Math.abs(variation) > (previousCount || 1) * 0.2 
            ? "default" 
            : "default",
        });
        
        await fetchMonitors();
      } else {
        toast({
          title: "Coleta com problemas",
          description: data.error || "Não foi possível extrair o número de anúncios",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro na coleta",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setScrapingMonitors(prev => {
        const next = new Set(prev);
        next.delete(monitorId);
        return next;
      });
    }
  }, [toast, fetchMonitors, monitors]);

  const removeTagFromMonitor = useCallback(async (monitorId: string, tagId: string) => {
    try {
      const { error } = await supabase
        .from('monitor_tags')
        .delete()
        .eq('monitor_id', monitorId)
        .eq('tag_id', tagId);

      if (error) throw error;

      setMonitors(prev =>
        prev.map(m =>
          m.id === monitorId
            ? { ...m, tags: m.tags.filter(t => t.id !== tagId) }
            : m
        )
      );

      toast({ title: "Tag removida" });
    } catch (error: any) {
      toast({
        title: "Erro ao remover tag",
        description: error.message,
        variant: "destructive",
      });
    }
  }, [toast]);

  useEffect(() => {
    if (user) {
      fetchMonitors();
      fetchTags();
      fetchGroups();
    }
  }, [user, fetchMonitors, fetchTags, fetchGroups]);

  return {
    monitors,
    tags,
    groups,
    isLoading,
    scrapingMonitors,
    fetchMonitors,
    fetchTags,
    fetchGroups,
    toggleMonitorStatus,
    deleteMonitor,
    scrapeMonitor,
    scrapeMultipleMonitors,
    removeTagFromMonitor,
  };
}
