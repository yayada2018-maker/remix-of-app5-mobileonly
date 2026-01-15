import * as React from "react";

export function useIsIPad() {
  const [isIPad, setIsIPad] = React.useState<boolean>(false);
  const [isIPadPortrait, setIsIPadPortrait] = React.useState<boolean>(false);
  const [isIPadLandscape, setIsIPadLandscape] = React.useState<boolean>(false);

  React.useEffect(() => {
    const checkIPad = () => {
      const ua = navigator.userAgent;
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      // Detect iPad: either explicit iPad in UA or Mac with touch support (modern iPads)
      const isIPadUA = /iPad/i.test(ua);
      const isMacWithTouch = /Macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
      const isIPadDevice = isIPadUA || isMacWithTouch;
      
      // Also consider tablet-sized touch devices as iPad-like behavior
      // iPad dimensions typically: 768x1024, 834x1112, 820x1180, 1024x1366, etc.
      const isTabletSize = (width >= 768 && width <= 1366) || (height >= 768 && height <= 1366);
      const hasTouch = navigator.maxTouchPoints > 0;
      const isTabletLike = isTabletSize && hasTouch && !(/iPhone|Android.*Mobile/i.test(ua));
      
      const detectedIPad = isIPadDevice || isTabletLike;
      const isLandscape = width > height;
      
      setIsIPad(detectedIPad);
      setIsIPadPortrait(detectedIPad && !isLandscape);
      setIsIPadLandscape(detectedIPad && isLandscape);
    };
    
    checkIPad();
    window.addEventListener("resize", checkIPad);
    window.addEventListener("orientationchange", checkIPad);
    
    return () => {
      window.removeEventListener("resize", checkIPad);
      window.removeEventListener("orientationchange", checkIPad);
    };
  }, []);

  return { isIPad, isIPadPortrait, isIPadLandscape };
}
