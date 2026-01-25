-- Update global settings: disable test mode and add android_app_id
UPDATE app_ad_settings 
SET setting_value = jsonb_set(
  jsonb_set(setting_value::jsonb, '{test_mode}', 'false'),
  '{android_app_id}', '"ca-app-pub-4789683198372521~7914037351"'
)
WHERE setting_key = 'global_settings';

-- Add Interstitial ad (Episode Switch)
INSERT INTO app_ads (name, ad_type, ad_unit_id, platform, placement, is_active, is_test_mode, priority)
VALUES ('Episode Interstitial', 'interstitial', 'ca-app-pub-4789683198372521/6896751572', 'android', 'episode_interstitial', true, false, 1)
ON CONFLICT DO NOTHING;

-- Add Rewarded ad (Unlock Content)
INSERT INTO app_ads (name, ad_type, ad_unit_id, platform, placement, is_active, is_test_mode, priority, reward_amount, reward_type)
VALUES ('Reward Unlock Content', 'rewarded', 'ca-app-pub-4789683198372521/5112896617', 'android', 'reward_unlock', true, false, 1, 1, 'unlock')
ON CONFLICT DO NOTHING;