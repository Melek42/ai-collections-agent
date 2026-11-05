import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../api'
import { money } from '../format'

const BUCKETS = ['current', '1-30', '31-60', '61-90', '90+']
const LABELS = {
    current: 'Not yet due',
    '1-30': '1-30 days',
    '31-60': '31-60 days',
    '61-90': '61-90 days',
    '90+': '90+ days',
}
const COLORS = ['#10b981', '#f59e0b', '#f97316', '#ef4444', '#991b1b']

function Card({ label, value, hint }) {
    return (
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
            {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
        </div>
    )
}

export default function Dashboard() {
    const [summary, setSummary] = useState(null)
    const [currency, setCurrency] = useState(null)
    const [error, setError] = useState('')

    useEffect(() => {
        api
            .summary()
            .then((s) => {
                setSummary(s)
                setCurrency(Object.keys(s.by_currency)[0] || null)
            })
            .catch((e) => setError(e.message))
    }, [])

    if (error) return <p className="rounded-lg bg-red-50 p-4 text-red-700">Could not load: {error}</p>
    if (!summary) return <p className="text-slate-500">Loading...</p>

    const currencies = Object.keys(summary.by_currency)
    if (!currency) return <p className="text-slate-500">No unpaid invoices yet.</p>

    const totals = summary.by_currency[currency]
    const collected = summary.collected_30d.find((c) => c.currency === currency)
    const aging = summary.aging[currency] || {}
    const chartData = BUCKETS.map((b, i) => ({
        name: LABELS[b],
        amount: Number(aging[b] || 0),
        color: COLORS[i],
    }))

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
                <div className="flex gap-1 rounded-lg bg-slate-200 p-1">
                    {currencies.map((c) => (
                        <button
                            key={c}
                            onClick={() => setCurrency(c)}
                            className={`rounded-md px-3 py-1 text-sm font-medium ${c === currency ? 'bg-white text-slate-900 shadow' : 'text-slate-600'
                                }`}
                        >
                            {c}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Card label="Outstanding" value={money(totals.outstanding, currency)} hint={`${totals.count} unpaid invoices`} />
                <Card label="Overdue" value={money(totals.overdue, currency)} hint={`${totals.overdue_count} invoices late`} />
                <Card
                    label="Overdue share"
                    value={totals.outstanding ? `${Math.round((totals.overdue / totals.outstanding) * 100)}%` : '0%'}
                    hint="of outstanding balance"
                />
                <Card label="Collected, last 30 days" value={money(collected ? collected.amount : 0, currency)} />
            </div>

            <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <h2 className="mb-4 font-semibold text-slate-900">Aging of unpaid invoices ({currency})</h2>
                <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                            <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => v.toLocaleString()} />
                            <Tooltip formatter={(v) => money(v, currency)} />
                            <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                                {chartData.map((d) => (
                                    <Cell key={d.name} fill={d.color} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    )
}