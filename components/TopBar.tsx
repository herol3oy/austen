'use client'

import { User } from '@supabase/supabase-js'
import { ChevronDown } from 'lucide-react'
import { GitMerge } from 'lucide-react'
import { Star } from 'lucide-react'
import { LayoutDashboard } from 'lucide-react'
import { LogOut } from 'lucide-react'
import { Menu } from 'lucide-react'
import { X } from 'lucide-react'
import { Plus } from 'lucide-react'
import { UserCircle } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { GITHUB_REPO_URL } from '@/consts/github-repo-url'
import { createClient } from '@/lib/supabase/client'

export function TopBar() {
  const [user, setUser] = useState<User | null>(null)
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false)
  const [starCount, setStarCount] = useState<number | null>(null)

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

  useEffect(() => {
    const fetchStarCount = async () => {
      try {
        const response = await fetch(GITHUB_REPO_URL)
        if (response.ok) {
          const { stargazers_count }: { stargazers_count: number } =
            await response.json()
          setStarCount(stargazers_count)
        }
      } catch (error) {
        console.error('Error fetching star count:', error)
      }
    }
    fetchStarCount()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
    setIsMenuOpen(false)
  }

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen)
  }

  const getInitials = (email: string) => {
    return email.charAt(0).toUpperCase()
  }

  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 w-full border-b backdrop-blur">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <nav
          className="flex h-16 items-center justify-between"
          role="navigation"
          aria-label="Main navigation"
        >
          <Link href="/" className="flex items-center space-x-2">
            <h1 className="text-foreground hover:text-primary text-xl font-bold transition-colors">
              Austen
            </h1>
          </Link>

          <ul className="hidden items-center space-x-4 md:flex" role="menubar">
            <li role="none">
              <Link
                href="https://github.com/herol3oy/austen"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground flex items-center space-x-1 text-sm font-medium transition-colors"
                role="menuitem"
                aria-label="GitHub repository"
              >
                <GitMerge className="h-4 w-4" aria-hidden="true" />
                <span>GitHub</span>
                {starCount !== null && (
                  <div
                    className="bg-muted ml-1 flex items-center space-x-1 rounded-md px-1.5 py-0.5"
                    aria-label={`${starCount} stars`}
                  >
                    <Star className="h-3 w-3 fill-current" aria-hidden="true" />
                    <span className="text-xs font-medium">{starCount}</span>
                  </div>
                )}
              </Link>
            </li>
            {user && (
              <>
                <li role="none">
                  <Link
                    href="/dashboard"
                    className="text-muted-foreground hover:text-foreground flex items-center space-x-1 text-sm font-medium transition-colors"
                    role="menuitem"
                  >
                    <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                    <span>Dashboard</span>
                  </Link>
                </li>
                <li role="none">
                  <Link href="/create">
                    <Button size="sm" className="gap-2 bg-green-600">
                      <Plus className="h-4 w-4" />
                      Create
                    </Button>
                  </Link>
                </li>
              </>
            )}

            <li role="none">
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="flex h-10 items-center space-x-2"
                      aria-label={`User menu for ${user.email}`}
                      aria-expanded="false"
                      aria-haspopup="menu"
                    >
                      <Avatar
                        className="h-7 w-7"
                        role="img"
                        aria-label="User avatar"
                      >
                        <AvatarFallback className="bg-zinc-300 text-xs font-medium">
                          {getInitials(user.email || '')}
                        </AvatarFallback>
                      </Avatar>
                      <span className="max-w-[100px] truncate text-sm">
                        {user.email}
                      </span>
                      <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56" role="menu">
                    <DropdownMenuItem asChild role="none">
                      <Link
                        href="/profile"
                        className="flex cursor-pointer items-center"
                        role="menuitem"
                      >
                        <UserCircle
                          className="mr-2 h-4 w-4"
                          aria-hidden="true"
                        />
                        Profile
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator role="separator" />
                    <DropdownMenuItem
                      onClick={handleSignOut}
                      className="flex cursor-pointer items-center text-red-600 hover:!bg-red-100 hover:!text-red-700 focus:!bg-red-100 focus:!text-red-700 dark:text-red-400 dark:hover:!bg-red-800/30 dark:hover:!text-red-300 dark:focus:!bg-red-800/30 dark:focus:!text-red-300"
                      role="menuitem"
                    >
                      <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Link href="/auth/login">
                  <Button variant="default" size="sm">
                    Login
                  </Button>
                </Link>
              )}
            </li>
          </ul>

          <button
            className="hover:bg-accent rounded-md p-2 md:hidden"
            onClick={toggleMenu}
            aria-label="Toggle navigation menu"
            aria-expanded={isMenuOpen}
            aria-controls="mobile-navigation"
          >
            {isMenuOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </nav>

        {isMenuOpen && (
          <nav
            className="space-y-4 border-t py-4 md:hidden"
            role="navigation"
            aria-label="Mobile navigation"
            id="mobile-navigation"
          >
            <ul className="flex flex-col space-y-3" role="menu">
              <li role="none">
                <Link
                  href="https://github.com/herol3oy/austen"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground flex items-center space-x-2 px-2 py-1 text-sm font-medium transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                  role="menuitem"
                  aria-label="GitHub repository"
                >
                  <GitMerge className="h-4 w-4" aria-hidden="true" />
                  <span>GitHub</span>
                  {starCount !== null && (
                    <div
                      className="bg-muted ml-1 flex items-center space-x-1 rounded-md px-1.5 py-0.5"
                      aria-label={`${starCount} stars`}
                    >
                      <Star
                        className="h-3 w-3 fill-current"
                        aria-hidden="true"
                      />
                      <span className="text-xs font-medium">{starCount}</span>
                    </div>
                  )}
                </Link>
              </li>

              {user ? (
                <>
                  <li role="none">
                    <div
                      className="text-muted-foreground mt-3 flex items-center space-x-2 border-t px-2 py-1 pt-3 text-sm"
                      role="presentation"
                    >
                      <Avatar
                        className="h-6 w-6"
                        role="img"
                        aria-label="User avatar"
                      >
                        <AvatarFallback className="text-xs">
                          {getInitials(user.email || '')}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate">{user.email}</span>
                    </div>
                  </li>
                  <li role="none">
                    <Link href="/create" onClick={() => setIsMenuOpen(false)}>
                      <Button
                        size="sm"
                        className="w-full justify-start gap-2 bg-green-600 text-white hover:bg-green-700"
                        role="menuitem"
                      >
                        <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                        Create
                      </Button>
                    </Link>
                  </li>
                  <li role="none">
                    <Link
                      href="/dashboard"
                      onClick={() => setIsMenuOpen(false)}
                      className="text-muted-foreground hover:text-foreground flex items-center space-x-2 px-2 py-1 text-sm font-medium transition-colors"
                      role="menuitem"
                    >
                      <LayoutDashboard
                        className="mr-2 h-4 w-4"
                        aria-hidden="true"
                      />
                      <span>Dashboard</span>
                    </Link>
                  </li>
                  <li role="none">
                    <Link
                      href="/profile"
                      onClick={() => setIsMenuOpen(false)}
                      className="text-muted-foreground hover:text-foreground flex items-center space-x-2 px-2 py-1 text-sm font-medium transition-colors"
                      role="menuitem"
                    >
                      <UserCircle className="mr-2 h-4 w-4" aria-hidden="true" />
                      <span>Profile</span>
                    </Link>
                  </li>
                  <li role="none">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSignOut}
                      className="w-full justify-start text-red-600 hover:bg-red-100/50 hover:text-red-700 focus:bg-red-100/50 focus:text-red-700 dark:text-red-400 dark:hover:bg-red-800/20 dark:hover:text-red-300 dark:focus:bg-red-800/20 dark:focus:text-red-300"
                      role="menuitem"
                    >
                      <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
                      Sign out
                    </Button>
                  </li>
                </>
              ) : (
                <li role="none">
                  <Link href="/auth/login" onClick={() => setIsMenuOpen(false)}>
                    <Button variant="default" size="sm" className="w-full">
                      Login
                    </Button>
                  </Link>
                </li>
              )}
            </ul>
          </nav>
        )}
      </div>
    </header>
  )
}
