"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Sparkles, CheckCircle, RefreshCw, FileCode } from "lucide-react"

export default function AnalysisSidebar({ 
  sessionId, 
  initialBlueprint, 
  initialActionItems 
}: { 
  sessionId: string, 
  initialBlueprint: any, 
  initialActionItems: any[] 
}) {
  const router = useRouter()
  const [blueprint, setBlueprint] = useState<any>(initialBlueprint)
  const [actionItems, setActionItems] = useState<any[]>(initialActionItems)
  const [analyzing, setAnalyzing] = useState(false)
  const [generatingFinal, setGeneratingFinal] = useState(false)

  const triggerAnalysis = async () => {
    setAnalyzing(true)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/analyze`, { method: "POST" })
      if (res.ok) {
        const data = await res.json()
        if (data.blueprint) setBlueprint(data.blueprint)
        if (data.actionItems) setActionItems(data.actionItems)
      }
    } catch (e) {
      console.error("Analysis error:", e)
    } finally {
      setAnalyzing(false)
    }
  }

  const handleGenerateFinal = async () => {
    setGeneratingFinal(true)
    try {
      const res = await fetch("/api/blueprints/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      })
      if (res.ok) {
        router.push(`/blueprints/${sessionId}`)
      }
    } catch (e) {
      console.error("Generate error:", e)
    } finally {
      setGeneratingFinal(false)
    }
  }

  const confCard = (label: string, val: number | undefined) => (
    <div className="flex items-center justify-between text-xs">
      <span className="text-gray-600">{label}</span>
      <div className="flex items-center gap-2 w-1/2">
        <Progress value={val || 0} className="flex-1 h-1.5" />
        <span className="w-8 text-right text-[11px] font-semibold text-gray-700">{val || 0}%</span>
      </div>
    </div>
  )

  return (
    <Card className="flex flex-col h-full border border-gray-200 rounded-lg overflow-hidden shadow-xs">
      <CardHeader className="bg-gray-50/70 border-b p-4 shrink-0 space-y-3">
        <div className="flex justify-between items-center">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-600" />
            <span>AI Meeting Intelligence</span>
          </CardTitle>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={triggerAnalysis} 
            disabled={analyzing}
            className="text-xs h-8 gap-1.5"
          >
            <RefreshCw className={`h-3 w-3 ${analyzing ? "animate-spin" : ""}`} />
            {analyzing ? "Extracting..." : "Extract Insights"}
          </Button>
        </div>

        <Button
          onClick={handleGenerateFinal}
          disabled={generatingFinal}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium text-xs h-9 gap-2 shadow-xs"
        >
          <FileCode className="h-4 w-4" />
          {generatingFinal ? "Generating Master Prompt..." : "Finish & Generate Master Prompt"}
        </Button>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-y-auto p-4 space-y-6 bg-white">
        {/* Confidence Scores */}
        <div className="space-y-2.5 bg-gray-50/60 p-3 rounded-lg border border-gray-100">
          <h3 className="font-semibold text-xs uppercase text-gray-500 tracking-wider">Blueprint Confidence</h3>
          {confCard("Requirements", blueprint?.confidence?.requirements)}
          {confCard("User Flows", blueprint?.confidence?.userFlows)}
          {confCard("Tech Context", blueprint?.confidence?.techContext)}
          {confCard("Data Model", blueprint?.confidence?.dataModel)}
        </div>

        {/* Project Overview */}
        <div className="space-y-2">
          <h3 className="font-semibold text-xs uppercase text-gray-500 tracking-wider">Project Scope & Overview</h3>
          <p className="text-xs text-gray-700 leading-relaxed bg-gray-50/60 p-3 rounded-lg border border-gray-100">
            {blueprint?.summary?.overview || "Click 'Extract Insights' or 'Start Free Live Listening' to capture meeting points."}
          </p>
        </div>

        {/* Action Items */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-xs uppercase text-gray-500 tracking-wider">Action Items</h3>
            <span className="text-[11px] text-gray-400 font-mono">{actionItems.length} items</span>
          </div>

          {actionItems?.length === 0 ? (
            <p className="text-xs text-gray-400 italic bg-gray-50/40 p-3 rounded border text-center">
              No action items detected yet.
            </p>
          ) : (
            <div className="space-y-2">
              {actionItems?.map((item, i) => (
                <div key={i} className="bg-gray-50 p-2.5 rounded-lg border border-gray-100 text-xs flex items-start gap-2">
                  <Badge 
                    variant={item.priority === "HIGH" ? "destructive" : "secondary"} 
                    className="shrink-0 text-[10px] px-1.5 py-0"
                  >
                    {item.priority}
                  </Badge>
                  <div className="flex-1">
                    {item.owner && <span className="font-semibold mr-1 text-gray-900">{item.owner}:</span>}
                    <span className="text-gray-700">{item.text}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
