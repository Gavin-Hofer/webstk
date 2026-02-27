'use client';

import { IMAGE_FORMATS } from '@/lib/client/image-tools';
import { cn } from '@/lib/utils';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type ExtraOption = { value: string; label: string };

type FormatSelectProps = {
  children?: React.ReactNode;
  format: string | undefined;
  setFormat: (format: string) => void;
  className?: string;
  disabled?: boolean;
  extraOptions?: ExtraOption[];
  'data-testid'?: string;
};

export const FormatSelect: React.FC<FormatSelectProps> = ({
  children,
  format,
  setFormat,
  className,
  disabled,
  extraOptions,
  'data-testid': testId,
}) => {
  return (
    <Select value={format} onValueChange={setFormat}>
      <SelectTrigger
        className={cn('h-10 w-24 cursor-pointer font-mono text-xs', className)}
        disabled={disabled}
        data-testid={testId}
      >
        {children ?? <SelectValue placeholder='Format' />}
      </SelectTrigger>
      <SelectContent>
        {extraOptions?.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} className='text-xs'>
            {opt.label}
          </SelectItem>
        ))}
        {extraOptions && extraOptions.length > 0 && <SelectSeparator />}
        {IMAGE_FORMATS.map((fmt) => (
          <SelectItem key={fmt} value={fmt} className='font-mono text-xs'>
            {fmt.toUpperCase()}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
