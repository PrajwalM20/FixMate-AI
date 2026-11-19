import { AlertTriangle, CheckCircle2, Clock, Info, ShieldAlert } from 'lucide-react';
import type { RiskLevel } from '../types/domain.ts';

export function RiskIndicator({ level }: { level: RiskLevel }) {
  const config: Record<
    RiskLevel,
    { label: string; colorClass: string; Icon: typeof Info }
  > = {
    low: { label: 'Low Risk', colorClass: 'text-emerald-700', Icon: CheckCircle2 },
    medium: { label: 'Medium Risk', colorClass: 'text-amber-700', Icon: Clock },
    high: { label: 'High Risk', colorClass: 'text-red-700', Icon: AlertTriangle },
    critical: { label: 'Critical Hazard', colorClass: 'text-red-700', Icon: ShieldAlert },
  };
  const { label, colorClass, Icon } = config[level] ?? config.low;

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${colorClass}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{label}</span>
    </span>
  );
}

export function StatusText({ status }: { status: string }) {
  const formatted = status.replace(/_/g, ' ');
  let colorClass = 'text-slate-700';
  if (['verified', 'completed', 'accepted', 'diagnosed'].includes(status)) {
    colorClass = 'text-emerald-700';
  } else if (['pending', 'technician_requested', 'booked', 'in_progress'].includes(status)) {
    colorClass = 'text-blue-700';
  } else if (['rejected', 'cancelled', 'expired'].includes(status)) {
    colorClass = 'text-red-700';
  }

  return (
    <span className={`text-xs font-semibold capitalize ${colorClass}`}>
      {formatted}
    </span>
  );
}
