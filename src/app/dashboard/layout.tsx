import Sidebar from '@/components/Sidebar'
import SessionProvider from '@/components/SessionProvider'
import ToastProvider from '@/components/ui/toast'
import { MobileTabBar, MobileTopBar } from '@/components/MobileNav'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ToastProvider>
        <div className="flex min-h-screen bg-background">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <MobileTopBar />
            {/* pb-24 keeps the last row clear of the fixed mobile tab bar. */}
            <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-6 lg:px-8 lg:pb-10 lg:pt-10">
              {children}
            </main>
          </div>
          <MobileTabBar />
        </div>
      </ToastProvider>
    </SessionProvider>
  )
}
