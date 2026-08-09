import type { AppointmentStatus } from '@/types/api';
import { STATUS_LABEL } from '@/utils/format';

/** Status colour and wording come from one place, so they never drift apart. */
export function StatusBadge({ status }: { status: AppointmentStatus }) {
  return <span className={`nu-badge nu-badge--${status}`}>{STATUS_LABEL[status]}</span>;
}
