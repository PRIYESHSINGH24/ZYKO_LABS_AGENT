"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Video, Sparkles } from "lucide-react"

function NewSessionContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialClientId = searchParams.get("clientId") || ""

  const [clients, setClients] = useState<any[]>([])
  const [selectedClientId, setSelectedClientId] = useState(initialClientId)
  const [meetingTitle, setMeetingTitle] = useState("")
  const [meetingUrl, setMeetingUrl] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch("/api/clients")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setClients(data)
          if (initialClientId) {
            const found = data.find((c: any) => c.id === initialClientId)
            if (found) {
              const nextNumber = (found.sessions?.length || 0) + 1
              setMeetingTitle(`Meeting #${nextNumber} - Requirements & Architecture`)
            }
          }
        }
      })
      .catch((e) => console.error("Error fetching clients:", e))
  }, [initialClientId])

  const handleClientChange = (clientId: string) => {
    setSelectedClientId(clientId)
    const found = clients.find((c) => c.id === clientId)
    if (found) {
      const nextNumber = (found.sessions?.length || 0) + 1
      setMeetingTitle(`Meeting #${nextNumber} - Requirements & Architecture`)
    }
  }

  const handleLaunch = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: selectedClientId || undefined,
          title: meetingTitle || undefined,
          meetingUrl: meetingUrl || undefined,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        router.push(`/sessions/${data.id}`)
      } else {
        alert("Failed to start session.")
      }
    } catch (e) {
      alert("Error starting session.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-xl mx-auto w-full space-y-6">
      <Link href={selectedClientId ? `/clients/${selectedClientId}` : "/"} className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>Back to Client Workspace</span>
      </Link>

      <Card className="border shadow-xs bg-white">
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <Video className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl">Launch Meeting Room</CardTitle>
              <CardDescription className="text-xs">
                Free real-time multilingual transcription & local recording
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLaunch} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-gray-600">Client Folder *</label>
              <select
                value={selectedClientId}
                onChange={(e) => handleClientChange(e.target.value)}
                className="w-full border rounded-md p-2 text-sm bg-white"
                required
              >
                <option value="">-- Select Client Workspace --</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.company ? `(${c.company})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-gray-600">Meeting Title</label>
              <Input
                placeholder="e.g. Meeting #1 - Discovery & Scope"
                value={meetingTitle}
                onChange={(e) => setMeetingTitle(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-gray-600">Google Meet Link (Optional)</label>
              <Input
                type="url"
                placeholder="https://meet.google.com/xxx-xxxx-xxx"
                value={meetingUrl}
                onChange={(e) => setMeetingUrl(e.target.value)}
              />
              <p className="text-[10px] text-gray-400 mt-1">
                Bot isse meeting mein auto-join karke live transcribe karega
              </p>
            </div>

            <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-lg text-xs text-blue-900 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                100% Free Meeting Pipeline Active
              </div>
              <p className="text-blue-800">
                Uses in-browser speech recognition (Hindi, English, Hinglish) and local audio recording. No paid bots or subscriptions needed!
              </p>
            </div>

            <Button
              type="submit"
              disabled={loading || !selectedClientId}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
            >
              {loading ? "Starting..." : "Enter Meeting Room"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default function NewSessionPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading meeting setup...</div>}>
      <NewSessionContent />
    </Suspense>
  )
}
