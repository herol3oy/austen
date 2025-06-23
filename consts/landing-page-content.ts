import { BookOpen } from 'lucide-react'
import { Download } from 'lucide-react'
import { Heart } from 'lucide-react'
import { Share2 } from 'lucide-react'
import { Sparkles } from 'lucide-react'
import { Users } from 'lucide-react'

export const FEATURES = [
  {
    icon: BookOpen,
    title: 'Vast Book Library',
    description:
      "Search and analyze any book from Open Library's extensive collection of literary works.",
    color: 'from-teal-500 to-teal-600',
  },
  {
    icon: Sparkles,
    title: 'AI-Powered Analysis',
    description:
      'Advanced AI identifies character relationships and creates meaningful connection insights.',
    color: 'from-emerald-500 to-emerald-600',
  },
  {
    icon: Users,
    title: 'Beautiful Diagrams',
    description:
      'Generate stunning Mermaid.js diagrams that visualize character relationships clearly.',
    color: 'from-cyan-500 to-cyan-600',
  },
  {
    icon: Download,
    title: 'Export & Save',
    description:
      'Download your diagrams as SVG or PNG files, and save them to your personal collection.',
    color: 'from-blue-500 to-blue-600',
  },
  {
    icon: Share2,
    title: 'Share & Discover',
    description:
      'Share your analyses publicly or discover fascinating graphs created by other readers.',
    color: 'from-indigo-500 to-indigo-600',
  },
  {
    icon: Heart,
    title: 'Community Driven',
    description:
      'Like, save, and explore popular character relationship analyses from the community.',
    color: 'from-teal-500 to-emerald-500',
  },
] as const

export const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Search Your Book',
    description:
      "Enter any book title to search through Open Library's vast collection of books.",
  },
  {
    step: '02',
    title: 'AI Analysis',
    description:
      "AI analyzes the book's content to identify characters and their relationships and connections.",
  },
  {
    step: '03',
    title: 'Visualize & Share',
    description:
      'Get beautiful Mermaid diagrams showing character relationships. Save, download, or share your discoveries with the community.',
  },
] as const
