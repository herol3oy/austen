'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'

export const deleteGraph = async (graphId: string) => {
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
    throw error
  }

  revalidatePath('/dashboard')
  return { success: true }
}
