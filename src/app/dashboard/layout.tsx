import Sidebar from '@/components/Sidebar'
import RoleGate from '@/components/RoleGate'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <RoleGate />
      <Sidebar />
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-5xl px-8 py-10">{children}</div>
      </main>
    </div>
  )
}
