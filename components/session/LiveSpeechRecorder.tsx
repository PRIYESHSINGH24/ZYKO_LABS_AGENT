"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Mic, MicOff, Globe, Volume2, Upload, FileText, CheckCircle2 } from "lucide-react"

interface Props {
  sessionId: string
  onTranscriptAdded?: (line: any) => void
}

export default function LiveSpeechRecorder({ sessionId, onTranscriptAdded }: Props) {
  const [isListening, setIsListening] = useState(false)
  const [language, setLanguage] = useState("en-US")
  const [speakerName, setSpeakerName] = useState("Client / Speaker")
  const [interimText, setInterimText] = useState("")
  const [supported, setSupported] = useState(true)
  const [errorMsg, setErrorMsg] = useState("")

  // Paste mode
  const [showPaste, setShowPaste] = useState(false)
  const [pasteContent, setPasteContent] = useState("")
  const [isPasting, setIsPasting] = useState(false)

  // Audio Recording (Free MediaRecorder)
  const [isAudioRecording, setIsAudioRecording] = useState(false)
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const recognitionRef = useRef<any>(null)
  const isListeningRef = useRef(false)
  isListeningRef.current = isListening

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setSupported(false)
    }
  }, [])

  const startListening = () => {
    setErrorMsg("")
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

    if (!SpeechRecognition) {
      setErrorMsg("Web Speech API not supported in this browser. Please use Chrome, Edge, or Brave.")
      return
    }

    try {
      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = language

      recognition.onstart = () => {
        setIsListening(true)
      }

      recognition.onresult = async (event: any) => {
        let interim = ""
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcriptChunk = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            const trimmed = transcriptChunk.trim()
            if (trimmed.length > 0) {
              await sendTranscriptLine(trimmed)
            }
          } else {
            interim += transcriptChunk
          }
        }
        setInterimText(interim)
      }

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error)
        if (event.error === "not-allowed") {
          setErrorMsg("Microphone permission denied. Please allow microphone access.")
          setIsListening(false)
        }
      }

      recognition.onend = () => {
        // Auto restart if still marked as listening
        if (isListeningRef.current) {
          try {
            recognition.start()
          } catch (e) {
            console.log("Recognition restart note:", e)
          }
        } else {
          setIsListening(false)
        }
      }

      recognition.start()
      recognitionRef.current = recognition
      setIsListening(true)
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to start speech recognition.")
      setIsListening(false)
    }
  }

  const stopListening = () => {
    setIsListening(false)
    isListeningRef.current = false
    setInterimText("")
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch (e) {}
    }
  }

  const sendTranscriptLine = async (text: string) => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/transcript`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          speaker: speakerName || "Speaker",
          text,
          timestamp: Date.now() / 1000,
        }),
      })
      if (res.ok) {
        const line = await res.json()
        onTranscriptAdded?.(line)
      }
    } catch (err) {
      console.error("Failed to save transcript line:", err)
    }
  }

  // Audio Recording via free MediaRecorder
  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      audioChunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" })
        const url = URL.createObjectURL(audioBlob)
        setRecordedUrl(url)
      }

      recorder.start(1000)
      mediaRecorderRef.current = recorder
      setIsAudioRecording(true)
    } catch (e: any) {
      setErrorMsg("Could not access microphone for audio recording: " + e.message)
    }
  }

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop())
    }
    setIsAudioRecording(false)
  }

  // Bulk Paste Notes / Transcript
  const handleBulkPaste = async () => {
    if (!pasteContent.trim() || isPasting) return
    setIsPasting(true)
    const lines = pasteContent
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0)

    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i]
      // Check if speaker prefix exists (e.g. "John: hello")
      let speaker = speakerName || "Client"
      let text = lineText
      const match = lineText.match(/^([^:]+):\s*(.+)$/)
      if (match) {
        speaker = match[1].trim()
        text = match[2].trim()
      }

      await fetch(`/api/sessions/${sessionId}/transcript`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          speaker,
          text,
          timestamp: i * 5,
        }),
      })
    }

    setPasteContent("")
    setIsPasting(false)
    setShowPaste(false)
    window.location.reload()
  }

  return (
    <Card className="p-4 bg-white border border-gray-200 shadow-xs rounded-lg space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {isListening ? (
            <Button
              onClick={stopListening}
              variant="destructive"
              size="sm"
              className="gap-2 animate-pulse"
            >
              <MicOff className="h-4 w-4" /> Stop Live Listening
            </Button>
          ) : (
            <Button
              onClick={startListening}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              <Mic className="h-4 w-4" /> Start Free Live Listening
            </Button>
          )}

          {isAudioRecording ? (
            <Button onClick={stopAudioRecording} variant="outline" size="sm" className="gap-2 text-red-600 border-red-300">
              <span className="h-2 w-2 rounded-full bg-red-600 animate-ping" /> Stop Recording Audio
            </Button>
          ) : (
            <Button onClick={startAudioRecording} variant="outline" size="sm" className="gap-2 text-gray-700">
              <Volume2 className="h-4 w-4" /> Record Free Audio (Local)
            </Button>
          )}

          <Button
            onClick={() => setShowPaste(!showPaste)}
            variant="outline"
            size="sm"
            className="gap-2 text-gray-700"
          >
            <FileText className="h-4 w-4" /> {showPaste ? "Close Notes Paste" : "Paste Notes / Transcript"}
          </Button>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <Globe className="h-3.5 w-3.5 text-gray-400" />
          <select
            value={language}
            onChange={(e) => {
              setLanguage(e.target.value)
              if (isListening) {
                stopListening()
                setTimeout(startListening, 300)
              }
            }}
            className="border rounded px-2 py-1 bg-white text-gray-700 font-medium"
          >
            <option value="en-US">English (US)</option>
            <option value="en-IN">English (India)</option>
            <option value="hi-IN">Hindi (हिंदी)</option>
            <option value="es-ES">Spanish</option>
            <option value="fr-FR">French</option>
            <option value="de-DE">German</option>
          </select>

          <input
            type="text"
            placeholder="Speaker tag"
            value={speakerName}
            onChange={(e) => setSpeakerName(e.target.value)}
            className="border rounded px-2 py-1 w-28 text-gray-700"
          />
        </div>
      </div>

      {interimText && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded p-2.5 text-sm italic flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
          <span>Hearing: "{interimText}"</span>
        </div>
      )}

      {recordedUrl && (
        <div className="flex items-center justify-between bg-gray-50 border rounded p-2 text-xs">
          <span className="font-medium text-gray-700">Audio Recorded Locally (100% Free):</span>
          <audio controls src={recordedUrl} className="h-7 max-w-xs" />
        </div>
      )}

      {errorMsg && (
        <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
          {errorMsg}
        </div>
      )}

      {showPaste && (
        <div className="pt-2 border-t space-y-2">
          <div className="text-xs font-semibold text-gray-700">
            Paste Full Meeting Transcript or Raw Notes (Auto-parsed instantly):
          </div>
          <Textarea
            rows={5}
            placeholder="Paste your meeting notes, Otter/Zoom transcript, or bullet points here..."
            value={pasteContent}
            onChange={(e) => setPasteContent(e.target.value)}
            className="text-xs font-mono"
          />
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              disabled={isPasting || !pasteContent.trim()}
              onClick={handleBulkPaste}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isPasting ? "Parsing..." : "Add to Transcript"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
