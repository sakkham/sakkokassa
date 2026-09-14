import type { ReactNode } from 'react'

interface AppHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
}

/** Sovelluksen yläpalkki. Toiminnot (asetukset, uloskirjautuminen, jne.)
 * annetaan `actions`-slotina, koska niiden logiikka rakennetaan vasta
 * kirjautumisen/tilanhallinnan myötä myöhemmässä vaiheessa. */
export function AppHeader({ title, subtitle, actions }: AppHeaderProps) {
  return (
    <header className="header">
      <div className="header-left">
        <h1>{title}</h1>
        {subtitle && <div className="subtitle">{subtitle}</div>}
      </div>
      {actions && <div className="header-right">{actions}</div>}
    </header>
  )
}
