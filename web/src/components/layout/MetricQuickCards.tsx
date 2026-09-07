import { BarChart3, CheckCircle2, AlertOctagon, ShieldCheck } from 'lucide-react';
import type { AnomalyReport } from '../../types';
import { MetricCard } from '../ui/MetricCard';

export interface MetricQuickCardsProps {
  displayAnomalies: AnomalyReport | null;
  myInventoryOnly: boolean;
}

export function MetricQuickCards({ displayAnomalies, myInventoryOnly }: MetricQuickCardsProps) {
  if (!displayAnomalies) return null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
      <MetricCard
        to="/items"
        title={myInventoryOnly ? 'סך פריטים חתומים שלך' : 'סך פריטים חתומים'}
        value={displayAnomalies.stats?.totalExpectedItems ?? 0}
        icon={BarChart3}
        variant="blue"
        tooltip="מעבר לקטלוג הפריטים"
      />
      <MetricCard
        to="/scans"
        title={myInventoryOnly ? 'פריטים שנסרקו בחדרייך' : 'פריטים פיזיים שנסרקו'}
        value={displayAnomalies.stats?.totalDiscoveredItems ?? 0}
        icon={CheckCircle2}
        variant="emerald"
        tooltip="מעבר לניהול ותחקור סריקות"
      />
      <MetricCard
        to="/"
        title="העברות ללא חתימה"
        value={displayAnomalies.stats?.unauthorizedCount ?? 0}
        icon={AlertOctagon}
        variant="rose"
        tooltip="מעבר למרכז החריגות במבט על"
      />
      <MetricCard
        to="/items"
        title={myInventoryOnly ? 'פער חסר מחתימותיך' : 'פער חסר מסך החתימות'}
        value={displayAnomalies.stats?.missingCount ?? 0}
        icon={ShieldCheck}
        variant="amber"
        tooltip="מעבר לקטלוג הפריטים"
      />
    </div>
  );
}
