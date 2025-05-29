'use client'

import { User } from '@supabase/supabase-js'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { createClient } from '@/lib/supabase/client'

import { Button } from './ui/button'

export default function TopBar() {
  const [user, setUser] = useState<User | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUser(user)
    }

    getUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase.auth])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <div className="flex items-center justify-between p-4">
      <div>
        <Link href="/">
          <h1 className="text-xl font-bold">Austen</h1>
        </Link>
        <small>Discover Story Relationships</small>
      </div>
      <nav className="flex items-center gap-4">
        <Link
          href="https://github.com/herol3oy/austen"
          target="_blank"
          className="hover:underline"
          rel="noopener noreferrer"
        >
          Github
        </Link>
        {user ? (
          <>
            <span className="text-muted-foreground text-sm">{user.email}</span>
            <Link href="/dashboard" className="hover:underline">
              Dashboard
            </Link>
            <Button
              variant="ghost"
              onClick={handleSignOut}
              className="hover:underline"
            >
              Sign out
            </Button>
          </>
        ) : (
          <Link href="/auth/login" className="hover:underline">
            Login
          </Link>
        )}
      </nav>
    </div>
  )
}
