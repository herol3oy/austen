'use server'

import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

interface SaveGraphParams {
  bookName: string
  authorName: string
  svgGraph: string
  mermaidSyntax: string
  emojis: string
}

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

  const { error } = await supabase.from('graphs').insert([
    {
      id: graphId,
      book_name: bookName,
      author_name: authorName,
      svg_graph: svgGraph,
      mermaid_syntax: mermaidSyntax,
      emojis: emojis,
      user_id: user.id,
      is_public: false,
    },
  ])

  if (error) {
    console.error('Error saving graph:', error)
    throw error
  }

  redirect(`/share/${graphId}`)
}
