import './globals.css'

import { Analytics } from '@vercel/analytics/next'
import type { Metadata } from 'next'

import { TopBar } from '@/components/TopBar'
import { Toaster } from '@/components/ui/sonner'

export const metadata: Metadata = {
  title: 'Austen | Discover Story Relationships',
  description:
    'Discover the connections between your favorite book characters through AI-generated relationship diagrams',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>
        <TopBar />
        <main>
          {children}
          <Analytics />
        </main>
        <Toaster position="bottom-center" richColors />
      </body>
    </html>
  )
}
