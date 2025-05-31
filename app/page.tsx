'use client'

import { ArrowRight } from 'lucide-react'
import { BookOpen } from 'lucide-react'
import { Download } from 'lucide-react'
import { GitMerge } from 'lucide-react'
import { Heart } from 'lucide-react'
import { Share2 } from 'lucide-react'
import { Sparkles } from 'lucide-react'
import { Users } from 'lucide-react'
import mermaid from 'mermaid'
import Link from 'next/link'
import { useEffect, useRef } from 'react'

export default function StartPage() {
  const graphRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const renderGraph = async () => {
      if (graphRef.current) {
        graphRef.current.innerHTML = ''

        try {
          await mermaid.initialize({
            startOnLoad: true,
            securityLevel: 'strict',
            theme: 'forest',
            look: 'handDrawn',
          })

          const graphId = `graph_${crypto.randomUUID()}`
          const graphDefinition = `
          graph LR
              A(Dorothy Gale) -->|Pet| B([Toto])
              A -->|Family| C([Uncle Henry and Aunt Em])
              A -->|Friends| D([Scarecrow])
              A -->|Friends| E([Tin Woodman])
              A -->|Friends| F([Cowardly Lion])
              A -->|Enemy| G([The Wicked Witch of The West])
              A -->|Enemy| H([The Wizard of OZ])
              A -->|Helps Dorothy| I([Glinda])
              D -->|Friends| E
              E -->|Friends| F
              B -->|In Kansas| C`

          const { svg } = await mermaid.render(graphId, graphDefinition)

          graphRef.current.innerHTML = svg
        } catch (error) {
          console.error('Error rendering graph:', error)
          graphRef.current.innerHTML = `
              <div class="p-4 text-red-600">
                Failed to render graph. Please check the syntax.
              </div>`
        }
      }
    }

    renderGraph()
  }, [])
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50 to-emerald-50">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute top-20 left-10 h-20 w-20 animate-pulse rounded-full bg-teal-200 opacity-30"></div>
          <div
            className="absolute top-40 right-20 h-16 w-16 animate-bounce rounded-full bg-emerald-200 opacity-40"
            style={{ animationDelay: '1s' }}
          ></div>
          <div
            className="absolute bottom-40 left-20 h-24 w-24 animate-pulse rounded-full bg-cyan-200 opacity-20"
            style={{ animationDelay: '2s' }}
          ></div>
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-6 py-20 text-center">
          <div className="mb-8">
            <span className="inline-flex items-center rounded-full border border-teal-200/60 bg-white/80 px-4 py-2 text-sm font-medium text-teal-700 backdrop-blur-sm">
              <Sparkles className="mr-2 h-4 w-4" />
              AI-Powered Character Analysis
            </span>
          </div>

          <h1 className="mb-6 bg-gradient-to-r from-teal-700 via-emerald-700 to-cyan-700 bg-clip-text text-6xl leading-tight font-bold text-transparent md:text-7xl">
            Unravel Literary
            <br />
            <span className="relative">
              Relationships
              <div className="absolute right-0 -bottom-4 left-0 h-2 rotate-1 transform rounded-full bg-gradient-to-r from-teal-400 to-emerald-400 opacity-50"></div>
            </span>
          </h1>

          <p className="mx-auto mb-10 max-w-3xl text-xl leading-relaxed text-slate-700">
            Discover the connections between your favorite book characters
            through beautiful, AI-generated relationship diagrams. From Jane
            Austen to modern classics, explore literature like never before.
          </p>

          <div className="mb-16 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/create"
              className="group flex transform items-center rounded-full bg-gradient-to-r from-teal-600 to-emerald-600 px-8 py-4 text-lg font-semibold text-white transition-all duration-300 hover:scale-105 hover:shadow-xl"
            >
              Try Now!
              <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <button className="flex items-center font-medium text-slate-600 transition-colors hover:text-teal-700">
              <GitMerge className="mr-2 h-5 w-5" />
              View on GitHub
            </button>
          </div>

          <div className="relative mx-auto max-w-4xl">
            <div className="transform rounded-2xl border border-teal-100 bg-white/90 p-8 shadow-2xl backdrop-blur-sm transition-transform duration-500 hover:scale-102">
              <div className="mb-4 flex items-center justify-center text-sm text-slate-600">
                <BookOpen className="mr-2 h-4 w-4" />
                Sample: &quot;Sense and Sensibility&quot; by Jane Austen
              </div>
              <div
                ref={graphRef}
                className="rounded-xl bg-gradient-to-br from-slate-50 to-teal-50 p-6 font-mono text-sm"
              ></div>
            </div>
          </div>
        </div>
      </div>

      <section id="features" className="bg-white/60 py-20 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-4xl font-bold text-slate-800">
              Powerful Features for Book Lovers
            </h2>
            <p className="mx-auto max-w-2xl text-xl text-slate-600">
              Everything you need to explore, analyze, and share literary
              character relationships
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {[
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
            ].map((feature, index) => (
              <div
                key={index}
                className="group transform rounded-2xl border border-teal-100/50 bg-white/80 p-6 shadow-lg backdrop-blur-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-xl"
              >
                <div
                  className={`h-12 w-12 bg-gradient-to-r ${feature.color} mb-4 flex items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110`}
                >
                  <feature.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="mb-2 text-xl font-semibold text-slate-800">
                  {feature.title}
                </h3>
                <p className="leading-relaxed text-slate-600">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="how-it-works"
        className="bg-gradient-to-br from-teal-50 to-emerald-50 py-20"
      >
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-16 text-center">
            <h2 className="mb-4 bg-gradient-to-r from-teal-700 to-emerald-700 bg-clip-text text-4xl font-bold text-transparent">
              How Austen Works
            </h2>
            <p className="mx-auto max-w-2xl text-xl text-slate-600">
              Transform any book into a visual character relationship map in
              just three simple steps
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {[
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
                  "Our advanced AI analyzes the book's content to identify characters and their relationships, connections, and interactions.",
              },
              {
                step: '03',
                title: 'Visualize & Share',
                description:
                  'Get beautiful Mermaid diagrams showing character relationships. Save, download, or share your discoveries with the community.',
              },
            ].map((step, index) => (
              <div key={index} className="relative">
                <div className="group rounded-2xl bg-white/90 p-8 text-center shadow-lg backdrop-blur-sm transition-all duration-300 hover:shadow-xl">
                  <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-teal-600 to-emerald-600 text-xl font-bold text-white transition-transform duration-300 group-hover:scale-110">
                    {step.step}
                  </div>
                  <h3 className="mb-4 text-xl font-semibold text-slate-800">
                    {step.title}
                  </h3>
                  <p className="leading-relaxed text-slate-600">
                    {step.description}
                  </p>
                </div>
                {index < 2 && (
                  <div className="absolute top-1/2 -right-4 hidden -translate-y-1/2 transform md:block">
                    <ArrowRight className="h-8 w-8 text-teal-400" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-r from-teal-600 to-emerald-600 py-20 text-white">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="mb-6 text-4xl font-bold">
            Ready to Explore Literary Relationships?
          </h2>
          <p className="mb-8 text-xl opacity-90">
            Join a passionate group of book lovers uncovering fresh perspectives
            on their favorite stories
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Link
              href="/create"
              className="flex transform items-center justify-center rounded-full bg-white px-8 py-4 font-semibold text-teal-700 transition-all duration-200 hover:scale-105 hover:bg-gray-50"
            >
              Start Analyzing Now
              <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <button className="rounded-full border-2 border-white px-8 py-4 font-semibold text-white transition-all duration-200 hover:bg-white hover:text-teal-700">
              View Examples
            </button>
          </div>
        </div>
      </section>

      <footer className="border-t border-teal-100 bg-slate-50 py-12">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col items-center justify-between md:flex-row">
            <div className="mb-4 flex items-center space-x-3 md:mb-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-teal-600 to-emerald-600">
                <BookOpen className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-800">Austen</span>
            </div>
            <div className="flex items-center space-x-6">
              <Link
                href="https://github.com/herol3oy/austen"
                target="_blank"
                className="text-slate-600 transition-colors hover:text-teal-700"
              >
                GitHub
              </Link>
            </div>
          </div>
          <div className="mt-8 border-t border-teal-100 pt-8 text-center text-slate-500">
            <p>&copy; 2025 Austen. Built with ♥️ for book lovers everywhere.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
