import { useEffect, useState } from 'react'
import { api } from '../api'

const today = () => new Date().toISOString().slice(0, 10)
const inDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)

export default function AddInvoiceModal({ onClose, onCreated }) {
    const [clients, setClients] = useState([])
    const [form, setForm] = useState({
        client_id: '',
        number: '',
        amount: '',
        currency: 'USD',
        issue_date: today(),
        due_date: inDays(30),
    })
    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        api
            .clients()
            .then((list) => {
                setClients(list)
                if (list[0]) setForm((f) => ({ ...f, client_id: list[0].id, currency: list[0].currency }))
            })
            .catch((e) => setError(e.message))
    }, [])

    const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

    function pickClient(e) {
        const c = clients.find((x) => x.id === e.target.value)
        setForm({ ...form, client_id: e.target.value, currency: c ? c.currency : form.currency })
    }

    async function submit(e) {
        e.preventDefault()
        setSaving(true)
        setError('')
        try {
            await api.createInvoice({ ...form, amount: Number(form.amount) })
            onCreated()
        } catch (err) {
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }

    const input = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm'

    return (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-4">
            <form onSubmit={submit} className="w-full max-w-md space-y-3 rounded-xl bg-white p-6 shadow-xl">
                <h2 className="text-lg font-semibold text-slate-900">Add invoice</h2>

                <label className="block text-sm text-slate-600">
                    Client
                    <select value={form.client_id} onChange={pickClient} className={input} required>
                        {clients.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                    </select>
                </label>

                <div className="grid grid-cols-2 gap-3">
                    <label className="block text-sm text-slate-600">
                        Invoice number
                        <input value={form.number} onChange={set('number')} className={input} required />
                    </label>
                    <label className="block text-sm text-slate-600">
                        Amount
                        <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={form.amount}
                            onChange={set('amount')}
                            className={input}
                            required
                        />
                    </label>
                    <label className="block text-sm text-slate-600">
                        Issue date
                        <input type="date" value={form.issue_date} onChange={set('issue_date')} className={input} required />
                    </label>
                    <label className="block text-sm text-slate-600">
                        Due date
                        <input type="date" value={form.due_date} onChange={set('due_date')} className={input} required />
                    </label>
                </div>

                {error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}

                <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={saving}
                        className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
                    >
                        {saving ? 'Saving...' : 'Add invoice'}
                    </button>
                </div>
            </form>
        </div>
    )
}