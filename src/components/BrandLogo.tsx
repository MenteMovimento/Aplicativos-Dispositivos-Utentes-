type BrandLogoProps = {
  compact?: boolean
  className?: string
}

export function BrandLogo({ compact = false, className = '' }: BrandLogoProps) {
  return (
    <div className={`brand-logo ${compact ? 'compact' : ''} ${className}`.trim()}>
      <svg className="brand-symbol" viewBox="0 0 96 96" aria-hidden="true">
        <circle className="brand-ring" cx="48" cy="48" r="36" />
        <path
          className="brand-mind brand-mind-left"
          d="M44 24c-8 0-15 6-15 14 0 2 .4 4 1.2 5.8C25 46.2 22 51.4 22 57c0 8.8 7.2 15.8 16 15.8h6V24Z"
        />
        <path
          className="brand-mind brand-mind-right"
          d="M52 24c7 0 12.8 4.7 14.5 11.2 6.8.8 12.1 6.6 12.1 13.7 0 5.1-2.8 9.7-7.1 12.1.2.9.3 1.7.3 2.7 0 7.1-5.8 12.8-13 12.8H52V24Z"
        />
        <path className="brand-divider" d="M48 23v50" />
      </svg>
      <span className="brand-word" aria-label="Mentemovimento">
        <span>MENTE</span>
        <span>MOVIMENTO</span>
      </span>
    </div>
  )
}
