import type { Notification } from '@/hooks/use-notification';
import { cn } from '@/lib/utils';
import { Popover, PopoverAnchor, PopoverContent } from './popover';

export type NotificationPopoverProps = React.PropsWithChildren<{
  notification: Notification;
  message: React.ReactNode;
  icon?: React.ReactNode;
}>;

export const NotificationPopover: React.FC<NotificationPopoverProps> = ({
  children,
  notification,
  message,
  icon,
}) => {
  return (
    <Popover open={notification.show}>
      <PopoverAnchor>{children}</PopoverAnchor>
      <PopoverContent
        className={cn(
          'bg-background/60 w-fit rounded-md border-none p-0 shadow-none',
          'transition-opacity duration-500 ease-out',
          notification.transparent && 'opacity-0',
        )}
      >
        <div className='bg-primary/10 text-primary inline-flex w-full items-center gap-2 rounded-md border px-4 py-2 text-sm shadow-md outline-hidden'>
          {icon}
          {message}
        </div>
      </PopoverContent>
    </Popover>
  );
};
