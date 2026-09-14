import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function IconButton({
    label,
    children,
    className = '',
    ...props
}: {
    label: string;
    children: ReactNode;
    className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
    return (
        <button type="button" className={`icon-button ${className}`} aria-label={label} data-tooltip={label} {...props}>
            {children}
        </button>
    );
}

