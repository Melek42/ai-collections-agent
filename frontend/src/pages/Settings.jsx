import { useEffect, useState } from 'react'
import { api } from '../api'

export default function Settings() {
    const [s, setS] = useState(null)
    const [error, setError] = useState('')
    const [msg, setMsg] = useState('')
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        api.settings().then(setS).catch((e) => setError(e.message))
    }, [])

    if (!s) return error ? <p className="rounded-lg bg-red-50 p-4 text-red-700">{error}</p> : <p className="text-slate-500">Loading...</p>

    const set = (key) => (e) => setS({ ...s, [key]: e.target.value })
    const input = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm'

    async function save(partial) {
        setSaving(true)
        setError('')
        setMsg('')
        try {
            setS(await api.saveSettings(partial))
            setMsg('Settings saved.')
        } catch (e) {
            setError(e.message)
        } finally {
            setSaving(false)
        }
    }

    function chooseMode(mode) {
        if (mode === 'autopilot' && !window.confirm('Autopilot sends emails without your review (within your limits). Continue?')) return
        save({ mode })
    }

    return (
        <div className="max-w-2xl space-y-6">
            <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
            {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            {msg && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{msg}</p>}

            <div className={`rounded-xl p-5 ring-1 ${s.agent_paused ? 'bg-red-50 ring-red-200' : 'bg-white ring-slate-200'}`}>
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <p className="font-semibold text-slate-900">Kill switch</p>
                        <p className="text-sm text-slate-600">
                            {s.agent_paused ? 'The agent is PAUSED. Nothing is drafted or sent.' : 'The agent is active.'}
                        </p>
                    </div>
                    <button
                        onClick={() => save({ agent_paused: !s.agent_paused })}
                        className={`rounded-lg px-4 py-2 text-sm text-white ${s.agent_paused ? 'bg-emerald-600' : 'bg-red-600'}`}
                    >
                        {s.agent_paused ? 'Resume agent' : 'Pause agent'}
                    </button>
                </div>
            </div>

            <div className="space-y-3 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <p className="font-semibold text-slate-900">Mode</p>
                <div className="flex gap-2">
                    {[
                        ['approval', 'Approval (you review every email)'],
                        ['autopilot', 'Autopilot (agent sends on its own)'],
                    ].map(([value, label]) => (
                        <button
                            key={value}
                            onClick={() => chooseMode(value)}
                            className={`rounded-lg px-4 py-2 text-sm ${s.mode === value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
                                }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="space-y-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <p className="font-semibold text-slate-900">Limits and business details</p>
                <div className="grid gap-3 sm:grid-cols-3">
                    <label className="block text-sm text-slate-600">
                        Sending window starts
                        <input type="time" value={(s.quiet_start || '').slice(0, 5)} onChange={set('quiet_start')} className={input} />
                    </label>
                    <label className="block text-sm text-slate-600">
                        Sending window ends
                        <input type="time" value={(s.quiet_end || '').slice(0, 5)} onChange={set('quiet_end')} className={input} />
                    </label>
                    <label className="block text-sm text-slate-600">
                        Daily email cap
                        <input type="number" min="1" max="200" value={s.daily_cap} onChange={set('daily_cap')} className={input} />
                    </label>
                </div>
                <p className="text-xs text-slate-400">Times are in {s.timezone}. Emails outside the window wait until it opens.</p>
                <label className="block text-sm text-slate-600">
                    Business name
                    <input value={s.business_name || ''} onChange={set('business_name')} className={input} />
                </label>
                <label className="block text-sm text-slate-600">
                    Tone notes for the agent
                    <textarea value={s.tone_notes || ''} onChange={set('tone_notes')} rows={3} className={input} />
                </label>
                <button
                    disabled={saving}
                    onClick={() =>
                        save({
                            quiet_start: (s.quiet_start || '').slice(0, 5),
                            quiet_end: (s.quiet_end || '').slice(0, 5),
                            daily_cap: Number(s.daily_cap),
                            business_name: s.business_name || '',
                            tone_notes: s.tone_notes || '',
                        })
                    }
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
                >
                    {saving ? 'Saving...' : 'Save'}
                </button>
            </div>
        </div>
    )
}