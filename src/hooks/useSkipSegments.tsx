import { useState, useEffect, useCallback, useMemo } from 'react';

interface SkipSegment {
  type: 'intro' | 'outro';
  startTime: number;
  endTime: number;
  label: string;
}

interface UseSkipSegmentsProps {
  currentTime: number;
  duration: number;
  introStart?: number;
  introEnd?: number;
  outroStart?: number;
  onSkip: (targetTime: number) => void;
  isVisible?: boolean; // External visibility control (e.g., controls shown)
}

interface UseSkipSegmentsReturn {
  activeSegment: SkipSegment | null;
  handleSkip: () => void;
  shouldShowButton: boolean;
}

/**
 * Hook to manage skip intro/outro button visibility and behavior
 * Used by both VideoPlayer (web) and NativeVideoPlayer (mobile)
 */
export const useSkipSegments = ({
  currentTime,
  duration,
  introStart = 0,
  introEnd,
  outroStart,
  onSkip,
  isVisible = true,
}: UseSkipSegmentsProps): UseSkipSegmentsReturn => {
  const [activeSegment, setActiveSegment] = useState<SkipSegment | null>(null);

  // Define available segments
  const segments = useMemo<SkipSegment[]>(() => {
    const segs: SkipSegment[] = [];

    // Intro segment: from introStart to introEnd
    if (introEnd && introEnd > 0 && introEnd > introStart) {
      segs.push({
        type: 'intro',
        startTime: introStart,
        endTime: introEnd,
        label: 'Skip Intro',
      });
    }

    // Outro segment: from outroStart to end of video
    if (outroStart && outroStart > 0 && duration > 0 && outroStart < duration) {
      segs.push({
        type: 'outro',
        startTime: outroStart,
        endTime: duration,
        label: 'Skip Outro',
      });
    }

    return segs;
  }, [introStart, introEnd, outroStart, duration]);

  // Determine which segment is currently active based on playback time
  useEffect(() => {
    if (!isVisible) {
      setActiveSegment(null);
      return;
    }

    // Check each segment to see if currentTime falls within it
    for (const segment of segments) {
      const isWithinSegment = 
        currentTime >= segment.startTime && 
        currentTime < segment.endTime - 0.5; // Buffer to hide before segment ends

      if (isWithinSegment) {
        setActiveSegment(segment);
        return;
      }
    }

    // No active segment
    setActiveSegment(null);
  }, [currentTime, segments, isVisible]);

  // Skip to the end of the active segment
  const handleSkip = useCallback(() => {
    if (!activeSegment) return;
    
    console.log(`[useSkipSegments] Skipping ${activeSegment.type} to`, activeSegment.endTime);
    onSkip(activeSegment.endTime);
  }, [activeSegment, onSkip]);

  return {
    activeSegment,
    handleSkip,
    shouldShowButton: activeSegment !== null && isVisible,
  };
};
