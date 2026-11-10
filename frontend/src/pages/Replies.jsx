import { useEffect, useState } from 'react'
import { api } from '../api'
import { money } from '../format'

const CATEGORY = {
    promise_to_pay: ['Promise to pay', 'bg-blue-100 text-blue-700'],
    paid_claim: ['Says it paid', 'bg-amber-100 text-amber-700'],
    dispute: ['Dispute', 'bg-purple-100 text-purple-700'],
    info_request: ['Needs info', 'bg-cyan-100 text-cyan-700'],
    extension_request: ['Wants more time', 'bg-orange-100 text-orange-700'],
    out_of_office: ['Out of office', 'bg-slate-100 text-slate-700'],
    unclear: ['Unclear', 'bg-slate-200 text-slate-700'],
}

const EXAMPLES = [
    "Sorry for the delay! I'll pay on Friday.",
    'We already paid this yesterday, transfer reference TX48213.',
    'This invoice is wrong. We never ordered those items.',
    'Could you resend the invoice with your bank details?',
    'Can we pay in 3 weeks? Cash is tight this month.',
    "I'm out of the office until Monday with limited access to email.",
]

const ACTIONS = {
    paid_claim: [
        ['confirm_paid', 'Payment received', 'bg-emerald-600 text-white'],
        ['not_received', 'Not received', 'border border-slate-300 text-slate-700'],
    ],
    dispute: [
        ['resume', 'Resume reminders', 'bg-slate-900 text-white'],
        ['handled', 'Mark handled', 'border border-slate-300 text-slate-700'],
    ],
}
const DEFAULT_ACTIONS = [['handled', 'Mark handled', 'bg-slate-900 text-white']]

function Badge({ category }) {
    const [label, style] = CATEGORY[category] || CATEGORY.unclear
    return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>{label}</span>
}

function ReplyCard({ r, onAction }) {
    const actions = ACTIONS[r.category] || DEFAULT_ACTIONS
    return (
        <div className="space-y-3 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-900">{r.client_name}</span>
                <span className="text-sm text-slate-500">
                    {r.number} · {money(r.amount, r.currency)}
                </span>
                <span className="ml-auto flex items-center gap-2">
                    <span className="text-xs text-slate-400">{Math.round(r.confidence * 100)}% sure</span>
                    <Badge category={r.category} />
                </span>
            </div>
            <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm italic text-slate-700">"{r.body}"</p>
            <p className="text-sm text-slate-700">
                <span className="font-medium">Agent understood: </span>
                {r.summary}
                {r.promised_date && <span className="text-slate-500"> (date: {r.promised_date})</span>}
            </p>
            <p className="rounded-lg bg-indigo-50 p-3 text-sm text-indigo-900">
                <span className="font-medium">Agent action: </span>
                {r.action_taken}
            </p>
            {!r.resolved && (
                <div className="flex flex-wrap gap-2">
                    {actions.map(([action, label, style]) => (
                        <button key={action} onClick={() => onAction(r.id, action)} className={`rounded-lg px-4 py-2 text-sm ${style}`}>
                            {label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

export default function Replies() {
    const [replies, setReplies] = useState([])
    const [invoices, setInvoices] = useState([])
    const [invoiceId, setInvoiceId] = useState('')
    const [text, setText] = useState('')
    const [busy, setBusy] = useState(false)
    const [result, setResult] = useState(null)
    const [error, setError] = useState('')

    async function load() {
        try {
            const [r, inv] = await Promise.all([api.replies(), api.invoices()])
            setReplies(r)
            const open = inv.filter((i) => i.status !== 'paid')
            setInvoices(open)
            setInvoiceId((cur) => cur || (open[0] ? open[0].id : ''))
        } catch (e) {
            setError(e.message)
        }
    }

    useEffect(() => {
        load()
    }, [])

    async function simulate(e) {
        e.preventDefault()
        setBusy(true)
        setError('')
        setResult(null)
        try {
            setResult(await api.simulateReply(invoiceId, text))
            setText('')
            await load()
        } catch (err) {
            setError(err.message)
        } finally {
            setBusy(false)
        }
    }

    async function act(id, action) {
        setError('')
        try {
            await api.resolveReply(id, action)
            load()
        } catch (e) {
            setError(e.message)
        }
    }

    const open = replies.filter((r) => !r.resolved)
    const done = replies.filter((r) => r.resolved)

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Client replies</h1>
                <p className="text-sm text-slate-500">The agent reads each reply, understands it, and acts.</p>
            </div>

            {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

            <form onSubmit={simulate} className="space-y-3 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <p className="font-semibold text-slate-900">Simulate a client reply (for testing and demos)</p>
                <select value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                    {invoices.map((i) => (
                        <option key={i.id} value={i.id}>
                            {i.client_name} · {i.number} · {money(i.amount, i.currency)} ({i.status.replace('_', ' ')})
                        </option>
                    ))}
                </select>
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={3}
                    placeholder="Type what the client replies..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    required
                />
                <div className="flex flex-wrap gap-2">
                    {EXAMPLES.map((ex) => (
                        <button type="button" key={ex} onClick={() => setText(ex)} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 hover:bg-slate-200">
                            {ex.length > 38 ? ex.slice(0, 38) + '...' : ex}
                        </button>
                    ))}
                </div>
                <button disabled={busy || !invoiceId} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-50">
                    {busy ? 'Agent is reading...' : 'Send reply to agent'}
                </button>

                {result && (
                    <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
                        <p>
                            <span className="font-medium">Understood as: </span>
                            <Badge category={result.category} /> {result.summary}
                        </p>
                        <p className="mt-1">
                            <span className="font-medium">Agent action: </span>
                            {result.action}
                        </p>
                    </div>
                )}
            </form>

            <section className="space-y-3">
                <h2 className="font-semibold text-slate-900">Needs your attention ({open.length})</h2>
                {open.length === 0 && <p className="text-slate-500">Nothing waiting for you.</p>}
                {open.map((r) => (
                    <ReplyCard key={r.id} r={r} onAction={act} />
                ))}
            </section>

            <section className="space-y-3">
                <h2 className="font-semibold text-slate-900">Handled ({done.length})</h2>
                {done.map((r) => (
                    <ReplyCard key={r.id} r={r} onAction={act} />
                ))}
            </section>
        </div>
    )
}