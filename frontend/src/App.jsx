import { useState } from 'react'

const API = 'http://localhost:8000'

export default function App() {
    const [health, setHealth] = useState(null)
    const [ai, setAi] = useState(null)
    const [loading, setLoading] = useState(false)

    async function checkBackend() {
        try {
            const res = await fetch(`${API}/health`)
            setHealth(await res.json())
        } catch (e) {
            setHealth({ error: 'Cannot reach backend: ' + e.message })
        }
    }

    async function testGemini() {
        setLoading(true)
        try {
            const res = await fetch(`${API}/ai-test`)
            setAi(await res.json())
        } catch (e) {
            setAi({ ok: false, error: 'Cannot reach backend: ' + e.message })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="mx-auto max-w-2xl space-y-4">
                <h1 className="text-3xl font-bold text-slate-900">AI Collections Agent</h1>
                <p className="text-slate-600">Setup check: frontend, backend and Gemini.</p>

                <div className="flex gap-3">
                    <button onClick={checkBackend} className="rounded-lg bg-slate-900 px-4 py-2 text-white">
                        Check backend
                    </button>
                    <button onClick={testGemini} className="rounded-lg bg-indigo-600 px-4 py-2 text-white">
                        {loading ? 'Asking Gemini...' : 'Test Gemini'}
                    </button>
                </div>

                {health && <pre className="rounded-lg bg-white p-4 text-sm shadow">{JSON.stringify(health, null, 2)}</pre>}
                {ai && <pre className="whitespace-pre-wrap rounded-lg bg-white p-4 text-sm shadow">{JSON.stringify(ai, null, 2)}</pre>}
            </div>
        </div>
    )
}