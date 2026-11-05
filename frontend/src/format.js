export function money(amount, currency = 'USD') {
    const n = Number(amount) || 0
    try {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency,
            maximumFractionDigits: 0,
        }).format(n)
    } catch {
        return `${currency} ${n.toLocaleString()}`
    }
}

export function dueText(inv) {
    if (inv.status === 'paid') return 'Paid'
    if (inv.days_overdue > 0) return `${inv.days_overdue} days late`
    if (inv.days_overdue === 0) return 'Due today'
    return `Due in ${-inv.days_overdue} days`
}