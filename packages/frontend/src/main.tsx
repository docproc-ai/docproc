import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  RouterProvider,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools"
import { StrictMode } from "react"
import ReactDOM from "react-dom/client"

import { Button } from "./components/ui/button"
import * as TanStackQueryProvider from "./integrations/tanstack-query/root-provider.tsx"
import { signOut, useSession } from "./lib/auth"
import { ThemeProvider, useTheme } from "./lib/theme"
import DocumentTypesPage from "./pages/document-types"
import DocumentTypeSettingsPage from "./pages/document-types/[slug]/settings"
import ProcessLayout from "./pages/document-types/[slug]/process"
import DocumentEditorPage from "./pages/document-types/[slug]/process/[id]"
import NewDocumentTypePage from "./pages/document-types/new"
import UsersPage from "./pages/users"
// Page components
import LoginPage from "./pages/login"

import "./styles.css"
import reportWebVitals from "./reportWebVitals.ts"

// Decorative logo mark
function LogoMark() {
  return (
    <svg
      viewBox="0 0 32 32"
      className="w-8 h-8"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="4"
        y="4"
        width="24"
        height="24"
        rx="4"
        className="fill-primary/10 stroke-primary"
        strokeWidth="1.5"
      />
      <path
        d="M10 12h12M10 16h8M10 20h10"
        className="stroke-primary"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="24" cy="22" r="4" className="fill-accent" />
    </svg>
  )
}

// Theme toggle button
function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className="h-9 w-9"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {theme === "dark" ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="m4.93 4.93 1.41 1.41" />
          <path d="m17.66 17.66 1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="m6.34 17.66-1.41 1.41" />
          <path d="m19.07 4.93-1.41 1.41" />
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      )}
    </Button>
  )
}

// App header with auth
function AppHeader() {
  const { data: session, isPending } = useSession()
  const navigate = useNavigate()
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'admin'

  const handleSignOut = async () => {
    await signOut()
    navigate({ to: "/login" })
  }

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-lg">
      <div className="container mx-auto flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-3 group">
            <LogoMark />
            <span className="font-sans text-xl font-semibold tracking-tight group-hover:text-primary transition-colors">
              DocProc
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            <Link
              to="/document-types"
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-all [&.active]:text-foreground [&.active]:bg-muted [&.active]:font-medium"
            >
              Document Types
            </Link>
            {isAdmin && (
              <Link
                to="/users"
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-all [&.active]:text-foreground [&.active]:bg-muted [&.active]:font-medium"
              >
                Users
              </Link>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {isPending ? (
            <div className="h-9 w-24 bg-muted animate-pulse rounded-md" />
          ) : session?.user ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 text-sm">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-medium text-xs">
                    {session.user.email?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="text-muted-foreground max-w-[150px] truncate">
                  {session.user.email}
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                Sign out
              </Button>
            </div>
          ) : (
            <Button size="sm" asChild>
              <Link to="/login">Sign in</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}

// Home page - redirect to document types
function HomePage() {
  const { data: session, isPending } = useSession()
  const navigate = useNavigate()

  if (isPending) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!session?.user) {
    navigate({ to: "/login" })
    return null
  }

  navigate({ to: "/document-types" })
  return null
}

// Root layout component
function RootLayout() {
  const routerState = useRouterState()
  const pathname = routerState.location.pathname

  // Hide main header on document type process pages (3-pane view has its own header)
  // But show it on settings and new pages
  const hideHeader =
    pathname.includes("/process")

  return (
    <div className="min-h-screen bg-background relative">
      {/* Subtle background gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-primary/[0.02] via-transparent to-accent/[0.02] pointer-events-none" />
      <div className="relative">
        {!hideHeader && <AppHeader />}
        <main className="relative">
          <Outlet />
        </main>
      </div>
      <TanStackRouterDevtools position="bottom-right" />
    </div>
  )
}

// Root layout
const rootRoute = createRootRoute({
  component: RootLayout,
})

// Create routes
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
})

const documentTypesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/document-types",
  component: DocumentTypesPage,
})

const usersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/users",
  component: UsersPage,
})

const newDocumentTypeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/document-types/new",
  component: NewDocumentTypePage,
})

const documentTypeProcessRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/document-types/$slug/process",
  component: ProcessLayout,
  validateSearch: (search: Record<string, unknown>) => ({
    q: (search.q as string) || "",
    status: (search.status as string) || "all",
    page: Number(search.page) || 1,
  }),
})

const documentEditorRoute = createRoute({
  getParentRoute: () => documentTypeProcessRoute,
  path: "$id",
  component: DocumentEditorPage,
})

const documentTypeSettingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/document-types/$slug/settings",
  component: DocumentTypeSettingsPage,
})

// Build route tree
const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  documentTypesRoute,
  usersRoute,
  newDocumentTypeRoute,
  documentTypeSettingsRoute,
  documentTypeProcessRoute.addChildren([documentEditorRoute]),
])

// Create router
const TanStackQueryProviderContext = TanStackQueryProvider.getContext()
const router = createRouter({
  routeTree,
  context: {
    ...TanStackQueryProviderContext,
  },
  defaultPreload: "intent",
  scrollRestoration: true,
  defaultStructuralSharing: true,
  defaultPreloadStaleTime: 0,
})

// Type registration
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

// Mount app
const rootElement = document.getElementById("app")
if (rootElement && !rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <ThemeProvider>
        <TanStackQueryProvider.Provider {...TanStackQueryProviderContext}>
          <RouterProvider router={router} />
        </TanStackQueryProvider.Provider>
      </ThemeProvider>
    </StrictMode>,
  )
}

reportWebVitals()
