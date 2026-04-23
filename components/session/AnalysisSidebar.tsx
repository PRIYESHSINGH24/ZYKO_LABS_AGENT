"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"

export default function AnalysisSidebar({ 
  sessionId, 
  initialBlueprint, 
  initialActionItems 
}: { 
  sessionId: string, 
  initialBlueprint: any, 
  initialActionItems: any[] 
}) {
  const [blueprint, setBlueprint] = useState<any>(initialBlueprint)
  const [actionItems, setActionItems] = useState<any[]>(initialActionItems)
  const [analyzing, setAnalyzing] = useState(false)
  
  const triggerAnalysis = async () => {
    setAnalyzing(true)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/analyze`, { method: "POST" })
      const data = await res.json()
      if (data.blueprint) setBlueprint(data.blueprint)
      if (data.actionItems) setActionItems(data.actionItems)
    } finally {
      setAnalyzing(false)
    }
  }

  // Auto-analyze every 2 minutes
  useEffect(() => {
    const interval = setInterval(triggerAnalysis, 30000) // Poll every 30s to conserve API Quota
    return () => clearInterval(interval)
  }, [sessionId])

  const confCard = (label: string, val: number | undefined) => (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-600">{label}</span>
      <div className="flex items-center gap-2 w-1/2">
        <Progress value={val || 0} className="flex-1 h-2" />
        <span className="w-8 text-right text-xs font-semibold">{val || 0}%</span>
      </div>
    </div>
  )

  return (
    <Card className="flex flex-col h-full rounded-l-none overflow-hidden max-h-screen">
      <CardHeader className="bg-gray-50 border-b pb-4 shrink-0">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">Real-time Analysis</CardTitle>
          <Button size="sm" variant="outline" onClick={triggerAnalysis} disabled={analyzing}>
            {analyzing ? "Analyzing..." : "Analyze Now"}
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-y-auto p-6 space-y-8">
        <div className="space-y-3">
          <h3 className="font-semibold text-sm uppercase text-gray-500 tracking-wider">Confidence Scores</h3>
          {confCard("Requirements", blueprint?.confidence?.requirements)}
          {confCard("User Flows", blueprint?.confidence?.userFlows)}
          {confCard("Tech Context", blueprint?.confidence?.techContext)}
          {confCard("Data Model", blueprint?.confidence?.dataModel)}
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold text-sm uppercase text-gray-500 tracking-wider">Project Overview</h3>
          <p className="text-sm text-gray-700 leading-relaxed">
            {blueprint?.summary?.overview || "Waiting for more context..."}
          </p>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold text-sm uppercase text-gray-500 tracking-wider">Action Items</h3>
          {actionItems?.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No action items detected yet.</p>
          ) : (
            <div className="space-y-2">
              {actionItems?.map((item, i) => (
                <div key={i} className="bg-gray-50 p-3 rounded-md border text-sm flex gap-2">
                  <Badge variant={item.priority === "HIGH" ? "destructive" : "secondary"} className="shrink-0 h-min">
                    {item.priority}
                  </Badge>
                  <div>
                    <span className="font-medium mr-1">{item.owner ? `${item.owner}:` : ""}</span> 
                    {item.text}
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
