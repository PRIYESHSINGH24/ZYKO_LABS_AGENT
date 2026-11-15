import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import Link from "next/link"
import BlueprintViewer from "@/components/blueprint/BlueprintViewer"
import { ArrowLeft, Folder, Video } from "lucide-react"

export default async function BlueprintPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;

  const session = await prisma.session.findUnique({
    where: { id: params.id },
    include: { 
      blueprint: true,
      client: true,
    }
  })
  
  if (!session || !session.blueprint) return notFound()

  return (
    <div className="p-8 max-w-5xl mx-auto w-full pb-20 space-y-6">
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <Link href="/" className="inline-flex items-center gap-1 hover:text-gray-900 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>All Clients</span>
        </Link>
        {session.client && (
          <>
            <span>/</span>
            <Link href={`/clients/${session.client.id}`} className="hover:underline flex items-center gap-1 text-blue-600 font-medium">
              <Folder className="h-3 w-3" />
              <span>{session.client.name}</span>
            </Link>
          </>
        )}
        <span>/</span>
        <Link href={`/sessions/${session.id}`} className="hover:underline flex items-center gap-1 text-gray-600">
          <Video className="h-3 w-3" />
          <span>Meeting #{session.meetingNumber}: {session.title}</span>
        </Link>
      </div>

      <BlueprintViewer blueprint={session.blueprint} />
    </div>
  )
}
