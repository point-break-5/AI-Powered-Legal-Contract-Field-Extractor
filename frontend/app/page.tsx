import Link from 'next/link';
import {
  Scale, FileText, Layers, Download, ScrollText,
  ChevronRight, Sparkles, Zap, ScanText, LayoutTemplate,
} from 'lucide-react';

const FEATURES = [
  {
    icon: Zap,
    color: 'blue',
    title: 'AI-Powered Extraction',
    description:
      'Gemini 2.5 Flash, Grok, and DeepSeek work together with an automatic provider fallback chain for reliable, always-on extraction.',
  },
  {
    icon: ScanText,
    color: 'teal',
    title: 'OCR for Scanned PDFs',
    description:
      'Image-based and scanned pages are detected automatically and processed via Tesseract OCR — no manual preprocessing needed.',
  },
  {
    icon: LayoutTemplate,
    color: 'blue',
    title: 'Custom Field Templates',
    description:
      'Define exactly which fields to extract. Save, rename, and reuse templates as named presets across multiple projects.',
  },
  {
    icon: Layers,
    color: 'teal',
    title: 'Drag-and-Drop Review Table',
    description:
      'Review all extracted values in a structured table. Reorder document columns, edit cells inline, and flag discrepancies.',
  },
  {
    icon: Download,
    color: 'blue',
    title: 'Multi-Format Export',
    description:
      'Export reviewed extraction results to CSV or Excel in one click. Clean headers, clean data — ready for downstream tools.',
  },
  {
    icon: ScrollText,
    color: 'teal',
    title: 'Activity Logs',
    description:
      'Full audit trail of every upload, extraction run, and deletion — with INFO, WARNING, and ERROR level filtering.',
  },
] as const;

