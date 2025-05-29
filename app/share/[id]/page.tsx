import { notFound } from 'next/navigation'

import { MermaidGraphCard } from '@/components/MermaidGraphCard'
import { createClient } from '@/lib/supabase/server'

export default async function ShareGraphPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: graph } = await supabase
    .from('graphs')
    .select('*')
    .eq('id', id)
    .single()

  if (!graph) {
    notFound()
  }

  return (
    <div className="container mx-auto p-4">
      <MermaidGraphCard
        title={graph.book_name}
        author={graph.author_name}
        graphDefinition={graph.mermaid_syntax}
        emojis={graph.emojis}
        graphId={id}
      />
    </div>
  )
}
