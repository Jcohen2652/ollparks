import { cn } from '@/lib/cn';

const variants = {
  default: 'bg-slate-100 text-slate-700',
  green: 'bg-green-100 text-green-700',
  amber: 'bg-amber-100 text-amber-700',
  red: 'bg-red-100 text-red-700',
  blue: 'bg-blue-100 text-blue-700',
} as const;

type Variant = keyof typeof variants;

export function Badge({
  children,
  variant = 'default',
  className,
}: {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

export function ScoreBadge({ score }: { score: number }) {
  const variant: Variant =
    score >= 80 ? 'red' : score >= 60 ? 'amber' : score >= 40 ? 'blue' : 'default';
  return <Badge variant={variant}>{score}/100</Badge>;
}
