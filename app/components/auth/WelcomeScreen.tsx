'use client'

import { useState, useEffect } from 'react'

interface WelcomeScreenProps {
    currentScreen: string
    onNavigate: (screenId: string) => void
}

const carouselItems = [
    {
        title: "Precision Matters ✨",
        description: "Never lose a client’s measurement again with our secure digital vault."
    },
    {
        title: "Always On 🌍",
        description: "Access measurements anytime, anywhere, even without an internet connection."
    },
    {
        title: "Tailored for Success 🧵",
        description: "Built specifically for modern tailors and growing fashion businesses."
    }
]

export default function WelcomeScreen({ currentScreen, onNavigate }: WelcomeScreenProps) {
    const [currentIndex, setCurrentIndex] = useState(0)
    const [fade, setFade] = useState(true)

    useEffect(() => {
        if (currentScreen !== 'welcome-screen') return

        const interval = setInterval(() => {
            setFade(false)
            setTimeout(() => {
                setCurrentIndex((prev) => (prev + 1) % carouselItems.length)
                setFade(true)
            }, 500)
        }, 4000)

        return () => clearInterval(interval)
    }, [currentScreen])

    if (currentScreen !== 'welcome-screen') return null

    return (
        <div className="welcome-screen">
            <div className="welcome-background">
                <div className="welcome-overlay"></div>
            </div>

            <div className="welcome-content">
                <div className="welcome-top">
                    <div className="welcome-brand">
                        <span className="brand-main">Tailors</span>
                        <span className="brand-sub">Vault</span>
                    </div>
                    <button
                        className="welcome-skip-btn"
                        onClick={() => onNavigate('login-screen')}
                    >
                        Skip
                    </button>
                </div>

                <div className="welcome-bottom">
                    <div className="welcome-carousel-container">
                        <div className={`welcome-carousel-content ${fade ? 'fade-in' : 'fade-out'}`}>
                            <h1 className="carousel-title">{carouselItems[currentIndex].title}</h1>
                            <p className="carousel-description">{carouselItems[currentIndex].description}</p>
                        </div>
                    </div>

                    <div className="welcome-footer">
                        <button
                            className="welcome-continue-btn"
                            onClick={() => onNavigate('login-screen')}
                        >
                            Get Started
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
