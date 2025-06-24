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
    description: "Access Open Library's extensive book collection.",
  },
  {
    icon: Sparkles,
    title: 'AI Analysis',
    description: 'AI identifies character relationships and connections.',
  },
  {
    icon: Users,
    title: 'Beautiful Diagrams',
    description: 'Clear Mermaid.js character relationship visuals.',
  },
  {
    icon: Download,
    title: 'Export & Save',
    description: 'Download diagrams as SVG/PNG or save them.',
  },
  {
    icon: Share2,
    title: 'Share & Discover',
    description: "Share analyses or explore others' graphs.",
  },
  {
    icon: Heart,
    title: 'Community Driven',
    description: 'Engage with popular community analyses.',
  },
] as const

export const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Search Book',
    description: "Find books in Open Library's collection.",
  },
  {
    step: '02',
    title: 'AI Processing',
    description: 'AI identifies characters and relationships.',
  },
  {
    step: '03',
    title: 'Visualize & Share',
    description: 'Get diagrams and share with community.',
  },
] as const
