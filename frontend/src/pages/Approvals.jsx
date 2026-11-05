import { useEffect, useState } from 'react'
import { api } from '../api'
import { money } from '../format'

const STAGE_LABELS = ['Friendly heads-up', 'Gentle nudge', 'Firm reminder', 'Final notice', 'Escalated']
const STAGE_COLORS = [
    'bg-emerald-100 text-emerald-700',
    'bg-amber-100 text-amber-700',
    'bg-orange-100 text-orange-700',
    'bg-red-100 text-red-700',
    'bg-rose-200 text-rose-800',
]

function DraftCard({ draft, onChanged, onError, onNotice }) {
    const [editing, setEditing] = useState(false)
    const [subject, setSubject] = useState(draft.subject)
    const [body, setBody] = useState(draft.body)
    const [busy, setBusy] = useState(false)

    async function act(fn, notice) {
        setBusy(true)
        try {
            await fn()
            if (notice) onNotice(notice)
            onChanged()
        } catch (e) {
            onError(e.message)
        } finally {
            setBusy(false)
        }
    }

    const save = () =>
        act(async () => {
            await api.editDraft(draft.id, { subject, body })
            setEditing(false)
        }, 'Draft saved.')

    return (
        <div className="space-y-3 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-900">{draft.client_name}</span>
                <span className="text-sm text-slate-500">
                    {draft.number} · {money(draft.amount, draft.currency)} ·{' '}
                    {draft.days_overdue > 0 ? `${draft.days_overdue} days late` : `due in ${-draft.days_overdue} days`}
                </span>
                <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-medium ${STAGE_COLORS[draft.stage]}`}>
                    {STAGE_LABELS[draft.stage]}
                </span>
            </div>

            {draft.reason && (
                <p className="rounded-lg bg-indigo-50 p-3 text-sm text-indigo-900">
                    <span className="font-medium">Why this message: </span>
                    {draft.reason}
                </p>
            )}

            <p className="text-xs text-slate-400">To: {draft.client_email}</p>

            {editing ? (
                <div className="space-y-2">
                    <input
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                    <textarea
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        rows={9}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                </div>
            ) : (
                <div className="rounded-lg bg-slate-50 p-4">
                    <p className="mb-2 text-sm font-medium text-slate-900">{draft.subject}</p>
                    <p className="whitespace-pre-wrap text-sm text-slate-700">{draft.body}</p>
                </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
                {editing ? (
                    <>
                        <button onClick={save} disabled={busy} className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50">
                            Save
                        </button>
                        <button
                            onClick={() => {
                                setEditing(false)
                                setSubject(draft.subject)
                                setBody(draft.body)
                            }}
                            className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
                        >
                            Cancel
                        </button>
                    </>
                ) : (
                    <>
                        <button
                            onClick={() => act(() => api.approveDraft(draft.id), 'Draft approved.')}
                            disabled={busy}
                            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white disabled:opacity-50"
                        >
                            Approve
                        </button>
                        <button
                            onClick={() => setEditing(true)}
                            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        >
                            Edit
                        </button>
                        <button
                            onClick={() => act(() => api.rejectDraft(draft.id), 'Draft rejected.')}
                            disabled={busy}
                            className="rounded-lg px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                            Reject
                        </button>
                    </>
                )}
                {draft.model && <span className="ml-auto text-xs text-slate-400">written by {draft.model}</span>}
            </div>
        </div>
    )
}

export default function Approvals() {
    const [drafts, setDrafts] = useState([])
    const [loading, setLoading] = useState(true)
    const [running, setRunning] = useState(false)
    const [result, setResult] = useState(null)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')

    async function load() {
        try {
            setDrafts(await api.drafts())
        } catch (e) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
    }, [])

    async function run() {
        setRunning(true)
        setError('')
        setResult(null)
        try {
            setResult(await api.runAgent())
            await load()
        } catch (e) {
            setError(e.message)
        } finally {
            setRunning(false)
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Approval queue</h1>
                    <p className="text-sm text-slate-500">The agent drafts. You decide what gets sent.</p>
                </div>
                <button onClick={run} disabled={running} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-60">
                    {running ? 'Agent is working...' : 'Run agent now'}
                </button>
            </div>

            {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            {notice && (
                <p className="flex justify-between rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
                    {notice}
                    <button onClick={() => setNotice('')}>x</button>
                </p>
            )}

            {result && (
                <div className="space-y-2 rounded-xl bg-white p-4 text-sm shadow-sm ring-1 ring-slate-200">
                    <p className="font-medium text-slate-900">
                        Agent run finished: {result.drafted.length} drafted, {result.escalated.length} escalated to you,{' '}
                        {result.skipped.length} skipped, {result.failed.length} failed.
                    </p>
                    {result.escalated.length > 0 && (
                        <p className="text-rose-700">Needs your attention (45+ days late): {result.escalated.join(', ')}</p>
                    )}
                    {result.failed.map((f) => (
                        <p key={f.invoice} className="text-red-700">
                            {f.invoice}: {f.reason}
                        </p>
                    ))}
                    {result.skipped.length > 0 && (
                        <details className="text-slate-600">
                            <summary className="cursor-pointer">Why some invoices were skipped</summary>
                            <ul className="mt-2 list-disc pl-5">
                                {result.skipped.map((s) => (
                                    <li key={s.invoice}>
                                        {s.invoice}: {s.reason}
                                    </li>
                                ))}
                            </ul>
                        </details>
                    )}
                </div>
            )}

            {loading && <p className="text-slate-500">Loading...</p>}
            {!loading && drafts.length === 0 && (
                <p className="rounded-xl bg-white p-8 text-center text-slate-500 ring-1 ring-slate-200">
                    No drafts waiting. Click "Run agent now" to let the agent review your invoices.
                </p>
            )}
            {drafts.map((d) => (
                <DraftCard key={d.id} draft={d} onChanged={load} onError={setError} onNotice={setNotice} />
            ))}
        </div>
    )
}