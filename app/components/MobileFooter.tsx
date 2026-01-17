'use client'

import { useEffect, useState } from 'react'

interface MobileFooterProps {
    currentScreen: string | null
}

export default function MobileFooter({ currentScreen }: MobileFooterProps) {
    const [isMobile, setIsMobile] = useState(false)
    const [isAuthenticated, setIsAuthenticated] = useState(false)

    // Screens where footer should NOT appear
    const excludedScreens = ['login-screen', 'signup-screen', 'forgot-password-screen', 'business-setup-screen', 'app-loading-screen']

    useEffect(() => {
        // Check if mobile on mount and resize
        const checkMobile = () => {
            setIsMobile(window.innerWidth <= 768)
        }

        checkMobile()
        window.addEventListener('resize', checkMobile)

        // Check authentication status
        const checkAuth = async () => {
            try {
                // Wait for Supabase to be available (with timeout)
                let attempts = 0
                const maxAttempts = 50 // 5 seconds max wait

                const waitForSupabase = (): Promise<any> => {
                    return new Promise((resolve) => {
                        const checkSupabase = () => {
                            if ((window as any).supabaseClient) {
                                resolve((window as any).supabaseClient)
                            } else if (attempts < maxAttempts) {
                                attempts++
                                setTimeout(checkSupabase, 100)
                            } else {
                                resolve(null)
                            }
                        }
                        checkSupabase()
                    })
                }

                const supabase = await waitForSupabase()

                if (supabase && typeof supabase.auth?.getSession === 'function') {
                    const { data: { session } } = await supabase.auth.getSession()
                    setIsAuthenticated(!!session)

                    // Subscribe to auth changes to keep footer in sync
                    supabase.auth.onAuthStateChange((_event: any, session: any) => {
                        setIsAuthenticated(!!session)
                    })
                } else {
                    setIsAuthenticated(false)
                }
            } catch (error) {
                console.error('Error checking auth:', error)
                setIsAuthenticated(false)
            }
        }

        checkAuth()

        return () => {
            window.removeEventListener('resize', checkMobile)
        }
    }, [])

    const handleHome = () => {
        // Clear in-progress flag when explicitly navigating home
        localStorage.removeItem('measurement-in-progress')

        // Wait for app.js to load, then use showScreen
        const tryShowScreen = () => {
            if (typeof (window as any).showScreen === 'function') {
                (window as any).showScreen('home-screen')
            } else {
                // Fallback: direct DOM manipulation
                const homeScreen = document.getElementById('home-screen')
                if (homeScreen) {
                    document.querySelectorAll('.screen').forEach(screen => {
                        screen.classList.remove('active')
                    })
                    homeScreen.classList.add('active')
                }
            }
        }

        // Try immediately, then retry after a short delay if app.js hasn't loaded
        tryShowScreen()
        setTimeout(tryShowScreen, 100)
    }

    const handleSearchClients = () => {
        // Clear in-progress flag when explicitly navigating away
        localStorage.removeItem('measurement-in-progress')

        const tryShowScreenAndLoad = () => {
            if (typeof (window as any).showScreen === 'function') {
                ; (window as any).showScreen('clients-screen')
            } else {
                const clientsScreen = document.getElementById('clients-screen')
                if (clientsScreen) {
                    document.querySelectorAll('.screen').forEach(screen => {
                        screen.classList.remove('active')
                    })
                    clientsScreen.classList.add('active')
                }
            }

            // After showing the screen, trigger client list render (same as dashboard button)
            if (typeof (window as any).renderClientsList === 'function') {
                // Defer to next frame so DOM is ready
                requestAnimationFrame(() => {
                    ; (window as any).renderClientsList()
                })
            }
        }

        // Try immediately, then retry once more in case app.js isn't ready yet
        tryShowScreenAndLoad()
        setTimeout(tryShowScreenAndLoad, 100)
    }

    const handleNewMeasurement = () => {
        const newMeasurementBtn = document.getElementById('new-measurement-btn')
        if (newMeasurementBtn) {
            newMeasurementBtn.click()
        }
    }

    const handleSearchMeasurements = () => {
        // Clear in-progress flag when explicitly navigating away
        localStorage.removeItem('measurement-in-progress')

        const searchBtn = document.getElementById('search-measurements-btn')
        if (searchBtn) {
            searchBtn.click()
        }
    }

    const handleSettings = () => {
        // Clear in-progress flag when explicitly navigating away
        localStorage.removeItem('measurement-in-progress')

        const settingsBtn = document.getElementById('settings-btn')
        if (settingsBtn) {
            settingsBtn.click()
        }
    }

    // Determine if footer should be shown
    // Determine if footer should be shown
    // Must be mobile
    // Must be authenticated
    // Must NOT be on an excluded screen (Auth pages)
    const shouldShow = isMobile && isAuthenticated && currentScreen && !excludedScreens.includes(currentScreen)

    // Don't render if conditions are not met
    if (!shouldShow) {
        return null
    }

    return (
        <footer className="mobile-footer">
            <div className="mobile-footer-container">
                {/* Home Button */}
                <button
                    className={`mobile-footer-btn ${currentScreen === 'home-screen' ? 'active' : ''}`}
                    onClick={handleHome}
                    aria-label="Home"
                    title="Home"
                >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                        <polyline points="9 22 9 12 15 12 15 22"></polyline>
                    </svg>
                </button>

                {/* Search Clients Button */}
                <button
                    className={`mobile-footer-btn ${currentScreen === 'clients-screen' ? 'active' : ''}`}
                    onClick={handleSearchClients}
                    aria-label="Search Clients"
                    title="Search Clients"
                >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                        <circle cx="18" cy="18" r="3"></circle>
                        <path d="m21 21-1.5-1.5"></path>
                    </svg>
                </button>

                {/* Add New Measurement Button (Floating) */}
                <button
                    className="mobile-footer-btn mobile-footer-btn-primary"
                    onClick={handleNewMeasurement}
                    aria-label="New Measurement"
                    title="New Measurement"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                </button>

                {/* Search Measurements Button */}
                <button
                    className={`mobile-footer-btn ${currentScreen === 'search-screen' ? 'active' : ''}`}
                    onClick={handleSearchMeasurements}
                    aria-label="Search Measurements"
                    title="Search Measurements"
                >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"></circle>
                        <path d="m21 21-4.35-4.35"></path>
                    </svg>
                </button>

                {/* Settings Button */}
                <button
                    className={`mobile-footer-btn ${currentScreen === 'settings-screen' ? 'active' : ''}`}
                    onClick={handleSettings}
                    aria-label="Settings"
                    title="Settings"
                >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                </button>
            </div>
        </footer>
    )
}
