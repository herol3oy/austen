'use server'

import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

export const deleteGraphAction = async (graphId: string) => {
  if (!graphId) {
    throw new Error('Graph ID is required')
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('User must be logged in to delete graphs')
  }

  const { error } = await supabase
    .from('graphs')
    .delete()
    .eq('id', graphId)
    .eq('user_id', user.id)

  if (error) {
    console.error(`Failed to delete graph with ID ${graphId}:`, error)
    throw new Error('Could not delete graph')
  }

  redirect('/dashboard')
}
