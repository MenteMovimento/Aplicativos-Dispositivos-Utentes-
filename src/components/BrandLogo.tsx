import mentemovimentoLogo from '../assets/mentemovimento-logo.svg'

type BrandLogoProps = {
  compact?: boolean
  className?: string
}

export function BrandLogo({ compact = false, className = '' }: BrandLogoProps) {
  const classes = ['brand-logo', compact ? 'compact' : '', className].filter(Boolean).join(' ')

  return (
    <div className={classes}>
      <img className="brand-image" src={mentemovimentoLogo} alt="Mentemovimento" />
    </div>
  )
}
