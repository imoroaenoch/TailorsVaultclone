import React from 'react'

interface AppContentWrapperProps {
    children: React.ReactNode
    className?: string
    id?: string
}

export default function AppContentWrapper({ children, className = '', id }: AppContentWrapperProps) {
    return (
        <div
            id={id}
            className={`container app-content-wrapper ${className}`}
        >
            {children}
        </div>
    )
}
