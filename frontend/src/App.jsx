import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom'
import Approvals from './pages/Approvals'
import Dashboard from './pages/Dashboard'
import Invoices from './pages/Invoices'
import Sent from './pages/Sent'
import Settings from './pages/Settings'

const linkClass = ({ isActive }) =>
    `block rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
    }`

const NAV = [
    ['/', 'Dashboard'],
    ['/invoices', 'Invoices'],
    ['/approvals', 'Approvals'],
    ['/sent', 'Sent'],
    ['/settings', 'Settings'],
]

export default function App() {
    return (
        <BrowserRouter>
            <div className="flex min-h-screen flex-col bg-slate-50 md:flex-row">
                <aside className="w-full shrink-0 border-b border-slate-200 bg-white p-4 md:w-56 md:border-b-0 md:border-r">
                    <div className="mb-4 text-lg font-bold text-slate-900 md:mb-6">Collections Agent</div>
                    <nav className="flex flex-wrap gap-1 md:block md:space-y-1">
                        {NAV.map(([to, label]) => (
                            <NavLink key={to} to={to} end={to === '/'} className={linkClass}>
                                {label}
                            </NavLink>
                        ))}
                    </nav>
                </aside>
                <main className="flex-1 p-4 md:p-8">
                    <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/invoices" element={<Invoices />} />
                        <Route path="/approvals" element={<Approvals />} />
                        <Route path="/sent" element={<Sent />} />
                        <Route path="/settings" element={<Settings />} />
                    </Routes>
                </main>
            </div>
        </BrowserRouter>
    )
}