import { Link } from '@tanstack/react-router'
import {
  BookOpen,
  CalendarDays,
  Image,
  LayoutDashboard,
  LineChart,
  Lock,
  NotebookPen,
  Settings,
} from 'lucide-react'
import { BrandMark } from '@/components/brand-mark'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const navigation = [
  { label: 'Overview', icon: LayoutDashboard, to: '/' },
  { label: 'Trading', icon: LineChart, disabled: true },
  { label: 'Learning', icon: BookOpen, disabled: true },
  { label: 'Daily Journal', icon: NotebookPen, disabled: true },
  { label: 'Calendar', icon: CalendarDays, disabled: true },
  { label: 'Poster Studio', icon: Image, disabled: true },
  { label: 'Settings', icon: Settings, disabled: true },
]

function NavItem({ item }) {
  const Icon = item.icon
  const baseClass =
    'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors'

  if (item.disabled) {
    return (
      <span
        className={cn(baseClass, 'cursor-not-allowed text-muted-foreground/55')}
        aria-disabled="true"
        title={`${item.label} is planned for a later phase`}
      >
        <Icon className="size-4" aria-hidden="true" />
        <span>{item.label}</span>
        <span className="ml-auto rounded-full border border-border/70 px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-muted-foreground/60">
          Soon
        </span>
      </span>
    )
  }

  return (
    <Link
      to={item.to}
      className={cn(baseClass, 'text-muted-foreground hover:bg-accent/70 hover:text-foreground')}
      activeProps={{
        className: 'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary',
      }}
      activeOptions={{ exact: true }}
    >
      <Icon className="size-4" aria-hidden="true" />
      <span>{item.label}</span>
    </Link>
  )
}

export function AppShell({ children }) {
  return (
    <div className="min-h-dvh text-foreground">
      <a
        href="#main-content"
        className="sr-only fixed left-4 top-4 z-50 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only"
      >
        Skip to main content
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border/80 bg-background/80 backdrop-blur-xl lg:flex">
        <div className="flex h-20 items-center gap-3 px-5">
          <BrandMark />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight">Y&apos;s Journal</p>
            <p className="text-[11px] text-muted-foreground">Private workspace</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3 py-2" aria-label="Primary navigation">
          <p className="px-3 pb-2 pt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/60">
            Workspace
          </p>
          {navigation.map((item) => (
            <NavItem key={item.label} item={item} />
          ))}
        </nav>

        <div className="m-3 rounded-xl border border-border/80 bg-card/70 p-3">
          <div className="flex items-center gap-2 text-xs font-medium">
            <Lock className="size-3.5 text-primary" aria-hidden="true" />
            Local-only build
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
            No cloud database and no public exposure. Data stays on this laptop.
          </p>
          <Badge variant="outline" className="mt-2.5">
            Phase 0
          </Badge>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border/70 bg-background/75 px-4 backdrop-blur-xl lg:hidden">
          <div className="flex items-center gap-2.5">
            <BrandMark className="size-8" />
            <span className="text-sm font-semibold">Y&apos;s Journal</span>
          </div>
          <Badge variant="outline">Phase 0</Badge>
        </header>

        <main
          id="main-content"
          className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12"
        >
          {children}
        </main>
      </div>
    </div>
  )
}