const STEPS = [
  {
    n: 1,
    icon: FileText,
    title: 'Upload Documents',
    desc: 'Add one or more PDF contracts to a project. Text and scanned image pages are both handled automatically.',
  },
  {
    n: 2,
    icon: LayoutTemplate,
    title: 'Define Fields',
    desc: 'Pick a built-in preset or build a custom template of fields you want extracted from each document.',
  },
  {
    n: 3,
    icon: Download,
    title: 'Review & Export',
    desc: 'AI fills the table with extracted values. Review, edit inline, and export to CSV or Excel.',
  },
] as const;

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--ash-white)] flex flex-col">

      {/* ── Navbar ─────────────────────────────────────────── */}
      <header className="absolute top-0 inset-x-0 z-20 h-14 flex items-center justify-between px-8">
        <div className="flex items-center gap-2">
          <Scale size={18} className="text-white" />
          <span className="text-sm font-semibold text-white">Legal Contract Extractor</span>
        </div>
        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-white/15 border border-white/30 text-white text-xs font-medium hover:bg-white/25 transition"
        >
          Projects
          <ChevronRight size={13} />
        </Link>
      </header>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section
        className="landing-hero relative flex flex-col items-center justify-center text-center px-6 pt-28 pb-24 md:pt-36 md:pb-32 overflow-hidden"
        style={{ background: 'linear-gradient(150deg, #0c0f16 0%, #0f1520 45%, #0b1628 100%)' }}
      >
        {/* dot-grid overlay */}
        <div className="landing-dots absolute inset-0 pointer-events-none" />
        {/* blue glow blob */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(ellipse, rgba(91,127,229,0.22) 0%, transparent 70%)' }}
        />

        <div className="relative z-10 max-w-3xl mx-auto flex flex-col items-center gap-6 animate-fade-in">
          {/* pill badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-semibold tracking-wide" style={{ background: 'rgba(91,127,229,0.20)', borderColor: 'rgba(91,127,229,0.55)', color: '#8ba4f0' }}>
            <Sparkles size={11} />
            AI-POWERED · MULTI-MODEL · OCR-READY
          </div>

          {/* icon */}
          <div className="w-16 h-16 rounded-2xl bg-[var(--accent-blue)] flex items-center justify-center shadow-xl" style={{ boxShadow: '0 8px 40px rgba(91,127,229,0.45)' }}>
            <Scale size={28} className="text-white" />
          </div>

          <h1 className="text-5xl md:text-[3.75rem] font-bold leading-[1.1] tracking-tight" style={{ color: '#ffffff' }}>
            Legal Contract<br />
            <span style={{ color: '#7c9ef0' }}>Field Extractor</span>
          </h1>

          <p className="text-lg max-w-xl leading-relaxed" style={{ color: 'rgba(255,255,255,0.80)' }}>
            Upload legal PDFs, define the fields you care about, and let AI extract
            clean structured data in seconds — with automatic OCR for scanned documents.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
            <Link
              href="/projects"
              className="inline-flex items-center gap-2 px-7 py-3 rounded-xl text-white font-semibold text-sm transition-all duration-200 hover:-translate-y-0.5"
              style={{
                background: 'var(--accent-blue)',
                boxShadow: '0 4px 24px rgba(91,127,229,0.40)',
              }}
            >
              Open Projects
              <ChevronRight size={15} />
            </Link>
            <a
              href="#features"
              className="inline-flex items-center gap-2 px-7 py-3 rounded-xl font-semibold text-sm border hover:bg-white/10 transition"
              style={{ color: 'rgba(255,255,255,0.90)', borderColor: 'rgba(255,255,255,0.25)' }}
            >
              See Features
            </a>
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────── */}
      <section id="features" className="py-20 px-6 bg-[var(--ash-white)]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-[var(--ash-black)]">Everything you need</h2>
            <p className="mt-3 text-[var(--ash-dark)] text-base max-w-lg mx-auto">
              A full-stack extraction pipeline built for legal professionals who need
              structured, reliable, and auditable data from contracts.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(({ icon: Icon, title, description, color }) => (
              <div
                key={title}
                className="bg-white border border-[var(--ash-gray)] rounded-2xl p-6 hover:border-[var(--accent-blue)]/40 hover:shadow-sm transition-all duration-200"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{
                    background: color === 'blue' ? 'rgba(91,127,229,0.10)' : 'rgba(78,205,196,0.10)',
                    color: color === 'blue' ? 'var(--accent-blue)' : 'var(--accent-teal)',
                  }}
                >
                  <Icon size={18} />
                </div>
                <h3 className="text-sm font-semibold text-[var(--ash-black)] mb-2">{title}</h3>
                <p className="text-sm text-[var(--ash-charcoal)] leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────── */}
      <section className="py-20 px-6 bg-white border-t border-[var(--ash-gray)]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-[var(--ash-black)]">How it works</h2>
            <p className="mt-3 text-[var(--ash-dark)] text-base">Three steps from PDF to structured data.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {STEPS.map(({ n, icon: Icon, title, desc }) => (
              <div key={n} className="flex flex-col items-center text-center">
                <div className="relative mb-5">
                  <div className="w-16 h-16 rounded-2xl bg-[var(--ash-light)] border border-[var(--ash-gray)] flex items-center justify-center">
                    <Icon size={24} className="text-[var(--ash-deep)]" />
                  </div>
                  <span
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ background: 'var(--accent-blue)' }}
                  >
                    {n}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-[var(--ash-black)] mb-2">{title}</h3>
                <p className="text-sm text-[var(--ash-charcoal)] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-[var(--ash-white)] border-t border-[var(--ash-gray)]">
        <div className="max-w-lg mx-auto text-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{ background: 'var(--accent-blue)', boxShadow: '0 6px 30px rgba(91,127,229,0.35)' }}
          >
            <Zap size={24} className="text-white" />
          </div>
          <h2 className="text-3xl font-bold text-[var(--ash-black)] mb-3">Ready to extract?</h2>
          <p className="text-[var(--ash-dark)] mb-8 text-base">
            Create a project, upload your contracts, and get structured data in seconds.
          </p>
          <Link
            href="/projects"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-white font-semibold text-sm transition-all duration-200 hover:-translate-y-0.5"
            style={{
              background: 'var(--accent-blue)',
              boxShadow: '0 4px 24px rgba(91,127,229,0.35)',
            }}
          >
            Get Started
            <ChevronRight size={15} />
          </Link>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer className="mt-auto border-t border-[var(--ash-gray)] bg-white py-6 px-8">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[var(--ash-charcoal)]">
            <Scale size={15} className="text-[var(--accent-blue)]" />
            <span className="text-sm font-medium">Legal Contract Extractor</span>
          </div>
          <p className="text-xs text-[var(--ash-dark)]">Built with FastAPI · Next.js · Gemini 2.5 Flash</p>
        </div>
      </footer>

    </div>
  );
}

