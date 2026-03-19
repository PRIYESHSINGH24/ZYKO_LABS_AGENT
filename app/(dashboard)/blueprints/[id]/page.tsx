import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import BlueprintViewer from "@/components/blueprint/BlueprintViewer"

export default async function BlueprintPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;

  const session = await prisma.session.findUnique({
    where: { id: params.id },
    include: { blueprint: true }
  })
  
  if (!session || !session.blueprint) return notFound()

  return (
    <div className="p-8 max-w-5xl mx-auto w-full pb-20">
      <BlueprintViewer blueprint={session.blueprint} />
    </div>
  )
}
