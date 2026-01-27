import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Clock, FastForward, SkipForward } from "lucide-react";

interface SkipTimestampFieldsProps {
  introStart?: number | null;
  introEnd?: number | null;
  outroStart?: number | null;
  onIntroStartChange: (value: number | null) => void;
  onIntroEndChange: (value: number | null) => void;
  onOutroStartChange: (value: number | null) => void;
}

/**
 * Reusable component for setting skip intro/outro timestamps
 * Used in AdminMoviesEdit and EpisodeEditDialog
 */
export const SkipTimestampFields = ({
  introStart,
  introEnd,
  outroStart,
  onIntroStartChange,
  onIntroEndChange,
  onOutroStartChange,
}: SkipTimestampFieldsProps) => {
  // Helper to convert seconds to mm:ss format for display
  const formatTimeDisplay = (seconds: number | null | undefined): string => {
    if (seconds === null || seconds === undefined) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Parse input value to seconds
  const parseTimeInput = (value: string): number | null => {
    if (!value || value.trim() === '') return null;
    
    // Handle mm:ss format
    if (value.includes(':')) {
      const parts = value.split(':');
      const mins = parseInt(parts[0], 10) || 0;
      const secs = parseInt(parts[1], 10) || 0;
      return mins * 60 + secs;
    }
    
    // Handle plain seconds
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
  };

  return (
    <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <FastForward className="h-4 w-4" />
        <span>Skip Intro/Outro Timestamps</span>
      </div>
      
      <div className="grid gap-4 md:grid-cols-3">
        {/* Intro Start */}
        <div className="space-y-2">
          <Label htmlFor="intro_start" className="flex items-center gap-1.5 text-xs">
            <Clock className="h-3 w-3" />
            Intro Start (seconds)
          </Label>
          <Input
            id="intro_start"
            type="number"
            min="0"
            step="0.5"
            value={introStart ?? 0}
            onChange={(e) => onIntroStartChange(parseTimeInput(e.target.value))}
            placeholder="0"
            className="h-9"
          />
          <p className="text-xs text-muted-foreground">
            {formatTimeDisplay(introStart ?? 0) || '0:00'}
          </p>
        </div>

        {/* Intro End */}
        <div className="space-y-2">
          <Label htmlFor="intro_end" className="flex items-center gap-1.5 text-xs">
            <SkipForward className="h-3 w-3" />
            Intro End (seconds)
          </Label>
          <Input
            id="intro_end"
            type="number"
            min="0"
            step="0.5"
            value={introEnd ?? ''}
            onChange={(e) => onIntroEndChange(parseTimeInput(e.target.value))}
            placeholder="e.g. 90"
            className="h-9"
          />
          <p className="text-xs text-muted-foreground">
            {formatTimeDisplay(introEnd) || 'Not set'}
          </p>
        </div>

        {/* Outro Start */}
        <div className="space-y-2">
          <Label htmlFor="outro_start" className="flex items-center gap-1.5 text-xs">
            <SkipForward className="h-3 w-3" />
            Outro Start (seconds)
          </Label>
          <Input
            id="outro_start"
            type="number"
            min="0"
            step="0.5"
            value={outroStart ?? ''}
            onChange={(e) => onOutroStartChange(parseTimeInput(e.target.value))}
            placeholder="e.g. 2400"
            className="h-9"
          />
          <p className="text-xs text-muted-foreground">
            {formatTimeDisplay(outroStart) || 'Not set'}
          </p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Set timestamps to show "Skip Intro" and "Skip Outro" buttons during video playback. 
        Leave empty to disable.
      </p>
    </div>
  );
};
