'use client'

import { useState } from 'react'
import AppContentWrapper from '../AppContentWrapper'

interface SettingsScreenProps {
    theme: 'dark' | 'light'
    toggleTheme: () => void
    currentScreen: string | null
    onNavigate: (screen: string) => void
}

export default function SettingsScreen({ theme, toggleTheme, currentScreen, onNavigate }: SettingsScreenProps) {
    const [showSupportModal, setShowSupportModal] = useState(false)
    const [supportStep, setSupportStep] = useState<'initial' | 'bank-details'>('initial')
    const [showContactModal, setShowContactModal] = useState(false)
    const [contactSubmitted, setContactSubmitted] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text).then(() => {
            alert(`${label} copied to clipboard!`)
        }).catch(err => {
            console.error('Failed to copy: ', err)
        })
    }
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
                        <button id="edit-business-btn" className="btn btn-secondary" style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                            Edit Business
                        </button>
                    </div>

                    <div className="settings-section">
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

                    <div className="settings-section">
                        <h3>Exports</h3>
                        <p className="settings-info">
                            Download measurements for reporting or backup. Uses your current business and clients.
                        </p>
                        <button
                            id="download-all-measurements-btn"
                            className="btn btn-secondary"
                            style={{ marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                            Download All Measurements
                        </button>
                    </div>

                    <div className="settings-section">
                        <h3>Support Tailor&apos;s Vault ❤️</h3>
                        <p className="settings-info">
                            We plan to keep this app 100% free for tailors and fashion businesses.
                            If this app has helped you save time or avoid lost measurements,
                            you can support its development to help us keep improving it.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                            <button
                                className="btn btn-primary"
                                onClick={() => setShowSupportModal(true)}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                            >
                                Support the App
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={() => setShowSupportModal(true)}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                            >
                                Learn More
                            </button>
                        </div>
                    </div>

                    <div className="settings-section">
                        <h3>Need Help? Contact Us 📩</h3>
                        <p className="settings-info">
                            Have questions, suggestions, or need technical support? We&apos;re here to help you get the most out of Tailor&apos;s Vault.
                        </p>
                        <button
                            className="btn btn-secondary"
                            onClick={() => {
                                setContactSubmitted(false);
                                setShowContactModal(true);
                            }}
                            style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                                <polyline points="22,6 12,13 2,6"></polyline>
                            </svg>
                            Send Message
                        </button>
                    </div>

                    <div className="settings-section">
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
                            <button type="submit" className="btn btn-primary btn-save" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
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

                    <div className="settings-section">
                        <h3>Session</h3>
                        <p className="settings-info">Log out without deleting your data.</p>
                        <button
                            id="logout-btn"
                            className="btn btn-secondary"
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                            onClick={() => {
                                // Let app.js handle the logout logic, but we can also nav to login if needed
                                // Usually app.js listener will trigger, but explicit nav is redundant but safe-ish
                                // onNavigate('login-screen') // Let's respect app.js logic which might reload
                            }}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                <polyline points="16 17 21 12 16 7"></polyline>
                                <line x1="21" y1="12" x2="9" y2="12"></line>
                            </svg>
                            Logout
                        </button>
                    </div>

                    <div className="settings-section">
                        <h3>Danger Zone</h3>
                        <p className="settings-warning">This will permanently delete all your data including clients and measurements.</p>
                        <button id="reset-business-btn" className="btn btn-delete" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                <line x1="10" y1="11" x2="10" y2="17"></line>
                                <line x1="14" y1="11" x2="14" y2="17"></line>
                            </svg>
                            Reset Business
                        </button>
                    </div>
                </div>
            </AppContentWrapper>

            {/* Support Tailor's Vault Modal */}
            {showSupportModal && (
                <div className="add-field-modal" style={{ display: 'flex' }} onClick={(e) => {
                    if (e.target === e.currentTarget) {
                        setShowSupportModal(false);
                        setSupportStep('initial');
                    }
                }}>
                    <div className="add-field-modal-content" style={{ maxWidth: '500px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '700' }}>Support Tailor&apos;s Vault ❤️</h3>
                            <button
                                onClick={() => {
                                    setShowSupportModal(false);
                                    setSupportStep('initial');
                                }}
                                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>

                        {supportStep === 'initial' ? (
                            <>
                                <div style={{ maxHeight: '60vh', overflowY: 'auto', marginBottom: '24px' }}>
                                    <p style={{ fontSize: '15px', lineHeight: '1.6', color: 'var(--text-primary)', marginBottom: '16px' }}>
                                        Tailor’s Vault was built to help tailors and fashion businesses never lose client measurements again.
                                        We are committed to keeping this app 100% free — no subscriptions, no hidden charges.
                                    </p>
                                    <p style={{ fontSize: '15px', lineHeight: '1.6', color: 'var(--text-primary)', marginBottom: '16px' }}>
                                        Running and improving the app comes with costs.
                                        If Tailor’s Vault has helped your business, you can choose to support its development with a contribution.
                                        Your support helps us improve features, maintain offline access, keep data secure, and build better tools for tailors.
                                    </p>
                                </div>
                                <div className="add-field-modal-actions" style={{ flexDirection: 'column', gap: '12px' }}>
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => setSupportStep('bank-details')}
                                    >
                                        Support Development
                                    </button>
                                    <button
                                        className="btn btn-secondary"
                                        onClick={() => setShowSupportModal(false)}
                                    >
                                        Maybe Later
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div style={{ marginBottom: '24px' }}>
                                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                                        You can make a direct contribution using the bank details below. Thank you for your support!
                                    </p>

                                    <div className="form-section-card" style={{ padding: '16px', marginBottom: '20px' }}>
                                        {[
                                            { label: 'Bank Name', value: 'Palmpay' },
                                            { label: 'Account Name', value: 'Enoch Imoroa' },
                                            { label: 'Account Number', value: '9057616164' }
                                        ].map((item, idx) => (
                                            <div key={idx} style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                marginBottom: idx === 2 ? 0 : '16px'
                                            }}>
                                                <div>
                                                    <span style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>{item.label}</span>
                                                    <span style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>{item.value}</span>
                                                </div>
                                                <button
                                                    onClick={() => copyToClipboard(item.value, item.label)}
                                                    style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px', color: 'var(--accent-yellow)', cursor: 'pointer' }}
                                                    title={`Copy ${item.label}`}
                                                >
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                                    </svg>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="add-field-modal-actions" style={{ flexDirection: 'column', gap: '12px' }}>
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => {
                                            const details = `Bank Name: [Your Bank Name]\nAccount Name: [Your Account Name]\nAccount Number: [Your Account Number]`;
                                            copyToClipboard(details, 'All details');
                                        }}
                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                        </svg>
                                        Copy All Details
                                    </button>
                                    <button
                                        className="btn btn-secondary"
                                        onClick={() => {
                                            setShowSupportModal(false);
                                            setSupportStep('initial');
                                        }}
                                    >
                                        Done
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
            {/* Contact Us Modal */}
            {showContactModal && (
                <div className="add-field-modal" style={{ display: 'flex' }} onClick={(e) => {
                    if (e.target === e.currentTarget) setShowContactModal(false);
                }}>
                    <div className="add-field-modal-content" style={{ maxWidth: '500px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '700' }}>Contact Us 📩</h3>
                            <button
                                onClick={() => setShowContactModal(false)}
                                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>

                        {!contactSubmitted ? (
                            <form onSubmit={async (e) => {
                                e.preventDefault();
                                setIsSubmitting(true);

                                const formData = {
                                    name: (document.getElementById('contact-name') as HTMLInputElement).value,
                                    email: (document.getElementById('contact-email') as HTMLInputElement).value,
                                    message: (document.getElementById('contact-message') as HTMLTextAreaElement).value
                                };

                                try {
                                    const response = await fetch('/api/contact', {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json',
                                        },
                                        body: JSON.stringify(formData),
                                    });

                                    if (response.ok) {
                                        setContactSubmitted(true);
                                    } else {
                                        let errorMessage = 'Failed to send message';
                                        const contentType = response.headers.get('content-type');
                                        if (contentType && contentType.includes('application/json')) {
                                            const errorData = await response.json();
                                            errorMessage = errorData.error || errorMessage;
                                        }
                                        alert(`Error: ${errorMessage}`);
                                    }
                                } catch (error) {
                                    console.error('Submission error:', error);
                                    alert('An error occurred. Please try again later.');
                                } finally {
                                    setIsSubmitting(false);
                                }
                            }}>
                                <div className="form-group" style={{ marginBottom: '16px' }}>
                                    <label htmlFor="contact-name">Name <span className="required">*</span></label>
                                    <input
                                        type="text"
                                        id="contact-name"
                                        required
                                        placeholder="Your Name"
                                        style={{ marginTop: '8px' }}
                                    />
                                </div>
                                <div className="form-group" style={{ marginBottom: '16px' }}>
                                    <label htmlFor="contact-email">Email <span className="required">*</span></label>
                                    <input
                                        type="email"
                                        id="contact-email"
                                        required
                                        placeholder="your@email.com"
                                        style={{ marginTop: '8px' }}
                                    />
                                </div>
                                <div className="form-group" style={{ marginBottom: '24px' }}>
                                    <label htmlFor="contact-message">Message <span className="required">*</span></label>
                                    <textarea
                                        id="contact-message"
                                        required
                                        placeholder="How can we help you?"
                                        style={{ marginTop: '8px', minHeight: '120px' }}
                                    />
                                </div>
                                <div className="add-field-modal-actions" style={{ flexDirection: 'column', gap: '12px' }}>
                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                        disabled={isSubmitting}
                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                                                </svg>
                                                Sending...
                                            </>
                                        ) : 'Submit Message'}
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={() => setShowContactModal(false)}
                                        disabled={isSubmitting}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '20px 0' }}>
                                <div style={{
                                    width: '64px',
                                    height: '64px',
                                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    margin: '0 auto 20px',
                                    color: '#10b981'
                                }}>
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                </div>
                                <h4 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '12px', color: 'var(--text-primary)' }}>Message Sent!</h4>
                                <p style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '24px' }}>
                                    Thank you! We&apos;ve received your message and we&apos;ll get back to you as soon as possible.
                                </p>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => setShowContactModal(false)}
                                >
                                    Close
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
