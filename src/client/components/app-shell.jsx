import { Link } from '@tanstack/react-router'
import {
  BookOpen,
  Image,
  LayoutDashboard,
  LineChart,
  Lock,
  LogOut,
  NotebookPen,
  Settings,
  SlidersHorizontal,
} from 'lucide-react'
import { BrandMark } from '@/components/brand-mark'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'

const navigation = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/' },
  { label: 'Trading setup', icon: SlidersHorizontal, to: '/setup' },
  { label: 'Trading journal', icon: LineChart, to: '/trades' },
  { label: 'Analytics', icon: LineChart, to: '/analytics' },
  { label: 'Learning', icon: BookOpen, to: '/learning' },
  { label: 'Daily Journal', icon: NotebookPen, to: '/journal' },
  { label: 'Poster Studio', icon: Image, to: '/posters' },
  { label: 'Settings', icon: Settings, to: '/settings' },
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

function UserCard() {
  const { user, lock, signOut } = useAuth()
  const initial = user?.displayName?.trim()?.charAt(0)?.toUpperCase() || 'Y'

  return (
    <div className="m-3 rounded-xl border border-border/80 bg-card/70 p-3">
      <div className="flex items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-primary/30 bg-primary/10 font-mono text-xs font-semibold text-primary">
          {initial}
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold">{user?.displayName}</p>
          <p className="truncate text-[11px] text-muted-foreground">{user?.email}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={lock}>
          <Lock aria-hidden="true" />
          Lock
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => void signOut()}>
          <LogOut aria-hidden="true" />
          Sign out
        </Button>
      </div>

      <p className="mt-2.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <Lock aria-hidden="true" className="size-3 text-primary" />
        Local-only · 15 min auto-lock
      </p>
    </div>
  )
}

export function AppShell({ children }) {
  const { user, lock, signOut } = useAuth()

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

        <nav
          className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-2"
          aria-label="Primary navigation"
        >
          <p className="px-3 pb-2 pt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/60">
            Workspace
          </p>
          {navigation.map((item) => (
            <NavItem key={item.label} item={item} />
          ))}
        </nav>

        <UserCard />
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-border/70 bg-background/75 px-4 backdrop-blur-xl lg:hidden">
          <div className="flex min-w-0 items-center gap-2.5">
            <BrandMark className="size-8" />
            <span className="truncate text-sm font-semibold">Y&apos;s Journal</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="mr-1 hidden max-w-28 truncate text-xs text-muted-foreground sm:block">
              {user?.displayName}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={lock}
              aria-label="Lock workspace"
            >
              <Lock aria-hidden="true" />
            </Button>
            <Button asChild variant="ghost" size="icon">
              <Link to="/trades" aria-label="Open trading journal">
                <LineChart aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="icon">
              <Link to="/journal" aria-label="Open daily journal">
                <NotebookPen aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="icon">
              <Link to="/learning" aria-label="Open learning tracker">
                <BookOpen aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="icon">
              <Link to="/posters" aria-label="Open Poster Studio">
                <Image aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="icon">
              <Link to="/setup" aria-label="Open trading setup">
                <SlidersHorizontal aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="icon">
              <Link to="/settings" aria-label="Open settings">
                <Settings aria-hidden="true" />
              </Link>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => void signOut()}
              aria-label="Sign out"
            >
              <LogOut aria-hidden="true" />
            </Button>
          </div>
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
