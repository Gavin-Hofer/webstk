'use client';

import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

type QualitySliderProps = {
  quality: number;
  setQuality: (quality: number) => void;
  className?: string;
  disabled?: boolean;
};

/**
 * A popover slider for selecting image quality from 0 to 100.
 */
export const QualitySlider: React.FC<QualitySliderProps> = ({
  quality,
  setQuality,
  className,
  disabled,
}) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          className={cn(
            'h-10 w-16 cursor-pointer font-mono text-xs',
            className,
          )}
          disabled={disabled}
        >
          {quality}%
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-48' align='end'>
        <div className='flex flex-col gap-3'>
          <div className='flex items-center justify-between'>
            <span className='text-muted-foreground text-xs'>Quality</span>
            <span className='font-mono text-sm font-medium'>{quality}%</span>
          </div>
          <Slider
            value={[quality]}
            onValueChange={([value]) => setQuality(value)}
            min={0}
            max={100}
            step={1}
            className='w-full'
          />
          <div className='text-muted-foreground flex justify-between text-xs'>
            <span>0</span>
            <span>100</span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
