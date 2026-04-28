'use server'

import { createClient } from '@/lib/supabase/server'
import { SaveGraphParams } from '@/types/save-graph-params'

export const saveGraph = async ({
  bookName,
  authorName,
  svgGraph,
  mermaidSyntax,
  emojis,
  isPublic = false,
}: SaveGraphParams & { isPublic?: boolean }) => {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const graphId = crypto.randomUUID()

  try {
    const { error } = await supabase.from('graphs').insert([
      {
        id: graphId,
        book_name: bookName,
        author_name: authorName,
        svg_graph: svgGraph,
        mermaid_syntax: mermaidSyntax,
        emojis,
        user_id: user?.id ?? null,
        is_public: isPublic,
      },
    ])

    if (error) throw error
  } catch (err) {
    console.error('Error saving graph:', err)
    throw err
  }

  return { graphId }
}
