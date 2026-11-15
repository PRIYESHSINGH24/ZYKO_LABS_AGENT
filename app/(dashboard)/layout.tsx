import { getAuthSession } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Folder, Video, Sparkles } from "lucide-react"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getAuthSession()
  
  if (!session) {
    redirect("/login")
  }

  return (
    <div className="flex min-h-screen bg-gray-50 flex-col">
      <header className="border-b bg-white px-6 py-3.5 flex justify-between items-center shadow-2xs">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg text-gray-900 hover:opacity-90">
            <span className="p-1.5 bg-blue-600 text-white rounded-md flex items-center justify-center">
              <Sparkles className="h-4 w-4" />
            </span>
            <span>FlowMeet</span>
            <span className="text-[10px] font-semibold tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              FREE TIER
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-4 text-xs font-medium text-gray-600">
            <Link href="/" className="hover:text-blue-600 flex items-center gap-1.5 transition-colors">
              <Folder className="h-3.5 w-3.5" />
              <span>Client Workspaces</span>
            </Link>
            <Link href="/sessions/new" className="hover:text-emerald-600 flex items-center gap-1.5 transition-colors">
              <Video className="h-3.5 w-3.5" />
              <span>+ New Meeting</span>
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="bg-gray-100 px-2.5 py-1 rounded-full font-medium text-gray-700">
            {session.user?.name || session.user?.email}
          </span>
        </div>
      </header>
      <main className="flex-1 flex flex-col">
        {children}
      </main>
    </div>
  )
}
