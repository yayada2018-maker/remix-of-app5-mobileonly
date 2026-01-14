import * as React from "react";

export function useIsTabletLandscape() {
  const [isTabletLandscape, setIsTabletLandscape] = React.useState<boolean>(false);

  React.useEffect(() => {
    const checkTabletLandscape = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      // Tablet landscape: width between 768-1024 and landscape orientation
      const isTablet = width >= 768 && width < 1024;
      const isLandscape = width > height;
      setIsTabletLandscape(isTablet && isLandscape);
    };
    
    checkTabletLandscape();
    window.addEventListener("resize", checkTabletLandscape);
    return () => window.removeEventListener("resize", checkTabletLandscape);
  }, []);

  return isTabletLandscape;
}
