import './globals.css'

import type { Metadata } from 'next'

import { TopBar } from '@/components/TopBar'
import { Toaster } from '@/components/ui/sonner'

export const metadata: Metadata = {
  title: 'Austen',
  description: 'Discover Story Relationships',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <TopBar />
        <main>{children}</main>
        <Toaster position="bottom-center" richColors />
      </body>
    </html>
  )
}
