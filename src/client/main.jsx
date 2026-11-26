import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen.js'
import { queryClient } from './lib/query-client'
import { AuthProvider } from './lib/auth-context'
import { AppUpdateProvider } from './components/app-update.jsx'
import { setupOffline } from './offline/manager.js'
import './styles.css'

const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: true,
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppUpdateProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </AppUpdateProvider>
    </QueryClientProvider>
  )
}

// The development server must not reuse a cached shell from an earlier build.
// Stale chunks can mix old and new UI, which duplicates panels after a refresh.
if (import.meta.env.DEV) {
  if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
    void navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) void registration.unregister()
    })
  }
  if (typeof caches !== 'undefined') {
    void caches.keys().then((names) => Promise.all(names.map((name) => caches.delete(name))))
  }
}

setupOffline(queryClient)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
