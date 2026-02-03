export interface Tag {
  id: string;
  name: string;
  type: 'nicho' | 'idioma' | 'pais' | 'custom';
}

export interface Group {
  id: string;
  name: string;
  description?: string | null;
  color: string;
}

export interface MonitorReading {
  ads_active_count: number;
  timestamp: string;
  status: string;
}

export interface ScheduleConfig {
  interval: number;
  days: string[];
  windows: string[];
}

export interface MonitorStats {
  max_ads: number;
  total_readings: number;
}

export type TestStatus = 'backup_para_teste' | 'fazendo_ads' | 'configuracao' | 'pronto' | 'em_teste' | 'validado' | 'nova_leva' | 'descartado' | null;

export interface Monitor {
  id: string;
  name: string;
  ad_library_url: string;
  is_active: boolean;
  group_id: string | null;
  group_name?: string;
  schedule_config: ScheduleConfig;
  created_at: string;
  tags: Tag[];
  latest_reading?: MonitorReading;
  stats?: MonitorStats;
  website_url?: string | null;
  test_status?: TestStatus;
}

export interface SavedMonitor {
  id: string;
  monitor_id: string;
  user_id: string;
  priority: string | null;
  notes: string | null;
  created_at: string;
  monitor?: Monitor & {
    group?: Group | null;
    monitor_tags?: { tag: Tag }[];
  };
}
