import { getAuthSession } from "@/lib/auth"
import { redirect } from "next/navigation"

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
      <header className="border-b bg-white p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">FlowMeet</h1>
        <div className="text-sm text-gray-500">{session.user?.email}</div>
      </header>
      <main className="flex-1 flex flex-col">
        {children}
      </main>
    </div>
  )
}
