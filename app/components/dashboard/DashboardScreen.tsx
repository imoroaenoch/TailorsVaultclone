'use client'

import AppContentWrapper from '../AppContentWrapper'

interface DashboardScreenProps {
    theme: 'dark' | 'light'
    toggleTheme: () => void
    currentScreen: string | null
    onNavigate: (screen: string) => void
}

export default function DashboardScreen({ theme, toggleTheme, currentScreen, onNavigate }: DashboardScreenProps) {
    return (
        <div id="home-screen" className="screen" style={{ display: currentScreen === 'home-screen' ? 'block' : 'none' }}>
            <nav className="top-navbar">
                <div className="navbar-content">
                    <h1 className="navbar-business-name" id="business-header-name">Tailors Vault</h1>
                    <div className="navbar-actions">
                        <button
                            id="theme-toggle-btn"
                            className="btn-theme-toggle"
                            title="Toggle theme"
                            aria-label="Toggle theme"
                            onClick={toggleTheme}
                        >
                            {theme === 'dark' ? (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                                </svg>
                            ) : (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="5"></circle>
                                    <line x1="12" y1="1" x2="12" y2="3"></line>
                                    <line x1="12" y1="21" x2="12" y2="23"></line>
                                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                                    <line x1="1" y1="12" x2="3" y2="12"></line>
                                    <line x1="21" y1="12" x2="23" y2="12"></line>
                                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                                </svg>
                            )}
                        </button>
                        <button
                            id="settings-btn"
                            className="btn-settings"
                            title="Settings"
                            aria-label="Settings"
                            onClick={() => onNavigate('settings-screen')}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1-1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l-.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                        </button>
                    </div>
                </div>
            </nav>
            <AppContentWrapper>
                {/* Dashboard Welcome Section */}
                <div className="dashboard-greeting-card">
                    <div className="dashboard-welcome">
                        <h5 className="dashboard-greeting">Hi, <span id="dashboard-business-name">Tailors Vault</span> 👋</h5>
                        <p className="dashboard-subtext"></p>
                    </div>
                </div>


                {/* Unified Dashboard Action Card */}
                <div className="dashboard-action-unified-card">
                    {/* Primary Action (Wide Card) */}
                    <button
                        id="new-measurement-btn"
                        className="dashboard-action-card-wide"
                        onClick={() => onNavigate('new-measurement-screen')}
                    >
                        <div className="dashboard-card-wide-content">
                            <h2 className="dashboard-card-wide-title">New Measurement</h2>
                            <p className="dashboard-card-wide-text">Capture precision details for your next masterpiece.</p>
                            <span className="dashboard-card-wide-btn">Start Measuring</span>
                        </div>
                        <div className="dashboard-card-wide-graphic">
                            <img src="/bespoke_suit.png" alt="Bespoke blue suit" />
                        </div>
                    </button>

                    <div className="dashboard-secondary-grid">
                        {/* Secondary Actions (Side-by-Side) */}
                        <button
                            id="search-measurements-btn"
                            className="dashboard-action-card-small"
                            onClick={() => onNavigate('search-screen')}
                        >
                            <div className="dashboard-card-small-icon-container" style={{ backgroundColor: '#2a2a2a' }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent-yellow)' }}>
                                    <circle cx="11" cy="11" r="8"></circle>
                                    <path d="m21 21-4.35-4.35"></path>
                                </svg>
                            </div>
                            <div className="dashboard-card-small-info">
                                <h4 className="dashboard-card-small-title">Search Vault</h4>
                                <p className="dashboard-card-small-text">Find any measurement in seconds.</p>
                            </div>
                            <svg className="dashboard-card-small-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                                <polyline points="12 5 19 12 12 19"></polyline>
                            </svg>
                        </button>

                        <button
                            id="clients-btn"
                            className="dashboard-action-card-small"
                            onClick={() => onNavigate('clients-screen')}
                        >
                            <div className="dashboard-card-small-icon-container" style={{ backgroundColor: '#2a2a2a' }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent-yellow)' }}>
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="9" cy="7" r="4"></circle>
                                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                </svg>
                            </div>
                            <div className="dashboard-card-small-info">
                                <h4 className="dashboard-card-small-title">Clients</h4>
                                <p className="dashboard-card-small-text">Manage your client wardrobe data.</p>
                            </div>
                            <svg className="dashboard-card-small-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                                <polyline points="12 5 19 12 12 19"></polyline>
                            </svg>
                        </button>
                    </div>
                </div>


                <div className="recent-section">
                    <div className="recent-measurements-card">
                        <div className="recent-measurements-header">
                            <h3>Recent Measurements</h3>
                            <div id="recent-measurements-control"></div>
                        </div>
                        <div id="recent-measurements" className="recent-measurements-list"></div>
                    </div>
                </div>
            </AppContentWrapper>
        </div>
    )
}
