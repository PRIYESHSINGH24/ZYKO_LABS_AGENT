"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Folder, FolderPlus, Video, FileText, ChevronRight, Sparkles, Clock, ArrowRight } from "lucide-react"

export default function DashboardPage() {
  const router = useRouter()
  const [clients, setClients] = useState<any[]>([])
  const [recentSessions, setRecentSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // New Client Modal
  const [clientOpen, setClientOpen] = useState(false)
  const [clientName, setClientName] = useState("")
  const [company, setCompany] = useState("")
  const [description, setDescription] = useState("")
  const [creatingClient, setCreatingClient] = useState(false)

  // Quick Meeting Modal
  const [meetingOpen, setMeetingOpen] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState("")
  const [meetingTitle, setMeetingTitle] = useState("")
  const [creatingMeeting, setCreatingMeeting] = useState(false)

  const loadData = async () => {
    try {
      const [clientsRes, sessionsRes] = await Promise.all([
        fetch("/api/clients"),
        fetch("/api/sessions")
      ])
      if (clientsRes.ok) setClients(await clientsRes.json())
      if (sessionsRes.ok) setRecentSessions(await sessionsRes.json())
    } catch (e) {
      console.error("Failed to load dashboard data:", e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientName.trim() || creatingClient) return
    setCreatingClient(true)

    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: clientName, company, description })
      })
      if (res.ok) {
        const newClient = await res.json()
        setClientOpen(false)
        setClientName("")
        setCompany("")
        setDescription("")
        router.push(`/clients/${newClient.id}`)
      }
    } finally {
      setCreatingClient(false)
    }
  }

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault()
    if (creatingMeeting) return
    setCreatingMeeting(true)

    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: selectedClientId || undefined,
          title: meetingTitle || undefined,
        })
      })
      if (res.ok) {
        const data = await res.json()
        setMeetingOpen(false)
        router.push(`/sessions/${data.id}`)
      }
    } finally {
      setCreatingMeeting(false)
    }
  }

  return (
    <div className="p-8 max-w-6xl mx-auto w-full space-y-10">
      {/* Header with Stats & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">Client Workspaces</h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage your clients, record multilingual meetings for free, and accumulate blueprints.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Create Client Folder Dialog */}
          <Dialog open={clientOpen} onOpenChange={setClientOpen}>
            <DialogTrigger className={`${buttonVariants()} bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-xs`}>
              <FolderPlus className="h-4 w-4" />
              New Client Folder
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Client Workspace</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateClient} className="space-y-4 py-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase text-gray-600">Client Name *</label>
                  <Input 
                    placeholder="e.g. Acme Corp or John Doe" 
                    value={clientName} 
                    onChange={e => setClientName(e.target.value)} 
                    required 
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase text-gray-600">Company / Project (Optional)</label>
                  <Input 
                    placeholder="e.g. Logistics SaaS App" 
                    value={company} 
                    onChange={e => setCompany(e.target.value)} 
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase text-gray-600">Project Overview / Goals</label>
                  <Textarea 
                    placeholder="Brief notes about what this client wants to build..." 
                    rows={3}
                    value={description} 
                    onChange={e => setDescription(e.target.value)} 
                  />
                </div>
                <DialogFooter className="pt-2">
                  <Button type="button" variant="outline" onClick={() => setClientOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={creatingClient || !clientName.trim()} className="bg-blue-600 text-white">
                    {creatingClient ? "Creating..." : "Create Folder"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Quick Start Meeting Dialog */}
          <Dialog open={meetingOpen} onOpenChange={setMeetingOpen}>
            <DialogTrigger className={`${buttonVariants({ variant: "outline" })} gap-2`}>
              <Video className="h-4 w-4 text-emerald-600" />
              Start Meeting
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Start a New Meeting</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateMeeting} className="space-y-4 py-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase text-gray-600">Assign to Client Folder</label>
                  <select
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="w-full border rounded-md p-2 text-sm bg-white"
                  >
                    <option value="">-- Create or Auto-assign Client --</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.company ? `(${c.company})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase text-gray-600">Meeting Topic / Title</label>
                  <Input 
                    placeholder="e.g. Discovery & Feature Scoping" 
                    value={meetingTitle} 
                    onChange={e => setMeetingTitle(e.target.value)} 
                  />
                </div>
                <DialogFooter className="pt-2">
                  <Button type="button" variant="outline" onClick={() => setMeetingOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={creatingMeeting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    {creatingMeeting ? "Starting..." : "Launch Live Meeting Room"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Client Folders Grid */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Folder className="h-5 w-5 text-blue-600" />
            <span>Client Folders</span>
            <Badge variant="secondary" className="text-xs ml-1 font-mono">
              {clients.length}
            </Badge>
          </h3>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-36 rounded-lg bg-gray-100 animate-pulse border" />
            ))}
          </div>
        ) : clients.length === 0 ? (
          <Card className="p-10 text-center border-dashed border-2 bg-gray-50/50">
            <FolderPlus className="h-10 w-10 text-gray-400 mx-auto mb-3" />
            <h4 className="font-semibold text-gray-800">No client folders created yet</h4>
            <p className="text-sm text-gray-500 max-w-md mx-auto mt-1 mb-4">
              Create a client folder to organize meetings (Meeting #1, Meeting #2...), track master prompts, and share context across calls.
            </p>
            <Button onClick={() => setClientOpen(true)} className="bg-blue-600 text-white">
              Create Your First Client Folder
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {clients.map((client) => {
              const meetingCount = client.sessions?.length || 0
              return (
                <Link key={client.id} href={`/clients/${client.id}`} className="group block">
                  <Card className="h-full hover:shadow-md transition-all border-gray-200 hover:border-blue-400 flex flex-col justify-between p-5">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                          <Folder className="h-6 w-6" />
                        </div>
                        <Badge variant="outline" className="text-xs font-mono">
                          {meetingCount} {meetingCount === 1 ? "meeting" : "meetings"}
                        </Badge>
                      </div>
                      <div>
                        <h4 className="font-bold text-base text-gray-900 group-hover:text-blue-600 transition-colors">
                          {client.name}
                        </h4>
                        {client.company && (
                          <p className="text-xs text-gray-500 font-medium">{client.company}</p>
                        )}
                        {client.description && (
                          <p className="text-xs text-gray-600 line-clamp-2 mt-1.5 leading-relaxed">
                            {client.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="pt-4 border-t mt-4 flex items-center justify-between text-xs text-gray-500">
                      <span>View workspace</span>
                      <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform text-blue-600" />
                    </div>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* Recent Meetings Table */}
      <section className="space-y-4 pt-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Clock className="h-5 w-5 text-gray-500" />
          <span>All Recent Meetings</span>
        </h3>

        {recentSessions.length === 0 ? (
          <Card className="p-6 text-center text-gray-400 text-sm">
            No meetings held yet. Click "Start Meeting" to start your first session.
          </Card>
        ) : (
          <div className="bg-white border rounded-lg overflow-hidden shadow-2xs">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-600 uppercase bg-gray-50/80 border-b">
                <tr>
                  <th className="px-6 py-3">Meeting</th>
                  <th className="px-6 py-3">Client Folder</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentSessions.slice(0, 10).map((session) => (
                  <tr key={session.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                          #{session.meetingNumber || 1}
                        </span>
                        <span>{session.title}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {session.client ? (
                        <Link href={`/clients/${session.client.id}`} className="hover:underline text-blue-600 font-medium">
                          {session.client.name}
                        </Link>
                      ) : (
                        session.clientName || "—"
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={session.status === "COMPLETE" ? "default" : "secondary"} className="text-xs">
                        {session.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500 font-mono">
                      {new Date(session.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <Link
                        href={`/sessions/${session.id}`}
                        className={`${buttonVariants({ variant: "outline", size: "sm" })} text-xs h-7`}
                      >
                        Live Room
                      </Link>
                      {session.blueprint && (
                        <Link
                          href={`/blueprints/${session.id}`}
                          className={`${buttonVariants({ size: "sm" })} bg-purple-600 hover:bg-purple-700 text-white text-xs h-7`}
                        >
                          Master Prompt
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
