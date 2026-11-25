import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import Link from "next/link"
import LiveTranscript from "@/components/session/LiveTranscript"
import AnalysisSidebar from "@/components/session/AnalysisSidebar"
import EndSessionButton from "@/components/session/EndSessionButton"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Folder } from "lucide-react"

export default async function SessionPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;

  const session = await prisma.session.findUnique({
    where: { id: params.id },
    include: {
      client: true,
      transcriptLines: { orderBy: { timestamp: "asc" } },
      blueprint: true,
      actionItems: true,
    }
  })

  if (!session) return notFound()

  return (
    <div className="h-[calc(100vh-73px)] flex flex-col pt-3">
      {/* Top Header */}
      <div className="px-6 pb-3 flex justify-between items-center shrink-0 border-b bg-white">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            {session.client ? (
              <Link href={`/clients/${session.client.id}`} className="hover:underline flex items-center gap-1 text-blue-600 font-medium">
                <Folder className="h-3 w-3" />
                <span>{session.client.name}</span>
              </Link>
            ) : (
              <span>{session.clientName}</span>
            )}
            <span>/</span>
            <span className="font-mono text-gray-400">Meeting #{session.meetingNumber}</span>
          </div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-gray-900">{session.title}</h2>
            <Badge variant={session.status === "COMPLETE" ? "default" : "secondary"} className="text-xs">
              {session.status}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {session.blueprint && (
            <Link
              href={`/blueprints/${session.id}`}
              className="text-xs px-3 py-1.5 rounded-md bg-purple-50 text-purple-700 hover:bg-purple-100 font-medium transition-colors border border-purple-200"
            >
              View Master Prompt
            </Link>
          )}
          <EndSessionButton sessionId={session.id} />
        </div>
      </div>

      {/* Main Grid: Left is Live Transcript + Free Speech Recorder; Right is Real-time AI Analysis */}
      <div className="flex-1 flex overflow-hidden p-4 gap-4 bg-gray-50/50">
        <div className="w-7/12 h-full flex flex-col">
          <LiveTranscript sessionId={session.id} initialLines={session.transcriptLines} defaultMeetingUrl={session.meetingUrl || ""} autoLaunch={!!session.meetingUrl} />
        </div>
        <div className="w-5/12 h-full flex flex-col">
          <AnalysisSidebar 
            sessionId={session.id} 
            initialBlueprint={session.blueprint || {}} 
            initialActionItems={session.actionItems || []} 
          />
        </div>
      </div>
    </div>
  )
}
