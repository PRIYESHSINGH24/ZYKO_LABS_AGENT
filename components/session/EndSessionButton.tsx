"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

export default function EndSessionButton({ sessionId }: { sessionId: string }) {
  const [ending, setEnding] = useState(false)
  const router = useRouter()

  const handleEnd = async () => {
    setEnding(true)
    try {
      const res = await fetch("/api/blueprints/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId })
      })
      
      if (res.ok) {
        router.push(`/blueprints/${sessionId}`)
      } else {
        const errorData = await res.json().catch(() => ({ error: "Unknown error" }))
        alert(errorData.error || "Generation failed. Please try again.")
        setEnding(false)
      }
    } catch (e) {
      alert("Network error. Please wait and try again.")
      setEnding(false)
    }
  }

  return (
    <Button 
      variant="destructive" 
      onClick={handleEnd} 
      disabled={ending}
    >
      {ending ? "Analyzing & Generating... (Please wait ~15s)" : "End Meeting & Generate Blueprint"}
    </Button>
  )
}
