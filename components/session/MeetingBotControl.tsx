"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Bot, Loader2, Power, CheckCircle2, AlertCircle } from "lucide-react"

interface Props {
  sessionId: string
}

export default function MeetingBotControl({ sessionId }: Props) {
  const [meetingUrl, setMeetingUrl] = useState("")
  const [botStatus, setBotStatus] = useState<"idle" | "launching" | "joined" | "error" | "stopped">("idle")
  const [message, setMessage] = useState("")
  const [recording, setRecording] = useState(false)
  const [frameCount, setFrameCount] = useState(0)

  const launchBot = async () => {
    if (!meetingUrl.trim()) return
    setBotStatus("launching")
    setMessage("Launching bot... A Chrome window will open and join your meeting.")

    try {
      const res = await fetch("/api/bot/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingUrl: meetingUrl.trim(), sessionId }),
      })

      const data = await res.json()

      if (!res.ok) {
        setBotStatus("error")
        setMessage(data.error || "Failed to launch bot")
        return
      }

      if (data.status === "joined" || data.status === "already_running") {
        setBotStatus("joined")
        setMessage('Bot "FlowMeet AI" has joined the meeting and is transcribing captions live!')
      } else if (data.status === "error") {
        setBotStatus("error")
        setMessage(data.error || "Bot could not join the meeting")
      }
    } catch (err: any) {
      setBotStatus("error")
      setMessage(err.message || "Network error launching bot")
    }
  }

  const stopBot = async () => {
    try {
      await fetch("/api/bot/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, action: "stop" }),
      })
      setBotStatus("stopped")
      setMessage("Bot has left the meeting.")
    } catch (e) {}
  }

  useEffect(() => {
    let interval: NodeJS.Timeout
    const poll = async () => {
      try {
        const res = await fetch(`/api/recordings?sessionId=${sessionId}`)
        if (res.ok) {
          const data = await res.json()
          setRecording(!!data.recording)
          setFrameCount(data.count || 0)
        }
      } catch {}
    }
    if (botStatus === "joined") {
      poll()
      interval = setInterval(poll, 4000)
    }
    return () => clearInterval(interval)
  }, [botStatus, sessionId])

  return (
    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <Bot className="h-4 w-4 text-indigo-600" />
        <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider">
          Meeting Bot (Auto-Join & Transcribe)
        </span>
        {botStatus === "joined" && (
          <>
            <Badge className="bg-emerald-100 text-emerald-800 text-[10px] border-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse mr-1 inline-block" />
              Live in Meeting
            </Badge>
            {recording && (
              <Badge className="bg-red-100 text-red-800 text-[10px] border-red-300 animate-pulse">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse mr-1 inline-block" />
                Recording ({frameCount} frames)
              </Badge>
            )}
          </>
        )}
      </div>

      {(botStatus === "idle" || botStatus === "error" || botStatus === "stopped") && (
        <div className="flex gap-2">
          <Input
            type="url"
            placeholder="Paste Google Meet link (meet.google.com/xxx-xxxx-xxx)"
            value={meetingUrl}
            onChange={(e) => setMeetingUrl(e.target.value)}
            className="text-xs h-8 bg-white"
          />
          <Button
            onClick={launchBot}
            disabled={!meetingUrl.trim()}
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8 gap-1.5 shrink-0"
          >
            <Bot className="h-3.5 w-3.5" />
            Send Bot to Meeting
          </Button>
        </div>
      )}

      {botStatus === "launching" && (
        <div className="flex items-center gap-2 text-xs text-indigo-700">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Opening Chrome and joining meeting as "FlowMeet AI"...</span>
        </div>
      )}

      {botStatus === "joined" && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Bot is in the meeting. Captions are being scraped and transcribed in real-time.</span>
          </div>
          <Button
            onClick={stopBot}
            variant="destructive"
            size="sm"
            className="text-xs h-7 gap-1"
          >
            <Power className="h-3 w-3" />
            Remove Bot
          </Button>
        </div>
      )}

      {message && botStatus === "error" && (
        <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      <p className="text-[10px] text-indigo-500 leading-snug">
        The bot opens a real Chrome window on your machine, joins Google Meet as "FlowMeet AI", and scrapes
        Google&apos;s free built-in captions. The meeting host will need to admit the bot. 
        100% free — no Recall.ai or paid APIs.
      </p>
    </div>
  )
}
