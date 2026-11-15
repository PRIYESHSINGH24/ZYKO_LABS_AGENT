import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Folder, Video, FileText, ArrowLeft, Calendar, CheckSquare, Sparkles, Code2 } from "lucide-react"

const linkBtn = "inline-flex shrink-0 items-center justify-center rounded-lg text-sm font-medium whitespace-nowrap transition-all select-none h-8 gap-1.5 px-2.5"
const linkBtnOutline = `${linkBtn} border bg-white hover:bg-gray-100 text-gray-900`
const linkBtnPrimary = `${linkBtn} border-transparent`

export default async function ClientDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;

  const client = await prisma.client.findUnique({
    where: { id: params.id },
    include: {
      sessions: {
        orderBy: { meetingNumber: "desc" },
        include: {
          blueprint: true,
          actionItems: true,
          _count: {
            select: { transcriptLines: true }
          }
        }
      }
    }
  });

  if (!client) return notFound();

  const totalMeetings = client.sessions.length;
  const completedBlueprints = client.sessions.filter((s) => s.blueprint).length;
  const totalActionItems = client.sessions.reduce((acc, s) => acc + s.actionItems.length, 0);

  return (
    <div className="p-8 max-w-6xl mx-auto w-full space-y-8 pb-20">
      {/* Back button & Breadcrumb */}
      <div>
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to All Clients</span>
        </Link>
      </div>

      {/* Client Header Card */}
      <div className="bg-white border rounded-xl p-6 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-blue-50 text-blue-600">
              <Folder className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
              {client.company && (
                <p className="text-sm font-medium text-gray-500">{client.company}</p>
              )}
            </div>
          </div>
          {client.description && (
            <p className="text-sm text-gray-600 max-w-2xl leading-relaxed pt-1">
              {client.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/sessions/new?clientId=${client.id}`}
            className={`${linkBtnPrimary} bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-xs`}
          >
            <Video className="h-4 w-4" />
            Start Meeting #{totalMeetings + 1}
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 bg-white border">
          <div className="text-xs font-semibold uppercase text-gray-500">Total Client Meetings</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{totalMeetings}</div>
          <div className="text-xs text-gray-400 mt-1">Chronologically tracked</div>
        </Card>
        <Card className="p-4 bg-white border">
          <div className="text-xs font-semibold uppercase text-gray-500">Master Prompts Generated</div>
          <div className="text-2xl font-bold text-purple-600 mt-1">{completedBlueprints}</div>
          <div className="text-xs text-gray-400 mt-1">Ready for Cursor & Claude Code</div>
        </Card>
        <Card className="p-4 bg-white border">
          <div className="text-xs font-semibold uppercase text-gray-500">Extracted Action Items</div>
          <div className="text-2xl font-bold text-blue-600 mt-1">{totalActionItems}</div>
          <div className="text-xs text-gray-400 mt-1">Deliverables & tasks</div>
        </Card>
      </div>

      {/* Client Meetings Timeline */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <Calendar className="h-5 w-5 text-gray-500" />
          <span>Meetings & Prompts in this Workspace</span>
        </h3>

        {totalMeetings === 0 ? (
          <Card className="p-12 text-center border-dashed border-2 bg-gray-50/50">
            <Video className="h-10 w-10 text-gray-400 mx-auto mb-2" />
            <h4 className="font-semibold text-gray-800">No meetings recorded for {client.name} yet</h4>
            <p className="text-sm text-gray-500 max-w-md mx-auto mt-1 mb-4">
              Start your first meeting to transcribe live in your browser and automatically build a master coding prompt.
            </p>
            <Link
              href={`/sessions/new?clientId=${client.id}`}
              className={`${linkBtnPrimary} bg-emerald-600 text-white`}
            >
              Start Meeting #1
            </Link>
          </Card>
        ) : (
          <div className="space-y-4">
            {client.sessions.map((session) => (
              <Card key={session.id} className="p-5 border border-gray-200 hover:shadow-xs transition-shadow bg-white">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <Badge className="bg-blue-600 text-white text-xs px-2 py-0.5 font-mono">
                        Meeting #{session.meetingNumber}
                      </Badge>
                      <h4 className="font-bold text-base text-gray-900">{session.title}</h4>
                      <Badge variant={session.status === "COMPLETE" ? "default" : "secondary"} className="text-[11px]">
                        {session.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500 font-mono">
                      <span>{new Date(session.createdAt).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>{session._count.transcriptLines} transcript lines</span>
                      <span>•</span>
                      <span>{session.actionItems.length} action items</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Link
                      href={`/sessions/${session.id}`}
                      className={`${linkBtnOutline} text-xs h-8 flex-1 sm:flex-initial`}
                    >
                      Open Meeting Room
                    </Link>
                    {session.blueprint && (
                      <Link
                        href={`/blueprints/${session.id}`}
                        className={`${linkBtnPrimary} bg-purple-600 hover:bg-purple-700 text-white text-xs h-8 gap-1.5 flex-1 sm:flex-initial`}
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Master Prompt #{session.meetingNumber}
                      </Link>
                    )}
                  </div>
                </div>

                {/* Summary / Decisions Preview */}
                <div className="pt-3 text-xs text-gray-600 space-y-2">
                  {session.blueprint?.summary ? (
                    <div>
                      <span className="font-semibold text-gray-700">Decisions: </span>
                      <span>
                        {Array.isArray((session.blueprint.summary as any)?.decisions)
                          ? (session.blueprint.summary as any).decisions.join(", ")
                          : "Requirements extracted"}
                      </span>
                    </div>
                  ) : (
                    <div className="text-gray-400 italic">
                      No blueprint generated yet. Open meeting room to record or paste transcript.
                    </div>
                  )}

                  {session.actionItems.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {session.actionItems.slice(0, 3).map((item, idx) => (
                        <span key={idx} className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-[11px]">
                          ✓ {item.text}
                        </span>
                      ))}
                      {session.actionItems.length > 3 && (
                        <span className="text-gray-400 text-[11px] self-center">
                          +{session.actionItems.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
