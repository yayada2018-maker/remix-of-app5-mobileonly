import { useState, useEffect, useCallback } from 'react';
import { Lock, Unlock } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ScreenLockOverlayProps {
  isLocked: boolean;
  onToggleLock: () => void;
  showControls: boolean;
}

export const ScreenLockOverlay = ({
  isLocked,
  onToggleLock,
  showControls
}: ScreenLockOverlayProps) => {
  const [showUnlockHint, setShowUnlockHint] = useState(false);

  // Show unlock hint when screen is locked and user taps
  useEffect(() => {
    if (isLocked) {
      const timer = setTimeout(() => {
        setShowUnlockHint(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isLocked, showUnlockHint]);

  const handleTap = useCallback(() => {
    if (isLocked) {
      setShowUnlockHint(true);
    }
  }, [isLocked]);

  // Only render when locked - the lock button is now in the bottom control bar
  if (!isLocked) return null;

  return (
    <>
      {/* Locked Screen Overlay */}
      {isLocked && (
        <div 
          className="absolute inset-0 z-[70]"
          onClick={handleTap}
        >
          {/* Unlock button - shows on tap or initially */}
          {showUnlockHint && (
            <div className="absolute inset-0 flex items-center justify-center animate-fade-in">
              <Button
                variant="ghost"
                size="lg"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleLock();
                }}
                className="h-14 w-14 rounded-full bg-black/60 hover:bg-black/80 text-white border-2 border-white/30"
              >
                <Unlock className="h-6 w-6" />
              </Button>
            </div>
          )}
          
          {/* Lock indicator at top right */}
          <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/60 px-3 py-1.5 rounded-full">
            <Lock className="h-4 w-4 text-white" />
            <span className="text-white text-xs font-medium">Screen Locked</span>
          </div>
        </div>
      )}
    </>
  );
};
