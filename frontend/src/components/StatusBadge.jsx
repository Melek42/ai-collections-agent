const STYLES = {
    upcoming: 'bg-slate-100 text-slate-700',
    overdue: 'bg-red-100 text-red-700',
    promised: 'bg-blue-100 text-blue-700',
    payment_pending: 'bg-amber-100 text-amber-700',
    paid: 'bg-emerald-100 text-emerald-700',
    disputed: 'bg-purple-100 text-purple-700',
    plan_active: 'bg-cyan-100 text-cyan-700',
    escalated: 'bg-rose-200 text-rose-800',
}

export default function StatusBadge({ status }) {
    return (
        <span
            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[status] || STYLES.upcoming
                }`}
        >
            {status.replace('_', ' ')}
        </span>
    )
}