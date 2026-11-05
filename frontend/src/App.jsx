import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom'
import Approvals from './pages/Approvals'
import Dashboard from './pages/Dashboard'
import Invoices from './pages/Invoices'

const linkClass = ({ isActive }) =>
    `block rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
    }`

export default function App() {
    return (
        <BrowserRouter>
            <div className="flex min-h-screen flex-col bg-slate-50 md:flex-row">
                <aside className="w-full shrink-0 border-b border-slate-200 bg-white p-4 md:w-56 md:border-b-0 md:border-r">
                    <div className="mb-4 text-lg font-bold text-slate-900 md:mb-6">Collections Agent</div>
                    <nav className="flex gap-1 md:block md:space-y-1">
                        <NavLink to="/" end className={linkClass}>
                            Dashboard
                        </NavLink>
                        <NavLink to="/invoices" className={linkClass}>
                            Invoices
                        </NavLink>
                        <NavLink to="/approvals" className={linkClass}>
                            Approvals
                        </NavLink>
                    </nav>
                </aside>
                <main className="flex-1 p-4 md:p-8">
                    <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/invoices" element={<Invoices />} />
                        <Route path="/approvals" element={<Approvals />} />
                    </Routes>
                </main>
            </div>
        </BrowserRouter>
    )
}