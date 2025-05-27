import './globals.css'

import type { Metadata } from 'next'

import TopBar from '@/components/TopBar'

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
        {children}
      </body>
    </html>
  )
}
