'use server'

import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { SaveGraphParams } from '@/types/save-graph-params'

export const saveGraph = async ({
  bookName,
  authorName,
  svgGraph,
  mermaidSyntax,
  emojis,
}: SaveGraphParams) => {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('User must be logged in to save graphs')
  }

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
        user_id: user.id,
        is_public: false,
      },
    ])

    if (error) throw error
  } catch (err) {
    console.error('Error saving graph:', err)
    throw err
  }

  redirect(`/share/${graphId}`)
}
