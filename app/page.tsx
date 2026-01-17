'use client'

import { useEffect, useState } from 'react'
import Script from 'next/script'
import MobileFooter from './components/MobileFooter'
import AuthScreen from './components/auth/AuthScreen'
import BusinessSetupScreen from './components/business/BusinessSetupScreen'
import BusinessLoginScreen from './components/business/BusinessLoginScreen'
import DashboardScreen from './components/dashboard/DashboardScreen'
import SettingsScreen from './components/settings/SettingsScreen'
import EditBusinessScreen from './components/business/EditBusinessScreen'
import NewMeasurementScreen from './components/measurements/NewMeasurementScreen'
import SearchMeasurementScreen from './components/measurements/SearchMeasurementScreen'
import ClientsScreen from './components/clients/ClientsScreen'
import ClientDetailsScreen from './components/clients/ClientDetailsScreen'
import EditClientScreen from './components/clients/EditClientScreen'
import MeasurementDetailScreen from './components/measurements/MeasurementDetailScreen'
import WelcomeScreen from './components/auth/WelcomeScreen'

export default function Home() {
  const [theme, setThemeState] = useState<'dark' | 'light'>('dark')
  const [currentScreen, setCurrentScreen] = useState<string>('app-loading-screen')

  const handleNavigate = (screenId: string) => {
    setCurrentScreen(screenId)
    window.scrollTo(0, 0)
  }

  // Listen for auth state changes to set initial screen from existing logic
  useEffect(() => {
    const checkAuth = async () => {
      let attempts = 0
      const maxAttempts = 20 // 2 seconds total

      const waitForClient = setInterval(() => {
        const client = (window as any).supabaseClient
        if (client) {
          clearInterval(waitForClient)
          client.auth.getSession().then(({ data: { session } }: any) => {
            if (session) {
              const inProgressMeasurement = localStorage.getItem('measurement-in-progress')
              if (inProgressMeasurement === 'true') {
                console.log('[React Init] Restoring in-progress measurement screen')
                setCurrentScreen('new-measurement-screen')
              } else {
                console.log('[React Init] Showing home screen')
                setCurrentScreen('home-screen')
              }
            } else {
              console.log('[React Init] No session, showing welcome screen')
              setCurrentScreen('welcome-screen')
            }
          })

          client.auth.onAuthStateChange((_event: any, session: any) => {
            if (session) {
              setCurrentScreen(prev => {
                const needsRestoration = ['login-screen', 'signup-screen', 'forgot-password-screen', 'app-loading-screen']
                if (needsRestoration.includes(prev)) {
                  const inProgressMeasurement = localStorage.getItem('measurement-in-progress')
                  if (inProgressMeasurement === 'true') {
                    return 'new-measurement-screen'
                  }
                  return 'home-screen'
                }
                return prev
              })
            } else {
              setCurrentScreen(prev => {
                const publicScreens = ['welcome-screen', 'login-screen', 'signup-screen', 'forgot-password-screen']
                if (publicScreens.includes(prev)) return prev
                return 'welcome-screen'
              })
            }
          })
        } else {
          attempts++
          if (attempts >= maxAttempts) {
            clearInterval(waitForClient)
            console.log('[React Init] Supabase timeout, falling back to welcome screen')
            setCurrentScreen('welcome-screen')
          }
        }
      }, 100)
    }
    checkAuth()
  }, [])

  useEffect(() => {
    // Initialize theme early (before app.js loads) to prevent flash
    if (typeof window !== 'undefined') {
      const savedTheme = (localStorage.getItem('measurement_vault_theme') || 'dark') as 'dark' | 'light'
      setThemeState(savedTheme)
      document.documentElement.setAttribute('data-theme', savedTheme)

      // Initialize Supabase client globally for app.js to use
      // Only create one instance to avoid multiple GoTrueClient warnings
      if (!(window as any).supabaseClient && !(window as any).supabaseInitInProgress) {
        (window as any).supabaseInitInProgress = true;
        (async () => {
          try {
            const { createClient } = await import('@supabase/supabase-js')
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
            const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
            if (supabaseUrl && supabaseKey) {
              // Only create if it doesn't exist (prevent multiple instances)
              if (!(window as any).supabaseClient) {
                (window as any).supabaseClient = createClient(supabaseUrl, supabaseKey, {
                  auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true
                  }
                })
                console.log('Supabase client initialized successfully')
              }
            } else {
              console.error('Supabase environment variables not set:', {
                url: !!supabaseUrl,
                key: !!supabaseKey
              })
              console.error('Please create a .env.local file with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY')
            }
          } catch (err) {
            console.error('Failed to initialize Supabase:', err)
          } finally {
            (window as any).supabaseInitInProgress = false;
          }
        })()
      } else if ((window as any).supabaseClient) {
        console.log('Supabase client already initialized')
      }

      // Register Service Worker for PWA
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
          navigator.serviceWorker.register('/service-worker.js')
            .then((registration) => {
              console.log('[PWA] Service Worker registered successfully:', registration.scope)
            })
            .catch((error) => {
              console.warn('[PWA] Service Worker registration failed:', error)
            })
        })
      }
    }
  }, [])

  const toggleTheme = () => {
    if (typeof window !== 'undefined') {
      const newTheme = theme === 'dark' ? 'light' : 'dark'
      setThemeState(newTheme)
      document.documentElement.setAttribute('data-theme', newTheme)
      localStorage.setItem('measurement_vault_theme', newTheme)

      // Also trigger the app.js function if it exists
      if (typeof (window as any).setTheme === 'function') {
        (window as any).setTheme(newTheme)
      }
    }
  }

  return (
    <>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Loading overlay - only when explicitly loading */}
      <div id="app-loading-screen" style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'var(--bg-primary)',
        display: currentScreen === 'app-loading-screen' ? 'flex' : 'none',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        fontFamily: 'inherit'
      }}>
        {/* ... (loading inner content handled above is same, just hidden via display) ... */}
        {/* We actually need to keep the content here or inside the div above */}
        <div style={{
          textAlign: 'center',
          color: 'var(--text-primary)'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid var(--bg-card)',
            borderTopColor: 'var(--accent-yellow)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 16px'
          }}></div>
          <div>Loading...</div>
        </div>
      </div>

      <WelcomeScreen currentScreen={currentScreen} onNavigate={handleNavigate} />

      <AuthScreen currentScreen={currentScreen} onNavigate={handleNavigate} />

      <BusinessSetupScreen currentScreen={currentScreen} onNavigate={handleNavigate} />

      <DashboardScreen theme={theme} toggleTheme={toggleTheme} currentScreen={currentScreen} onNavigate={handleNavigate} />

      <SettingsScreen theme={theme} toggleTheme={toggleTheme} currentScreen={currentScreen} onNavigate={handleNavigate} />

      <EditBusinessScreen theme={theme} toggleTheme={toggleTheme} currentScreen={currentScreen} onNavigate={handleNavigate} />

      <BusinessLoginScreen currentScreen={currentScreen} onNavigate={handleNavigate} />

      <NewMeasurementScreen theme={theme} toggleTheme={toggleTheme} currentScreen={currentScreen} onNavigate={handleNavigate} />

      <SearchMeasurementScreen theme={theme} toggleTheme={toggleTheme} currentScreen={currentScreen} onNavigate={handleNavigate} />

      <ClientsScreen theme={theme} toggleTheme={toggleTheme} currentScreen={currentScreen} onNavigate={handleNavigate} />

      <ClientDetailsScreen theme={theme} toggleTheme={toggleTheme} currentScreen={currentScreen} onNavigate={handleNavigate} />

      <EditClientScreen theme={theme} toggleTheme={toggleTheme} currentScreen={currentScreen} onNavigate={handleNavigate} />

      <MeasurementDetailScreen theme={theme} toggleTheme={toggleTheme} currentScreen={currentScreen} onNavigate={handleNavigate} />

      <Script src="/indexeddb.js" strategy="beforeInteractive" />
      <Script src="/sync-manager.js" strategy="beforeInteractive" />
      <Script src="/reconciliation.js" strategy="beforeInteractive" />
      <Script src="/immediate-sync.js" strategy="beforeInteractive" />
      <Script src="/app.js" strategy="afterInteractive" />

      {/* Mobile Footer Navigation */}
      <MobileFooter currentScreen={currentScreen} />
    </>
  )
}
