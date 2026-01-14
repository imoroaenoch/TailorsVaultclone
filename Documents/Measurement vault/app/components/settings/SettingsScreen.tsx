'use client'

import AppContentWrapper from '../AppContentWrapper'

interface SettingsScreenProps {
    theme: 'dark' | 'light'
    toggleTheme: () => void
    currentScreen: string | null
    onNavigate: (screen: string) => void
}

export default function SettingsScreen({ theme, toggleTheme, currentScreen, onNavigate }: SettingsScreenProps) {
    return (
        <div id="settings-screen" className="screen" style={{ display: currentScreen === 'settings-screen' ? 'block' : 'none' }}>
            <nav className="top-navbar">
                <div className="navbar-content">
                    <button
                        id="back-from-settings-btn"
                        className="navbar-back-btn"
                        title="Back"
                        aria-label="Back"
                        onClick={() => onNavigate('home-screen')}
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
                                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l-.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                        </button>
                    </div>
                </div>
            </nav>
            <AppContentWrapper>
                <div className="screen-header">
                    <h2>Settings</h2>
                </div>

                <div className="settings-content">
                    <div className="settings-section">
                        <h3>Business Info</h3>
                        <div id="business-info-display" className="business-info"></div>
                        <button id="edit-business-btn" className="btn btn-secondary" style={{ marginTop: '16px' }}>
                            Edit Business
                        </button>
                    </div>

                    <div className="settings-section" style={{ marginTop: '40px' }}>
                        <h3>Exports</h3>
                        <p className="settings-info">
                            Download measurements for reporting or backup. Uses your current business and clients.
                        </p>
                        <button
                            id="download-all-measurements-btn"
                            className="btn btn-secondary"
                            style={{ marginTop: '12px' }}
                        >
                            Download All Clients&apos; Measurements
                        </button>
                    </div>

                    <div className="settings-section" style={{ marginTop: '40px' }}>
                        <h3>Email Linking</h3>
                        <p className="settings-info">Link your email to sync data across devices and enable account recovery.</p>
                        <div id="email-linking-status" className="email-linking-status"></div>
                        <div id="email-linking-form" className="email-linking-form" style={{ display: 'none' }}>
                            <div className="form-group" style={{ marginTop: '16px' }}>
                                <label htmlFor="link-email-input">Email Address</label>
                                <input
                                    type="email"
                                    id="link-email-input"
                                    autoComplete="email"
                                    placeholder="your@email.com"
                                    style={{ marginTop: '8px' }}
                                />
                            </div>
                            <button id="send-verification-btn" className="btn btn-primary" style={{ marginTop: '12px' }}>
                                Send Verification Link
                            </button>
                        </div>
                        <div id="email-verification-pending" className="email-verification-pending" style={{ display: 'none' }}>
                            <p className="settings-info" style={{ marginBottom: '12px' }}>
                                Verification email sent! Check your inbox and click the link to verify.
                            </p>
                            <button id="resend-verification-btn" className="btn btn-secondary" style={{ marginRight: '8px' }}>
                                Resend Email
                            </button>
                            <button id="cancel-verification-btn" className="btn btn-secondary">
                                Cancel
                            </button>
                        </div>
                    </div>

                    <div className="settings-section" style={{ marginTop: '40px' }}>
                        <h3>Change Password</h3>
                        <p className="settings-info">Update your account password to keep your account secure.</p>
                        <form id="change-password-form" style={{ marginTop: '16px' }}>
                            <div className="form-section-card">
                                <div className="form-section-content">
                                    <div className="form-group">
                                        <label htmlFor="current-password">Current Password <span className="required">*</span></label>
                                        <input
                                            type="password"
                                            id="current-password"
                                            required
                                            autoComplete="current-password"
                                            placeholder="Enter your current password"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="new-password">New Password <span className="required">*</span></label>
                                        <input
                                            type="password"
                                            id="new-password"
                                            required
                                            autoComplete="new-password"
                                            placeholder="Enter your new password"
                                            minLength={6}
                                        />
                                        <small className="form-helper-text">Minimum 6 characters</small>
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="confirm-new-password">Confirm New Password <span className="required">*</span></label>
                                        <input
                                            type="password"
                                            id="confirm-new-password"
                                            required
                                            autoComplete="new-password"
                                            placeholder="Confirm your new password"
                                            minLength={6}
                                        />
                                    </div>
                                </div>
                            </div>
                            <button type="submit" className="btn btn-primary btn-save">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                                    <line x1="12" y1="22.08" x2="12" y2="12"></line>
                                </svg>
                                Update Password
                            </button>
                        </form>
                        <div id="change-password-error" className="form-error-message" style={{ display: 'none' }}></div>
                        <div id="change-password-success" className="form-success-message" style={{ display: 'none' }}></div>
                    </div>

                    <div className="settings-section" style={{ marginTop: '40px' }}>
                        <h3>Session</h3>
                        <p className="settings-info">Log out without deleting your data.</p>
                        <button
                            id="logout-btn"
                            className="btn btn-secondary"
                            onClick={() => {
                                // Let app.js handle the logout logic, but we can also nav to login if needed
                                // Usually app.js listener will trigger, but explicit nav is redundant but safe-ish
                                // onNavigate('login-screen') // Let's respect app.js logic which might reload
                            }}
                        >
                            Logout
                        </button>
                    </div>

                    <div className="settings-section" style={{ marginTop: '40px' }}>
                        <h3>Danger Zone</h3>
                        <p className="settings-warning">This will permanently delete all your data including clients and measurements.</p>
                        <button id="reset-business-btn" className="btn btn-delete">
                            Reset Business
                        </button>
                    </div>
                </div>
            </AppContentWrapper>
        </div>
    )
}
