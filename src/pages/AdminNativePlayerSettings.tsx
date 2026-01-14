import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Smartphone, Lock, ListVideo, Heart, Server, Monitor, Shield, Save } from 'lucide-react';
import { useNativePlayerSettings } from '@/hooks/useNativePlayerSettings';
import { toast } from 'sonner';

export default function AdminNativePlayerSettings() {
  const { settings, loading, updateSettings } = useNativePlayerSettings();
  const [localSettings, setLocalSettings] = useState(settings);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleToggle = (key: keyof typeof localSettings, value: boolean) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleNumberChange = (key: keyof typeof localSettings, value: string) => {
    const numValue = parseInt(value) || 0;
    setLocalSettings(prev => ({ ...prev, [key]: numValue }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSettings(localSettings);
      toast.success('Native player settings saved successfully');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Smartphone className="h-8 w-8 text-primary" />
              Native Player Settings
            </h1>
            <p className="text-muted-foreground mt-1">
              Control features for the native mobile app video player (iOS/Android)
            </p>
          </div>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Control Features */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5 text-primary" />
                Player Controls
              </CardTitle>
              <CardDescription>
                Enable or disable player control features
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label>Screen Lock Button</Label>
                    <p className="text-xs text-muted-foreground">
                      Allow users to lock screen controls
                    </p>
                  </div>
                </div>
                <Switch
                  checked={localSettings.showScreenLock}
                  onCheckedChange={(checked) => handleToggle('showScreenLock', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ListVideo className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label>Episodes Panel</Label>
                    <p className="text-xs text-muted-foreground">
                      Show episodes panel button for series
                    </p>
                  </div>
                </div>
                <Switch
                  checked={localSettings.showEpisodesPanel}
                  onCheckedChange={(checked) => handleToggle('showEpisodesPanel', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ListVideo className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label>Version Filter</Label>
                    <p className="text-xs text-muted-foreground">
                      Show version filter in episodes panel (e.g., Dubbed, Subbed)
                    </p>
                  </div>
                </div>
                <Switch
                  checked={localSettings.showVersionFilter}
                  onCheckedChange={(checked) => handleToggle('showVersionFilter', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Server className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label>Server Selector</Label>
                    <p className="text-xs text-muted-foreground">
                      Allow users to switch between video servers
                    </p>
                  </div>
                </div>
                <Switch
                  checked={localSettings.showServerSelector}
                  onCheckedChange={(checked) => handleToggle('showServerSelector', checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Monetization */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-pink-500" />
                Monetization & Overlays
              </CardTitle>
              <CardDescription>
                Control overlay features for engagement and monetization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Heart className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label>Support Us Overlay</Label>
                    <p className="text-xs text-muted-foreground">
                      Show support/donation overlay during playback
                    </p>
                  </div>
                </div>
                <Switch
                  checked={localSettings.showSupportUsOverlay}
                  onCheckedChange={(checked) => handleToggle('showSupportUsOverlay', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Monitor className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label>Picture-in-Picture</Label>
                    <p className="text-xs text-muted-foreground">
                      Enable PiP mode for video playback
                    </p>
                  </div>
                </div>
                <Switch
                  checked={localSettings.enablePictureInPicture}
                  onCheckedChange={(checked) => handleToggle('enablePictureInPicture', checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Security */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-green-500" />
                Security & Protection
              </CardTitle>
              <CardDescription>
                Screen recording and screenshot protection
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label>Screen Recording Protection</Label>
                    <p className="text-xs text-muted-foreground">
                      Prevent screen recording and screenshots (Android: FLAG_SECURE)
                    </p>
                  </div>
                </div>
                <Switch
                  checked={localSettings.enableScreenProtection}
                  onCheckedChange={(checked) => handleToggle('enableScreenProtection', checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Timing Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5 text-blue-500" />
                Timing & Behavior
              </CardTitle>
              <CardDescription>
                Control auto-hide and timing settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Auto-hide Controls (ms)</Label>
                <Input
                  type="number"
                  value={localSettings.autoHideControlsMs}
                  onChange={(e) => handleNumberChange('autoHideControlsMs', e.target.value)}
                  min={1000}
                  max={10000}
                  step={500}
                />
                <p className="text-xs text-muted-foreground">
                  Time in milliseconds before controls auto-hide (1000-10000ms)
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
