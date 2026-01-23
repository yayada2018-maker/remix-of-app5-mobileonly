-- Drop existing policies for app_ad_settings
DROP POLICY IF EXISTS "Admins can manage app ad settings" ON public.app_ad_settings;
DROP POLICY IF EXISTS "Anyone can view app ad settings" ON public.app_ad_settings;

-- Create proper RLS policies for app_ad_settings with WITH CHECK
CREATE POLICY "Anyone can view app ad settings" 
ON public.app_ad_settings 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can insert app ad settings" 
ON public.app_ad_settings 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('admin', 'moderator')
  )
);

CREATE POLICY "Admins can update app ad settings" 
ON public.app_ad_settings 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('admin', 'moderator')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('admin', 'moderator')
  )
);

CREATE POLICY "Admins can delete app ad settings" 
ON public.app_ad_settings 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('admin', 'moderator')
  )
);

-- Drop existing policies for app_ads
DROP POLICY IF EXISTS "Admins can manage app ads" ON public.app_ads;
DROP POLICY IF EXISTS "Anyone can view active app ads" ON public.app_ads;

-- Create proper RLS policies for app_ads with WITH CHECK
CREATE POLICY "Anyone can view active app ads" 
ON public.app_ads 
FOR SELECT 
USING (is_active = true);

CREATE POLICY "Admins can view all app ads" 
ON public.app_ads 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('admin', 'moderator')
  )
);

CREATE POLICY "Admins can insert app ads" 
ON public.app_ads 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('admin', 'moderator')
  )
);

CREATE POLICY "Admins can update app ads" 
ON public.app_ads 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('admin', 'moderator')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('admin', 'moderator')
  )
);

CREATE POLICY "Admins can delete app ads" 
ON public.app_ads 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('admin', 'moderator')
  )
);