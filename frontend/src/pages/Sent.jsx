import { useEffect, useState } from 'react'
import { api } from '../api'
import { money } from '../format'

function Row({ m, pending }) {
    const [open, setOpen] = useState(false)
    return (
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <button onClick={() => setOpen(!open)} className="flex w-full flex-wrap items-center gap-2 text-left">
                <span className="font-medium text-slate-900">{m.client_name}</span>
                <span className="text-sm text-slate-500">
                    {m.number} · {money(m.amount, m.currency)}
                </span>
                <span className="ml-auto text-xs text-slate-400">
                    {pending ? 'waiting to send' : new Date(m.sent_at || m.created_at).toLocaleString()}
                </span>
            </button>
            <p className="mt-1 text-sm text-slate-600">{m.subject}</p>
            {open && <p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{m.body}</p>}
        </div>
    )
}

export default function Sent() {
    const [sent, setSent] = useState([])
    const [queued, setQueued] = useState([])
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')

    async function load() {
        try {
            const [s, q] = await Promise.all([api.drafts('sent'), api.drafts('approved')])
            setSent(s)
            setQueued(q)
        } catch (e) {
            setError(e.message)
        }
    }

    useEffect(() => {
        load()
    }, [])

    async function flush() {
        setError('')
        try {
            const r = await api.flush()
            setNotice(
                `Sent ${r.sent.length}.` +
                (r.held ? ` Held: ${r.held}.` : '') +
                (r.failed.length ? ` Problem: ${r.failed[0].error}` : ''),
            )
            load()
        } catch (e) {
            setError(e.message)
        }
    }

    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-bold text-slate-900">Sent emails</h1>
            {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            {notice && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}

            {queued.length > 0 && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <h2 className="font-semibold text-slate-900">Approved, waiting to send ({queued.length})</h2>
                        <button onClick={flush} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white">
                            Send queued now
                        </button>
                    </div>
                    {queued.map((m) => (
                        <Row key={m.id} m={m} pending />
                    ))}
                </div>
            )}

            <div className="space-y-2">
                <h2 className="font-semibold text-slate-900">Sent ({sent.length})</h2>
                {sent.length === 0 && <p className="text-slate-500">Nothing sent yet.</p>}
                {sent.map((m) => (
                    <Row key={m.id} m={m} />
                ))}
            </div>
        </div>
    )
}