import type { ReactNode } from 'react';
import { Dialog as RDialog, DropdownMenu as RMenu, Tooltip as RTooltip } from 'radix-ui';
import { Info, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" />
        <RDialog.Content
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto rounded-t-2xl border bg-card p-5 shadow-xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[min(640px,calc(100vw-32px))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl',
            className,
          )}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <RDialog.Title className="text-base font-semibold">{title}</RDialog.Title>
              {description ? (
                <RDialog.Description className="mt-0.5 text-sm text-muted-foreground">{description}</RDialog.Description>
              ) : (
                <RDialog.Description className="sr-only">{title}</RDialog.Description>
              )}
            </div>
            <RDialog.Close className="-m-1 rounded-md p-1 text-muted-foreground hover:bg-muted" aria-label={t('common.close')}>
              <X className="size-4" />
            </RDialog.Close>
          </div>
          {children}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}

export function TooltipProvider({ children }: { children: ReactNode }) {
  return <RTooltip.Provider delayDuration={200}>{children}</RTooltip.Provider>;
}

export function Tooltip({ content, children }: { content: ReactNode; children: ReactNode }) {
  return (
    <RTooltip.Root>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content
          sideOffset={6}
          className="z-50 max-w-72 rounded-lg bg-foreground px-3 py-2 text-xs leading-relaxed text-background shadow-lg"
        >
          {content}
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
  );
}

/** Small ⓘ that explains a metric. */
export function InfoTip({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <Tooltip content={children}>
      <button
        type="button"
        className="inline-flex cursor-help rounded-full text-muted-foreground/70 hover:text-foreground"
        aria-label={label ?? 'Info'}
      >
        <Info className="size-3.5" />
      </button>
    </Tooltip>
  );
}

export const Menu = {
  Root: RMenu.Root,
  Trigger: RMenu.Trigger,
  Content({ children, align = 'end' }: { children: ReactNode; align?: 'start' | 'end' }) {
    return (
      <RMenu.Portal>
        <RMenu.Content
          align={align}
          sideOffset={6}
          className="z-50 min-w-48 rounded-xl border bg-card p-1 text-sm shadow-lg"
        >
          {children}
        </RMenu.Content>
      </RMenu.Portal>
    );
  },
  Item({ children, onSelect, className }: { children: ReactNode; onSelect?: () => void; className?: string }) {
    return (
      <RMenu.Item
        onSelect={onSelect}
        className={cn(
          'flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 outline-none data-[highlighted]:bg-muted [&_svg]:size-4 [&_svg]:text-muted-foreground',
          className,
        )}
      >
        {children}
      </RMenu.Item>
    );
  },
  Separator() {
    return <RMenu.Separator className="my-1 h-px bg-border" />;
  },
};
