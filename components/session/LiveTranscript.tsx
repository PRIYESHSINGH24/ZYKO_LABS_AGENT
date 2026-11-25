"use client"

import { useEffect, useState, useRef } from "react"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import LiveSpeechRecorder from "./LiveSpeechRecorder"
import MeetingBotControl from "./MeetingBotControl"

export default function LiveTranscript({ sessionId, initialLines, defaultMeetingUrl, autoLaunch }: { sessionId: string, initialLines: any[], defaultMeetingUrl?: string, autoLaunch?: boolean }) {
  const [lines, setLines] = useState<any[]>(initialLines)
  const bottomRef = useRef<HTMLDivElement>(null)

  const [manualText, setManualText] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [lines])

  // Periodic poll to ensure lines synced without needing paid websockets
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/sessions/${sessionId}`)
        if (res.ok) {
          const data = await res.json()
          if (data.transcriptLines && data.transcriptLines.length !== lines.length) {
            setLines(data.transcriptLines)
          }
        }
      } catch (e) {}
    }, 4000)

    return () => clearInterval(interval)
  }, [sessionId, lines.length])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0")
    const s = Math.floor(seconds % 60).toString().padStart(2, "0")
    return `${m}:${s}`
  }

  const getSpeakerColor = (speaker: string) => {
    const colors = ["text-blue-600", "text-emerald-600", "text-purple-600", "text-amber-600", "text-pink-600"]
    const index = (speaker || "Default").split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
    return colors[index % colors.length]
  }

  const handleLineAdded = (newLine: any) => {
    setLines((prev) => [...prev, newLine])
  }

  const submitManualLine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualText.trim() || submitting) return;
    setSubmitting(true);
    
    const textToSend = manualText.trim();
    setManualText("");

    const res = await fetch(`/api/sessions/${sessionId}/transcript`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        speaker: "Notes / Manual", 
        text: textToSend, 
        timestamp: lines.length > 0 ? lines[lines.length - 1].timestamp + 3 : 0 
      })
    });

    if (res.ok) {
      const newLine = await res.json();
      setLines((prev) => [...prev, newLine]);
    }
    setSubmitting(false);
  };

  return (
    <Card className="flex flex-col h-full border border-gray-200 rounded-lg overflow-hidden shadow-xs">
      <CardHeader className="bg-gray-50/70 border-b p-3 shrink-0">
        <div className="flex justify-between items-center mb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <span>Meeting Transcript</span>
            <span className="text-xs font-normal text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              Live & Free
            </span>
          </CardTitle>
          <span className="text-xs text-gray-500 font-mono">
            {lines.length} {lines.length === 1 ? "line" : "lines"}
          </span>
        </div>
        
        {/* In-Browser Free Live Speech Recognition & Audio Recorder */}
        <LiveSpeechRecorder sessionId={sessionId} onTranscriptAdded={handleLineAdded} />
        <MeetingBotControl sessionId={sessionId} defaultMeetingUrl={defaultMeetingUrl || ""} autoLaunch={!!autoLaunch} />
      </CardHeader>
      
      <ScrollArea className="flex-1 p-4 bg-white">
        <div className="space-y-4 pb-4">
          {lines.length === 0 && (
            <div className="text-gray-400 text-sm text-center py-12 space-y-2">
              <p className="font-medium">No spoken transcript recorded yet.</p>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">
                Click <strong>"Start Free Live Listening"</strong> above to capture microphone or meeting speech in real-time, or paste meeting notes below!
              </p>
            </div>
          )}
          {lines.map((line, i) => (
            <div key={line.id || i} className="flex flex-col p-2.5 rounded-lg bg-gray-50/80 hover:bg-gray-100 transition-colors border border-gray-100">
              <div className="flex items-center justify-between mb-1">
                <span className={`font-semibold text-xs tracking-tight ${getSpeakerColor(line.speaker)}`}>
                  {line.speaker}
                </span>
                <span className="text-[11px] text-gray-400 font-mono">
                  {formatTime(line.timestamp || 0)}
                </span>
              </div>
              <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">{line.text}</p>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
      
      <div className="p-3 border-t bg-gray-50 shrink-0">
        <form onSubmit={submitManualLine} className="flex gap-2">
          <Textarea 
            placeholder="Type or paste quick note (Press Enter to send)..."
            className="min-h-[50px] max-h-[100px] resize-none text-xs"
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submitManualLine(e as any);
              }
            }}
          />
          <Button type="submit" disabled={!manualText.trim() || submitting} className="h-auto px-4 bg-gray-900 text-white">
            Send
          </Button>
        </form>
      </div>
    </Card>
  )
}
