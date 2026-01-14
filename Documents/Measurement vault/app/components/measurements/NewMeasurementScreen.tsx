'use client'

import { useEffect } from 'react'
import AppContentWrapper from '../AppContentWrapper'

interface NewMeasurementScreenProps {
    theme: 'dark' | 'light'
    toggleTheme: () => void
    currentScreen: string | null
    onNavigate: (screen: string) => void
}

export default function NewMeasurementScreen({ theme, toggleTheme, currentScreen, onNavigate }: NewMeasurementScreenProps) {
    // Set in-progress flag when this screen is active
    useEffect(() => {
        if (currentScreen === 'new-measurement-screen') {
            localStorage.setItem('measurement-in-progress', 'true')
        }
    }, [currentScreen])

    // Wrap the back button to clear the flag
    const handleBack = () => {
        localStorage.removeItem('measurement-in-progress')
        onNavigate('home-screen')
    }

    return (
        <div id="new-measurement-screen" className="screen" style={{ display: currentScreen === 'new-measurement-screen' ? 'block' : 'none' }}>
            <nav className="top-navbar">
                <div className="navbar-content">
                    <button
                        id="back-from-new-btn"
                        className="navbar-back-btn"
                        title="Back"
                        aria-label="Back"
                        onClick={handleBack}
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
                    <h2>New Measurement</h2>
                </div>

                <form id="measurement-form" className="measurement-form-container">
                    <div className="form-section-card">
                        <h3 className="form-section-title">Client</h3>
                        <div className="form-section-content">
                            <div className="form-group">
                                <label htmlFor="client-name">Client Name <span className="required">*</span></label>
                                <input type="text" id="client-name" required autoComplete="off" />
                            </div>

                            <div className="form-group">
                                <label htmlFor="phone-number">Phone Number</label>
                                <input type="tel" id="phone-number" autoComplete="off" />
                            </div>

                            <div className="form-group">
                                <label htmlFor="client-sex">Sex <span className="required">*</span></label>
                                <select id="client-sex" required>
                                    <option value="">Select sex</option>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="form-section-card">
                        <h3 className="form-section-title">Garment</h3>
                        <div className="form-section-content">
                            <div className="form-group">
                                <label htmlFor="garment-type">Garment Type</label>
                                <select id="garment-type">
                                    <option value="">Select garment type</option>
                                </select>
                            </div>

                            <div className="form-group" id="custom-garment-group" style={{ display: 'none' }}>
                                <label htmlFor="custom-garment-name">Custom Garment Name <span className="required">*</span></label>
                                <input type="text" id="custom-garment-name" autoComplete="off" placeholder="e.g., Agbada, Jacket, etc." />
                            </div>
                        </div>
                    </div>

                    <div className="measurements-section">
                        <h3 className="measurements-section-title">Measurements</h3>
                        <div className="measurements-grid">
                            <div className="form-group">
                                <label htmlFor="shoulder">Shoulder</label>
                                <input type="number" id="shoulder" step="0.1" min="0" placeholder="0.0" autoComplete="off" />
                            </div>

                            <div className="form-group">
                                <label htmlFor="chest">Chest</label>
                                <input type="number" id="chest" step="0.1" min="0" placeholder="0.0" autoComplete="off" />
                            </div>

                            <div className="form-group">
                                <label htmlFor="waist">Waist</label>
                                <input type="number" id="waist" step="0.1" min="0" placeholder="0.0" autoComplete="off" />
                            </div>

                            <div className="form-group">
                                <label htmlFor="sleeve">Sleeve</label>
                                <input type="number" id="sleeve" step="0.1" min="0" placeholder="0.0" autoComplete="off" />
                            </div>

                            <div className="form-group">
                                <label htmlFor="length">Length</label>
                                <input type="number" id="length" step="0.1" min="0" placeholder="0.0" autoComplete="off" />
                            </div>

                            <div className="form-group">
                                <label htmlFor="neck">Neck</label>
                                <input type="number" id="neck" step="0.1" min="0" placeholder="0.0" autoComplete="off" />
                            </div>

                            <div className="form-group">
                                <label htmlFor="hip">Hip</label>
                                <input type="number" id="hip" step="0.1" min="0" placeholder="0.0" autoComplete="off" />
                            </div>

                            <div className="form-group">
                                <label htmlFor="inseam">Inseam</label>
                                <input type="number" id="inseam" step="0.1" min="0" placeholder="0.0" autoComplete="off" />
                            </div>

                            <div className="form-group">
                                <label htmlFor="thigh">Thigh</label>
                                <input type="number" id="thigh" step="0.1" min="0" placeholder="0.0" autoComplete="off" />
                            </div>

                            <div className="form-group">
                                <label htmlFor="seat">Seat</label>
                                <input type="number" id="seat" step="0.1" min="0" placeholder="0.0" autoComplete="off" />
                            </div>

                            {/* Custom fields will be inserted here inline */}
                            <div id="custom-fields-container"></div>

                            {/* Add Custom Field Button (hidden by default, shown after garment type selection) */}
                            <div className="form-group add-custom-field-wrapper" id="add-custom-field-wrapper" style={{ display: 'none' }}>
                                <button type="button" id="add-custom-field-btn" className="btn-add-field-inline">+ Add Measurement</button>
                            </div>
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="notes">Notes / Remarks</label>
                        <textarea id="notes" rows={3} autoComplete="off"></textarea>
                    </div>

                    <button type="submit" className="btn btn-primary btn-save">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                            <polyline points="17 21 17 13 7 13 7 21"></polyline>
                            <polyline points="7 3 7 8 15 8"></polyline>
                        </svg>
                        Save Measurement
                    </button>
                </form>
            </AppContentWrapper>
        </div>
    )
}
