import mentemovimentoLogo from '../assets/mentemovimento-logo.svg'

type BrandLogoProps = {
  compact?: boolean
  className?: string
}

export function BrandLogo({ compact = false, className = '' }: BrandLogoProps) {
  return (
    <div className={`brand-logo ${compact ? 'compact' : ''} ${className}`.trim()}>
      <img className="brand-image" src={mentemovimentoLogo} alt="Mentemovimento" />
    </div>
  )
}
