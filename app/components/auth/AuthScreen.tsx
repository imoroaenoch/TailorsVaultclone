'use client'

import React, { useEffect } from 'react'

interface AuthScreenProps {
    currentScreen: string | null
    onNavigate: (screen: string) => void
}

export default function AuthScreen({ currentScreen, onNavigate }: AuthScreenProps) {
    useEffect(() => {
        // Re-setup form listeners whenever the screen changes to an auth screen
        const timer = setTimeout(() => {
            if (typeof (window as any).setupAuthForms === 'function') {
                (window as any).setupAuthForms();
            }
        }, 100); // Small delay to ensure DOM is ready
        return () => clearTimeout(timer);
    }, [currentScreen])

    if (!['login-screen', 'signup-screen', 'forgot-password-screen'].includes(currentScreen || '')) return null

    const isLogin = currentScreen === 'login-screen'
    const isSignup = currentScreen === 'signup-screen'
    const isForgot = currentScreen === 'forgot-password-screen'

    return (
        <div id={currentScreen || ''} className="screen auth-screen-wrapper active">
            {/* Top Image Header Section */}
            <div className="auth-header-image"></div>

            {/* Bottom Auth Card Container */}
            <div className="auth-card-container">
                <div className="auth-card-content">
                    <h1 className="auth-app-name" style={{ marginTop: '0' }}>
                        {isLogin ? 'Welcome back' : isSignup ? 'Create account' : 'Reset Password'}
                    </h1>

                    <div className="auth-form-wrapper">
                        {isLogin && (
                            <form id="login-form">
                                <div className="form-group">
                                    <div className="auth-input-wrapper">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                                        <input type="email" id="login-email" required autoComplete="email" placeholder="Email address" />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <div className="auth-input-wrapper">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                        <input type="password" id="login-password" required autoComplete="current-password" placeholder="Password" />
                                    </div>
                                </div>

                                <button type="submit" className="auth-vibrant-btn">
                                    Login To Your Account
                                </button>

                                <button
                                    type="button"
                                    className="auth-google-btn"
                                    onClick={() => onNavigate('forgot-password-screen')}
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                    </svg>
                                    Forgot Password?
                                </button>

                                <div className="auth-footer-text">
                                    Don't have an account? <a href="#" className="auth-footer-link" onClick={(e) => { e.preventDefault(); onNavigate('signup-screen') }}>Sign Up</a>
                                </div>
                                <div id="login-error" style={{ marginTop: '16px', padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(255, 212, 0, 0.1)', color: 'var(--accent-yellow)', fontSize: '14px', display: 'none', textAlign: 'center' }}></div>
                            </form>
                        )}

                        {isSignup && (
                            <form id="signup-form">
                                <div className="form-group">
                                    <div className="auth-input-wrapper">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                                        <input type="email" id="signup-email" required autoComplete="email" placeholder="Email address" />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <div className="auth-input-wrapper">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                        <input type="password" id="signup-password" required autoComplete="new-password" placeholder="Password" />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <div className="auth-input-wrapper">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                        <input type="password" id="signup-confirm-password" required autoComplete="new-password" placeholder="Confirm Password" />
                                    </div>
                                </div>

                                <button type="submit" className="auth-vibrant-btn">
                                    Create Account
                                </button>

                                <div className="auth-footer-text">
                                    Already have an account? <a href="#" className="auth-footer-link" onClick={(e) => { e.preventDefault(); onNavigate('login-screen') }}>Login</a>
                                </div>
                                <div id="signup-error" style={{ marginTop: '16px', padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(255, 212, 0, 0.1)', color: 'var(--accent-yellow)', fontSize: '14px', display: 'none', textAlign: 'center' }}></div>
                                <div id="signup-success" style={{ marginTop: '16px', padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', fontSize: '14px', display: 'none', textAlign: 'center' }}></div>
                            </form>
                        )}

                        {isForgot && (
                            <form id="forgot-password-submit-form">
                                <div className="form-group">
                                    <div className="auth-input-wrapper">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                                        <input type="email" id="forgot-password-email" required autoComplete="email" placeholder="Email address" />
                                    </div>
                                </div>
                                <button type="submit" className="auth-vibrant-btn">
                                    Send Reset Link
                                </button>
                                <div className="auth-footer-text">
                                    <a href="#" className="auth-footer-link" onClick={(e) => { e.preventDefault(); onNavigate('login-screen') }}>Back to Login</a>
                                </div>
                                <div id="forgot-password-error" style={{ display: 'none', marginTop: '16px', textAlign: 'center', backgroundColor: 'rgba(255, 212, 0, 0.1)', color: 'var(--accent-yellow)', padding: '12px', borderRadius: '8px' }}></div>
                                <div id="forgot-password-success" style={{ display: 'none', marginTop: '16px', textAlign: 'center', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '12px', borderRadius: '8px' }}></div>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
