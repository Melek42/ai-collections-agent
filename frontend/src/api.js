const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function request(path, options = {}) {
    const res = await fetch(`${BASE}${path}`, options)
    if (!res.ok) {
        let detail = res.statusText
        try {
            const body = await res.json()
            detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
        } catch {
            /* keep statusText */
        }
        throw new Error(detail)
    }
    return res.json()
}

const json = (method, body) => ({
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
})

export const api = {
    summary: () => request('/dashboard/summary'),
    invoices: () => request('/invoices'),
    clients: () => request('/clients'),
    createInvoice: (body) => request('/invoices', json('POST', body)),
    markPaid: (id) => request(`/invoices/${id}/mark-paid`, { method: 'POST' }),
    importCsv: (file) => {
        const form = new FormData()
        form.append('file', file)
        return request('/invoices/import', { method: 'POST', body: form })
    },
    // agent and approval queue
    runAgent: () => request('/agent/run-now?max_drafts=5', { method: 'POST' }),
    drafts: (status = 'draft') => request(`/drafts?status=${status}`),
    flush: () => request('/outbox/flush', { method: 'POST' }),
    settings: () => request('/settings'),
    saveSettings: (body) => request('/settings', json('PUT', body)),
    editDraft: (id, body) => request(`/drafts/${id}`, json('PATCH', body)),
    approveDraft: (id) => request(`/drafts/${id}/approve`, { method: 'POST' }),
    rejectDraft: (id) => request(`/drafts/${id}/reject`, { method: 'POST' }),
}