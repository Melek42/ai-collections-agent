import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api'
import { dueText, money } from '../format'
import AddInvoiceModal from '../components/AddInvoiceModal'
import StatusBadge from '../components/StatusBadge'

const FILTERS = ['all', 'overdue', 'upcoming', 'promised', 'payment_pending', 'paid', 'disputed']

export default function Invoices() {
    const [invoices, setInvoices] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')
    const [filter, setFilter] = useState('all')
    const [search, setSearch] = useState('')
    const [showAdd, setShowAdd] = useState(false)
    const fileRef = useRef(null)

    async function load() {
        try {
            setError('')
            setInvoices(await api.invoices())
        } catch (e) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
    }, [])

    const counts = useMemo(() => {
        const c = { all: invoices.length }
        invoices.forEach((i) => (c[i.status] = (c[i.status] || 0) + 1))
        return c
    }, [invoices])

    const rows = useMemo(() => {
        const q = search.trim().toLowerCase()
        return invoices.filter(
            (i) =>
                (filter === 'all' || i.status === filter) &&
                (!q || i.number.toLowerCase().includes(q) || i.client_name.toLowerCase().includes(q)),
        )
    }, [invoices, filter, search])

    async function markPaid(id) {
        try {
            await api.markPaid(id)
            setNotice('Invoice marked as paid.')
            load()
        } catch (e) {
            setError(e.message)
        }
    }

    async function onImport(e) {
        const file = e.target.files[0]
        if (!file) return
        try {
            const r = await api.importCsv(file)
            const firstError = r.errors[0] ? ` First problem: line ${r.errors[0].line}, ${r.errors[0].error}.` : ''
            setNotice(`Imported ${r.created} invoices, ${r.failed} failed.${firstError}`)
            load()
        } catch (err) {
            setError(err.message)
        }
        e.target.value = ''
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-2xl font-bold text-slate-900">Invoices</h1>
                <div className="flex gap-2">
                    <input ref={fileRef} type="file" accept=".csv" onChange={onImport} className="hidden" />
                    <button
                        onClick={() => fileRef.current.click()}
                        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                        Import CSV
                    </button>
                    <button onClick={() => setShowAdd(true)} className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white">
                        Add invoice
                    </button>
                </div>
            </div>

            {notice && (
                <p className="flex justify-between rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
                    {notice}
                    <button onClick={() => setNotice('')}>x</button>
                </p>
            )}
            {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

            <div className="flex flex-wrap items-center gap-2">
                {FILTERS.map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`rounded-full px-3 py-1 text-sm ${filter === f ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'
                            }`}
                    >
                        {f.replace('_', ' ')} ({counts[f] || 0})
                    </button>
                ))}
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search client or number"
                    className="ml-auto w-56 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                />
            </div>

            <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                        <tr>
                            <th className="px-4 py-3">Invoice</th>
                            <th className="px-4 py-3">Client</th>
                            <th className="px-4 py-3 text-right">Amount</th>
                            <th className="px-4 py-3">Due</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3" />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading && (
                            <tr>
                                <td colSpan="6" className="px-4 py-6 text-center text-slate-400">
                                    Loading...
                                </td>
                            </tr>
                        )}
                        {!loading && rows.length === 0 && (
                            <tr>
                                <td colSpan="6" className="px-4 py-6 text-center text-slate-400">
                                    No invoices match.
                                </td>
                            </tr>
                        )}
                        {rows.map((i) => (
                            <tr key={i.id} className="hover:bg-slate-50">
                                <td className="px-4 py-3 font-medium text-slate-900">{i.number}</td>
                                <td className="px-4 py-3 text-slate-700">{i.client_name}</td>
                                <td className="px-4 py-3 text-right text-slate-900">{money(i.amount, i.currency)}</td>
                                <td className="px-4 py-3">
                                    <div className="text-slate-700">{i.due_date}</div>
                                    <div className={`text-xs ${i.days_overdue > 0 && i.status !== 'paid' ? 'text-red-600' : 'text-slate-400'}`}>
                                        {dueText(i)}
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <StatusBadge status={i.status} />
                                </td>
                                <td className="px-4 py-3 text-right">
                                    {i.status !== 'paid' && (
                                        <button onClick={() => markPaid(i.id)} className="text-sm text-indigo-600 hover:underline">
                                            Mark paid
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showAdd && (
                <AddInvoiceModal
                    onClose={() => setShowAdd(false)}
                    onCreated={() => {
                        setShowAdd(false)
                        setNotice('Invoice added.')
                        load()
                    }}
                />
            )}
        </div>
    )
}