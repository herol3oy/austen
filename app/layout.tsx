import './globals.css'

import type { Metadata } from 'next'

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
      <body className="antialiased">{children}</body>
    </html>
  )
}
