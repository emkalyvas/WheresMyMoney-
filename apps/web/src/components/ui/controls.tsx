import { type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, forwardRef, useId } from 'react';
import { Switch as RSwitch, Slider as RSlider } from 'radix-ui';
import { cn } from '@/lib/utils';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'h-9 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-sm shadow-xs placeholder:text-muted-foreground/70 disabled:opacity-60 aria-invalid:border-negative',
      className,
    )}
    {...props}
  />
));
Input.displayName = 'Input';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn('h-9 w-full rounded-lg border border-input bg-card px-2.5 text-sm shadow-xs disabled:opacity-60', className)}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = 'Select';

export function Label({ htmlFor, children, className }: { htmlFor?: string; children: ReactNode; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={cn('text-sm font-medium', className)}>
      {children}
    </label>
  );
}

/** Label + control + hint + error, laid out consistently. */
export function Field({
  label,
  hint,
  error,
  children,
  id,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  children: (id: string) => ReactNode;
  id?: string;
  className?: string;
}) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <div className={cn('grid gap-1.5', className)}>
      <Label htmlFor={fieldId}>{label}</Label>
      {children(fieldId)}
      {error ? (
        <p className="text-xs text-negative" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function Switch({
  checked,
  onCheckedChange,
  id,
  disabled,
  label,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  id?: string;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <RSwitch.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={label}
      className="peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-input transition-colors data-[state=checked]:bg-primary disabled:cursor-not-allowed disabled:opacity-50"
    >
      <RSwitch.Thumb className="block size-4 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-4" />
    </RSwitch.Root>
  );
}

/** A switch with its label and hint, as one row. */
export function SwitchRow({
  label,
  hint,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: ReactNode;
  hint?: ReactNode;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <Label htmlFor={id}>{label}</Label>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  );
}

export function Slider({
  value,
  onValueChange,
  min,
  max,
  step,
  label,
}: {
  value: number;
  onValueChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  label: string;
}) {
  return (
    <RSlider.Root
      value={[value]}
      onValueChange={(v) => onValueChange(v[0])}
      min={min}
      max={max}
      step={step}
      className="relative flex h-5 w-full touch-none select-none items-center"
    >
      <RSlider.Track className="relative h-1.5 grow overflow-hidden rounded-full bg-muted">
        <RSlider.Range className="absolute h-full bg-primary" />
      </RSlider.Track>
      <RSlider.Thumb
        aria-label={label}
        className="block size-4 rounded-full border-2 border-primary bg-card shadow focus-visible:outline-2 focus-visible:outline-ring"
      />
    </RSlider.Root>
  );
}

/** Segmented control for a small set of options. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = 'sm',
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  label: string;
  size?: 'sm' | 'xs';
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg bg-muted p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'cursor-pointer rounded-md font-medium text-muted-foreground transition-colors',
            size === 'sm' ? 'px-3 py-1 text-xs' : 'px-2 py-0.5 text-[11px]',
            value === o.value && 'bg-card text-foreground shadow-xs',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
