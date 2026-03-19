"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"

export default function BlueprintViewer({ blueprint }: { blueprint: any }) {

  const renderString = (val: any) => {
    if (!val) return "";
    if (typeof val === 'string') return val;
    return val.name || val.title || val.text || JSON.stringify(val);
  };

  const copyPrompt = () => {
    navigator.clipboard.writeText(blueprint.fullPrompt || "")
    alert("Copied to clipboard!")
  }

  const exportMarkdown = async () => {
    const res = await fetch("/api/blueprints/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blueprintId: blueprint.id, destination: "markdown" }),
    })
    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `blueprint-${blueprint.sessionId}.md`
    a.click()
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">App Blueprint</h2>
          <div className="flex gap-4 mt-2 text-sm text-gray-500">
            <span>Reqs Confidence: {blueprint.confidence?.requirements || 0}%</span>
            <span>Flows Confidence: {blueprint.confidence?.userFlows || 0}%</span>
            <span>Tech Confidence: {blueprint.confidence?.techContext || 0}%</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportMarkdown}>Export Markdown</Button>
          <Button onClick={copyPrompt}>Copy Master Prompt</Button>
        </div>
      </div>

      <Tabs defaultValue="summary" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="requirements">Requirements</TabsTrigger>
          <TabsTrigger value="userFlows">User Flows</TabsTrigger>
          <TabsTrigger value="techSpec">Tech Spec</TabsTrigger>
        </TabsList>
        
        <TabsContent value="summary" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Project Summary</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-sm">Overview</h4>
                  <p className="text-gray-700">{blueprint.summary?.overview}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm">Decisions</h4>
                  <ul className="list-disc pl-5 text-gray-700">
                    {blueprint.summary?.decisions?.map((d: any, i: number) => <li key={i}>{renderString(d)}</li>)}
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-sm">Out of Scope</h4>
                  <ul className="list-disc pl-5 text-gray-700">
                    {blueprint.summary?.outOfScope?.map((d: any, i: number) => <li key={i}>{renderString(d)}</li>)}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requirements" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Requirements</CardTitle></CardHeader>
            <CardContent>
              {['p0', 'p1', 'p2'].map(p => (
                <div key={p} className="mb-6">
                  <h4 className="font-bold uppercase text-sm mb-2">{p}</h4>
                  <div className="space-y-4">
                    {blueprint.requirements?.[p]?.map((req: any, i: number) => (
                      <div key={i} className="bg-gray-50 p-4 border rounded">
                        <h5 className="font-semibold">{req.title}</h5>
                        <p className="text-sm text-gray-600 mt-1">{req.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="userFlows" className="mt-4">
          <Card>
            <CardHeader><CardTitle>User Flows & Screens</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-bold mb-3">Key Screens</h4>
                <div className="flex gap-2 flex-wrap">
                  {blueprint.userFlows?.screens?.map((scr: any, i: number) => (
                    <span key={i} className="bg-blue-100 text-blue-800 px-3 py-1 rounded text-sm">{renderString(scr)}</span>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <h4 className="font-bold">Flows</h4>
                {blueprint.userFlows?.flows?.map((flow: any, i: number) => (
                  <div key={i} className="border p-4 rounded">
                    <h5 className="font-semibold">{renderString(flow.name)} <span className="text-sm font-normal text-gray-500">Actor: {renderString(flow.actor)}</span></h5>
                    <ol className="list-decimal pl-5 mt-2 text-sm text-gray-700 space-y-1">
                      {flow.steps?.map((step: any, si: number) => <li key={si}>{renderString(step)}</li>)}
                    </ol>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="techSpec" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Technical Specification</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="font-bold mb-2">Frontend Stack</h4>
                  <ul className="list-disc pl-5 text-sm text-gray-700">
                     {blueprint.techSpec?.recommended?.frontend?.map((item: any, i: number) => <li key={i}>{renderString(item)}</li>) ||
                      blueprint.techSpec?.frontend?.map((item: any, i: number) => <li key={i}>{renderString(item)}</li>)}
                  </ul>
                </div>
                <div>
                  <h4 className="font-bold mb-2">Backend Stack</h4>
                  <ul className="list-disc pl-5 text-sm text-gray-700">
                     {blueprint.techSpec?.recommended?.backend?.map((item: any, i: number) => <li key={i}>{renderString(item)}</li>) ||
                      blueprint.techSpec?.backend?.map((item: any, i: number) => <li key={i}>{renderString(item)}</li>)}
                  </ul>
                </div>
              </div>
              <div>
                 <h4 className="font-bold mb-3">Data Model</h4>
                 <div className="space-y-4">
                   {blueprint.techSpec?.dataModel?.map((mod: any, i: number) => (
                     <div key={i} className="bg-gray-50 border p-4 rounded font-mono text-sm">
                       <span className="font-bold text-purple-600">model</span> {mod.model || mod.name} {"{"}
                       <div className="pl-4 text-gray-600">
                          {mod.fields?.map((f: any, fi: number) => <div key={fi}>{renderString(f)}</div>)}
                       </div>
                       {"}"}
                     </div>
                   ))}
                   {!blueprint.techSpec?.dataModel && blueprint.techSpec?.dataEntities?.map((ent: any, i: number) => (
                     <span key={i} className="inline-block bg-gray-100 p-1 px-2 rounded text-sm mr-2 mb-2">{renderString(ent)}</span>
                   ))}
                 </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Master Developer Prompt</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-gray-900 text-green-400 p-4 rounded-md overflow-x-auto text-sm border font-mono whitespace-pre-wrap">
            {blueprint.fullPrompt || "Final blueprint prompt will appear here once meeting finishes..."}
          </pre>
        </CardContent>
      </Card>
    </div>
  )
}
