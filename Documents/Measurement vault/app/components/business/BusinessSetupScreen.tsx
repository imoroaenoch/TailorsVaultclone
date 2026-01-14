'use client'

import React from 'react'

interface BusinessSetupScreenProps {
    currentScreen: string | null
    onNavigate: (screen: string) => void
}

export default function BusinessSetupScreen({ currentScreen, onNavigate }: BusinessSetupScreenProps) {
    return (
        <div id="business-setup-screen" className="screen" style={{ display: currentScreen === 'business-setup-screen' ? 'block' : 'none' }}>
            <div className="business-setup-container">
                <div className="business-setup-wrapper">
                    <div className="business-setup-logo">
                        {/* Replace this SVG with your logo image: <img src="/logo.png" alt="Tailor's Vault Logo" /> */}
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="currentColor" />
                        </svg>
                    </div>
                    <h1 className="business-setup-title">Tailor's Vault</h1>
                    <div className="business-setup-card">
                        <p className="business-setup-description">Register your business to get started</p>
                        <form id="business-setup-form">
                            <div className="form-group">
                                <label htmlFor="business-name">Business Name <span className="required">*</span></label>
                                <input type="text" id="business-name" required autoComplete="off" placeholder="e.g., Elite Tailors" />
                            </div>

                            <div className="form-group">
                                <label htmlFor="business-email">Business Email <span className="optional">(Optional)</span></label>
                                <input type="email" id="business-email" autoComplete="off" placeholder="e.g., info@elitetailors.com" />
                                <small className="form-helper-text">Optional: For account recovery and multi-device access</small>
                            </div>

                            <div className="form-group">
                                <label htmlFor="business-phone">Business Phone <span className="required">*</span></label>
                                <input type="tel" id="business-phone" required autoComplete="off" placeholder="e.g., +234 800 000 0000" />
                            </div>

                            <button type="submit" className="btn btn-primary btn-save">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="9 18 15 12 9 6"></polyline>
                                </svg>
                                Continue
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    )
}
