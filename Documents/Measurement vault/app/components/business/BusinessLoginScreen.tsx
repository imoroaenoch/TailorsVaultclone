'use client'

import React from 'react'

interface BusinessLoginScreenProps {
    currentScreen: string | null
    onNavigate: (screen: string) => void
}

export default function BusinessLoginScreen({ currentScreen, onNavigate }: BusinessLoginScreenProps) {
    return (
        <div id="business-login-screen" className="screen" style={{ display: currentScreen === 'business-login-screen' ? 'block' : 'none' }}>
            <div className="container">
                <h1>Welcome Back</h1>
                <p className="setup-subtitle">Enter your business details to continue</p>

                <form id="business-login-form">
                    <div className="form-group">
                        <label htmlFor="login-business-name">Business Name <span className="required">*</span></label>
                        <input type="text" id="login-business-name" required autoComplete="off" />
                    </div>

                    <div className="form-group">
                        <label htmlFor="login-business-email">Business Email <span className="optional">(Optional)</span></label>
                        <input type="email" id="login-business-email" autoComplete="off" />
                        <small className="form-helper-text">Leave empty if you didn't set an email</small>
                    </div>

                    <div className="form-group">
                        <label htmlFor="login-business-phone">Business Phone <span className="required">*</span></label>
                        <input type="tel" id="login-business-phone" required autoComplete="off" />
                    </div>

                    <button type="submit" className="btn btn-primary btn-save">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                            <polyline points="10 17 15 12 10 7"></polyline>
                            <line x1="15" y1="12" x2="3" y2="12"></line>
                        </svg>
                        Login
                    </button>
                </form>
            </div>
        </div>
    )
}
