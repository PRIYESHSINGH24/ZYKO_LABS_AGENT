"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Bot, Loader2, Power, CheckCircle2, AlertCircle } from "lucide-react"

interface Props {
  sessionId: string
  defaultMeetingUrl?: string
  autoLaunch?: boolean
}

type BotStatus = "idle" | "launching" | "waiting" | "joined" | "ended" | "error" | "stopped"

interface BotState {
  status: BotStatus
  log: string[]
  transcriptCount: number
}

export default function MeetingBotControl({ sessionId, defaultMeetingUrl = "", autoLaunch = false }: Props) {
  const [meetingUrl, setMeetingUrl] = useState(defaultMeetingUrl)
  const [bot, setBot] = useState<BotState>({ status: "idle", log: [], transcriptCount: 0 })
  const [message, setMessage] = useState("")
  const [recording, setRecording] = useState(false)
  const [frameCount, setFrameCount] = useState(0)
  const autoLaunched = useRef(false)

  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/bot/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, action: "status" }),
      })
      if (!res.ok) return
      const data = await res.json()
      setBot({ status: data.status ?? "idle", log: data.log ?? [], transcriptCount: data.transcriptCount ?? 0 })
      if (data.error) setMessage(data.error)
    } catch {}
  }, [sessionId])

  // Poll while the bot is doing something (launching, waiting for admission, in the call).
  useEffect(() => {
    if (!["launching", "waiting", "joined"].includes(bot.status)) return
    const interval = setInterval(pollStatus, 2500)
    return () => clearInterval(interval)
  }, [bot.status, pollStatus])

  useEffect(() => {
    let interval: NodeJS.Timeout
    const pollRecording = async () => {
      try {
        const res = await fetch(`/api/recordings?sessionId=${sessionId}`)
        if (res.ok) {
          const data = await res.json()
          setRecording(!!data.recording)
          setFrameCount(data.count || 0)
        }
      } catch {}
    }
    if (bot.status === "joined") {
      pollRecording()
      interval = setInterval(pollRecording, 5000)
    }
    return () => clearInterval(interval)
  }, [bot.status, sessionId])

  const launchBot = async (url?: string) => {
    const target = (url ?? meetingUrl).trim()
    if (!target) return
    setMessage("")
    setBot({ status: "launching", log: ["Sending the bot to the meeting…"], transcriptCount: 0 })

    try {
      const res = await fetch("/api/bot/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingUrl: target, sessionId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setBot((prev) => ({ ...prev, status: "error" }))
        setMessage(data.error || "Failed to launch bot")
        return
      }
      setTimeout(pollStatus, 1500)
    } catch (err) {
      setBot((prev) => ({ ...prev, status: "error" }))
      setMessage(err instanceof Error ? err.message : "Network error launching bot")
    }
  }

  useEffect(() => {
    if (autoLaunch && defaultMeetingUrl.trim() && !autoLaunched.current) {
      autoLaunched.current = true
      launchBot(defaultMeetingUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLaunch, defaultMeetingUrl])

  const stopBot = async () => {
    try {
      await fetch("/api/bot/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, action: "stop" }),
      })
      setBot((prev) => ({ ...prev, status: "stopped" }))
      setMessage("Bot left the meeting. Blueprint generation has been triggered.")
      pollStatus()
    } catch {}
  }

  const statusBadge = () => {
    if (bot.status === "joined") {
      return (
        <Badge className="bg-emerald-100 text-emerald-800 text-[10px] border-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse mr-1 inline-block" />
          In the meeting
        </Badge>
      )
    }
    if (bot.status === "waiting") {
      return (
        <Badge className="bg-amber-100 text-amber-800 text-[10px] border-amber-300">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse mr-1 inline-block" />
          Waiting to be admitted
        </Badge>
      )
    }
    if (bot.status === "launching") {
      return (
        <Badge className="bg-indigo-100 text-indigo-800 text-[10px] border-indigo-300">
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse mr-1 inline-block" />
          Launching
        </Badge>
      )
    }
    if (bot.status === "error") {
      return <Badge className="bg-red-100 text-red-800 text-[10px] border-red-300">Failed</Badge>
    }
    return null
  }

  const showInput = ["idle", "error", "stopped", "ended"].includes(bot.status)

  return (
    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-3 space-y-2.5">
      <div className="flex items-center gap-2 flex-wrap">
        <Bot className="h-4 w-4 text-indigo-600" />
        <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider">
          Meeting Bot (Auto-Join &amp; Transcribe)
        </span>
        {statusBadge()}
        {bot.status === "joined" && recording && (
          <Badge className="bg-red-100 text-red-800 text-[10px] border-red-300 animate-pulse">
            Recording ({frameCount} frames)
          </Badge>
        )}
        {bot.transcriptCount > 0 && (
          <Badge variant="secondary" className="text-[10px] font-mono">
            {bot.transcriptCount} transcript lines
          </Badge>
        )}
      </div>

      {showInput && (
        <div className="flex gap-2">
          <Input
            type="url"
            placeholder="Paste the meeting link (meet.google.com/…, zoom.us/…, teams.microsoft.com/…)"
            value={meetingUrl}
            onChange={(e) => setMeetingUrl(e.target.value)}
            className="text-xs h-8 bg-white"
          />
          <Button
            onClick={() => launchBot()}
            disabled={!meetingUrl.trim()}
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8 gap-1.5 shrink-0"
          >
            <Bot className="h-3.5 w-3.5" />
            Send Bot to Meeting
          </Button>
        </div>
      )}

      {bot.status === "launching" && (
        <div className="flex items-center gap-2 text-xs text-indigo-700">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Sending the bot into the meeting as &quot;FlowMeet AI&quot;…</span>
        </div>
      )}

      {bot.status === "waiting" && (
        <div className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
          <span>
            The bot is in the waiting room. Admit &quot;FlowMeet AI&quot; in Google Meet — the host will see a join request.
          </span>
        </div>
      )}

      {bot.status === "joined" && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span>In the meeting. The transcript is imported when the call ends.</span>
          </div>
          <Button onClick={stopBot} variant="destructive" size="sm" className="text-xs h-7 gap-1 shrink-0">
            <Power className="h-3 w-3" />
            End &amp; Generate
          </Button>
        </div>
      )}

      {(bot.status === "ended" || bot.status === "stopped") && (
        <div className="flex items-center gap-2 text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded p-2">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          <span>
            Meeting finished — {bot.transcriptCount} lines transcribed and the blueprint was generated. See the panel on the right.
          </span>
        </div>
      )}

      {message && bot.status === "error" && (
        <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{message}</span>
        </div>
      )}

      {bot.log.length > 0 && (
        <pre className="max-h-28 overflow-y-auto bg-white/70 border border-indigo-100 rounded p-2 text-[10px] leading-relaxed text-gray-700 whitespace-pre-wrap font-mono">
          {bot.log.slice(-14).join("\n")}
        </pre>
      )}

      <p className="text-[10px] text-indigo-500 leading-snug">
        The bot joins the call as &quot;FlowMeet AI&quot; through Recall.ai, which runs it on its own infrastructure — no
        Chrome window, Google profile or sign-in is involved. If the meeting has a waiting room, admit the bot when
        it knocks. The transcript is imported and the blueprint generated once the call ends.
      </p>
    </div>
  )
}
