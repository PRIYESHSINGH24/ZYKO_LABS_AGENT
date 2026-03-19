"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

export default function DashboardPage() {
  const router = useRouter()
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // Modal state
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [clientName, setClientName] = useState("")
  const [meetingUrl, setMeetingUrl] = useState("")
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetch("/api/sessions")
      .then(res => res.json())
      .then(data => {
        setSessions(data)
        setLoading(false)
      })
  }, [])

  const handleCreate = async () => {
    setCreating(true)
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, clientName, meetingUrl: meetingUrl || undefined })
    })
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: "Unknown error occurred." }));
      alert(errorData.error || "Failed to create session.");
      setCreating(false);
      return;
    }

    const data = await res.json()
    setCreating(false)
    setOpen(false)
    router.push(`/sessions/${data.id}`)
  }

  return (
    <div className="p-8 max-w-6xl mx-auto w-full">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold">Your Sessions</h2>
        
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger className={buttonVariants()}>
            New Session
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Session</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Session Title</label>
                <Input placeholder="e.g. Acme Corp Discovery" value={title} onChange={e => setTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Client Name</label>
                <Input placeholder="e.g. Acme Corp" value={clientName} onChange={e => setClientName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Meeting URL (Zoom/Meet/Teams)</label>
                <Input placeholder="Leave blank to upload recording later..." value={meetingUrl} onChange={e => setMeetingUrl(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={creating || !title || !clientName}>
                {creating ? "Creating..." : "Start Session"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div>Loading sessions...</div>
      ) : sessions.length === 0 ? (
        <Card className="p-12 text-center text-gray-500">
          <p>No sessions yet. Create one to get started.</p>
        </Card>
      ) : (
        <div className="bg-white border rounded-md">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3">Title</th>
                <th className="px-6 py-3">Client</th>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map(s => (
                <tr key={s.id} className="border-b hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium">{s.title}</td>
                  <td className="px-6 py-4">{s.clientName}</td>
                  <td className="px-6 py-4">{new Date(s.createdAt).toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    <Badge variant={s.status === "COMPLETE" ? "default" : "secondary"}>
                      {s.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {s.status === "COMPLETE" ? (
                      <Button variant="outline" size="sm" onClick={() => router.push(`/blueprints/${s.id}`)}>
                        View Blueprint
                      </Button>
                    ) : (
                      <Button variant="secondary" size="sm" onClick={() => router.push(`/sessions/${s.id}`)}>
                        Join Live
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
