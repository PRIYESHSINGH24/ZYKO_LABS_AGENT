"use client"

import { useEffect, useState, useRef } from "react"
import { createClient } from "@supabase/supabase-js"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"

const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL 
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "anon"
    )
  : null;

export default function LiveTranscript({ sessionId, initialLines }: { sessionId: string, initialLines: any[] }) {
  const [lines, setLines] = useState<any[]>(initialLines)
  const bottomRef = useRef<HTMLDivElement>(null)

  const [manualText, setManualText] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [lines])

  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel("transcript_changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "TranscriptLine",
          filter: `sessionId=eq.${sessionId}`,
        },
        (payload) => {
          setLines((prev) => [...prev, payload.new])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0")
    const s = Math.floor(seconds % 60).toString().padStart(2, "0")
    return `${m}:${s}`
  }

  const getSpeakerColor = (speaker: string) => {
    const colors = ["text-blue-600", "text-green-600", "text-purple-600", "text-orange-600", "text-pink-600"]
    const index = speaker.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
    return colors[index % colors.length]
  }

  const submitManualLine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualText.trim() || submitting) return;
    setSubmitting(true);
    
    await fetch(`/api/sessions/${sessionId}/transcript`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        speaker: "Manual Upload", 
        text: manualText, 
        timestamp: lines.length > 0 ? lines[lines.length - 1].timestamp + 5 : 0 
      })
    });
    setManualText("");
    setSubmitting(false);
  };

  return (
    <Card className="flex flex-col h-full border-r-0 rounded-r-none rounded-l-md overflow-hidden">
      <CardHeader className="bg-gray-50 border-b pb-4 shrink-0">
        <CardTitle className="text-lg flex justify-between items-center">
          <span>Live Transcript</span>
          <span className="text-sm font-normal items-center flex text-green-600">
            <span className="h-2 w-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
            Active
          </span>
        </CardTitle>
      </CardHeader>
      
      <ScrollArea className="flex-1 p-6">
        <div className="space-y-6 pb-4">
          {lines.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-10 italic">
              No transcript lines yet. The bot will automatically stream them here, or you can paste notes manually below!
            </p>
          )}
          {lines.map((line, i) => (
            <div key={line.id || i} className="flex flex-col group cursor-pointer hover:bg-gray-100 p-2 -mx-2 rounded transition-colors">
              <div className="flex items-center gap-2 mb-1">
                <span className={`font-semibold text-sm ${getSpeakerColor(line.speaker)}`}>
                  {line.speaker}
                </span>
                <span className="text-xs text-gray-400">
                  {formatTime(line.timestamp)}
                </span>
              </div>
              <p className="text-gray-800 text-sm leading-relaxed">{line.text}</p>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
      
      <div className="p-4 border-t bg-gray-50 shrink-0">
        <form onSubmit={submitManualLine} className="flex gap-2">
          <Textarea 
            placeholder="Paste manual transcript line or context here..."
            className="min-h-[60px] resize-none"
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submitManualLine(e as any);
              }
            }}
          />
          <Button type="submit" disabled={!manualText.trim() || submitting} className="h-full min-h-[60px]">
            Send
          </Button>
        </form>
      </div>
    </Card>
  )
}
