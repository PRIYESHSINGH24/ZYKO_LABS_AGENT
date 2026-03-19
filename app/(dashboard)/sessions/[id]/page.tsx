import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import LiveTranscript from "@/components/session/LiveTranscript"
import AnalysisSidebar from "@/components/session/AnalysisSidebar"
import { Button } from "@/components/ui/button"
import EndSessionButton from "@/components/session/EndSessionButton"

export default async function SessionPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;

  const session = await prisma.session.findUnique({
    where: { id: params.id },
    include: {
      transcriptLines: { orderBy: { timestamp: "asc" } },
      blueprint: true,
      actionItems: true,
    }
  })

  if (!session) return notFound()

  return (
    <div className="h-[calc(100vh-73px)] flex flex-col pt-4">
      <div className="px-6 pb-4 flex justify-between items-center shrink-0">
        <div>
          <h2 className="text-2xl font-bold">{session.title}</h2>
          <p className="text-gray-500">{session.clientName}</p>
        </div>
        <EndSessionButton sessionId={session.id} />
      </div>

      <div className="flex-1 flex overflow-hidden px-6 pb-6 gap-4">
        <div className="w-7/12 h-full">
          <LiveTranscript sessionId={session.id} initialLines={session.transcriptLines} />
        </div>
        <div className="w-5/12 h-full">
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
