'use client';

import { IMAGE_FORMATS, type ImageFormat } from '@/lib/client/image-tools';
import { cn } from '@/lib/utils';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// #region Main Component
// =============================================================================

export const FormatSelect: React.FC<{
  children?: React.ReactNode;
  format: ImageFormat | undefined;
  setFormat: (format: ImageFormat) => void;
  className?: string;
  disabled?: boolean;
}> = ({ children, format, setFormat, className, disabled }) => {
  return (
    <Select value={format} onValueChange={(f: ImageFormat) => setFormat(f)}>
      <SelectTrigger
        className={cn('h-10 w-24 cursor-pointer font-mono text-xs', className)}
        disabled={disabled}
      >
        {children ?? <SelectValue placeholder='Format' />}
      </SelectTrigger>
      <SelectContent>
        {IMAGE_FORMATS.map((fmt) => (
          <SelectItem key={fmt} value={fmt} className='font-mono text-xs'>
            {fmt.toUpperCase()}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

// #endregion
