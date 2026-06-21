import { redirect } from "next/navigation"

interface PageProps {
  params: Promise<{
    id: string
  }>
}

export default async function ReviewPage({ params }: PageProps) {
  const { id } = await params
  redirect(`/question/${id}/review/1`)
}