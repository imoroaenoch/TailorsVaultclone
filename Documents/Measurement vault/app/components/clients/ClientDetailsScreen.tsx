'use client'

import React from 'react'

interface ClientDetailsScreenProps {
    theme: 'dark' | 'light'
    toggleTheme: () => void
    currentScreen: string | null
    onNavigate: (screen: string) => void
}

export default function ClientDetailsScreen({ theme, toggleTheme, currentScreen, onNavigate }: ClientDetailsScreenProps) {
    return (
        <div id="client-details-screen" className="screen" style={{ display: currentScreen === 'client-details-screen' ? 'block' : 'none' }}>
            <nav className="top-navbar">
                <div className="navbar-content">
                    <button
                        id="back-from-details-btn"
                        className="navbar-back-btn"
                        title="Back"
                        aria-label="Back"
                        onClick={() => onNavigate('clients-screen')}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19 12H5M12 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <h1 className="navbar-business-name">Tailors Vault</h1>
                    <div className="navbar-actions">
                        <button
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
                        <button className="btn-settings" title="Settings" aria-label="Settings">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                        </button>
                    </div>
                </div>
            </nav>
            <div className="container">
                <div className="screen-header client-details-header">
                    <h2 id="client-details-name"></h2>
                    <div className="client-menu-wrapper">
                        <button id="client-menu-btn" className="btn-menu" aria-label="Client actions">⋮</button>
                        <div id="client-menu-dropdown" className="menu-dropdown">
                            <button
                                id="edit-client-btn"
                                className="menu-item"
                                onClick={() => onNavigate('edit-client-screen')}
                            >
                                Edit Client
                            </button>
                            <button id="add-measurement-menu-btn" className="menu-item">Add Measurement</button>
                            <button id="download-measurements-menu-btn" className="menu-item">Download Measurements</button>
                            <button id="delete-client-btn" className="menu-item menu-item-danger">Delete Client</button>
                        </div>
                    </div>
                </div>

                <div id="client-details-content" className="client-details"></div>

                <button id="add-measurement-from-details-btn" className="btn btn-primary" style={{ marginTop: '16px' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    Add Measurement
                </button>

                <button
                    id="download-client-measurements-btn"
                    className="btn btn-secondary"
                    style={{ marginTop: '12px', width: '100%' }}
                >
                    Download Measurements
                </button>
            </div>
        </div>
    )
}
