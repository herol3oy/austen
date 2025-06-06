'use client'

import { ArrowRight, BookOpen, GitMerge, Sparkles } from 'lucide-react'
import Link from 'next/link'

import { FEATURES, HOW_IT_WORKS } from '@/consts/landing-page-content'
// import { useMermaidGraph } from '@/hooks/useMermaidGraph'

export default function HomePage() {
  // const graphRef = useMermaidGraph()
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50 to-emerald-50">
      <div className="relative z-10 mx-auto max-w-7xl px-6 py-20 text-center">
        <div className="mb-8">
          <span className="inline-flex items-center rounded-full border border-teal-200/60 bg-white/80 px-4 py-2 text-sm font-medium text-teal-700 backdrop-blur-sm">
            <Sparkles className="mr-2 h-4 w-4" />
            AI-Powered Character Analysis
          </span>
        </div>

        <h1 className="mb-6 bg-gradient-to-r from-teal-700 via-emerald-700 to-cyan-700 bg-clip-text text-6xl leading-tight font-bold text-transparent md:text-7xl">
          Discover Story
          <br />
          Relationships
        </h1>

        <p className="mx-auto mb-10 max-w-3xl text-xl leading-relaxed text-slate-700">
          Discover the connections between your favorite book characters through
          beautiful, AI-generated relationship diagrams. From Jane Austen to
          modern classics, explore literature like never before.
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

        <div className="relative mx-auto max-w-7xl">
          <div className="transform rounded-2xl border border-teal-100 bg-white/90 p-8 shadow-2xl backdrop-blur-sm transition-transform duration-500 hover:scale-102">
            <div className="mb-4 flex items-center justify-center text-sm text-slate-600">
              <BookOpen className="mr-2 h-4 w-4" />
              Sample: &quot;Sense and Sensibility&quot; by Jane Austen
            </div>
            <div
              // ref={graphRef}
              className="rounded-xl bg-gradient-to-br from-slate-50 to-teal-50 p-6 font-mono text-sm"
            ></div>
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
            {FEATURES.map((feature, index) => (
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
            {HOW_IT_WORKS.map((step, index) => (
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
