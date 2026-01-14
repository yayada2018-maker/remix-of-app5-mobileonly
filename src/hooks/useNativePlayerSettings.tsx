import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface NativePlayerSettings {
  showScreenLock: boolean;
  showEpisodesPanel: boolean;
  showVersionFilter: boolean;
  showSupportUsOverlay: boolean;
  showServerSelector: boolean;
  enablePictureInPicture: boolean;
  enableScreenProtection: boolean;
  autoHideControlsMs: number;
}

const defaultSettings: NativePlayerSettings = {
  showScreenLock: true,
  showEpisodesPanel: true,
  showVersionFilter: true,
  showSupportUsOverlay: true,
  showServerSelector: true,
  enablePictureInPicture: true,
  enableScreenProtection: true,
  autoHideControlsMs: 3000,
};

export const useNativePlayerSettings = () => {
  const [settings, setSettings] = useState<NativePlayerSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('site_settings')
          .select('setting_key, setting_value')
          .eq('setting_key', 'native_player_settings')
          .maybeSingle();

        if (error && error.code !== 'PGRST116') throw error;

        if (data?.setting_value) {
          const savedSettings = data.setting_value as Record<string, any>;
          setSettings({
            ...defaultSettings,
            ...savedSettings,
          });
        }
      } catch (error) {
        console.error('Error fetching native player settings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const updateSettings = async (newSettings: Partial<NativePlayerSettings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);

    try {
      const { error } = await supabase
        .from('site_settings')
        .upsert({
          setting_key: 'native_player_settings',
          setting_value: updatedSettings,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'setting_key'
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error updating native player settings:', error);
    }
  };

  return { settings, loading, updateSettings };
};
