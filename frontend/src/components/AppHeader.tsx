import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface AppHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
  /** Jos annettu, näyttää takaisin-nuolen joka linkittää tähän reittiin
   * (esim. joukkuenäkymästä takaisin dashboardille). */
  backTo?: string
}

/** Sovelluksen yläpalkki. Toiminnot (asetukset, uloskirjautuminen, jne.)
 * annetaan `actions`-slotina, koska niiden logiikka rakennetaan vasta
 * kirjautumisen/tilanhallinnan myötä myöhemmässä vaiheessa. */
export function AppHeader({ title, subtitle, actions, backTo }: AppHeaderProps) {
  return (
    <header className="header">
      {backTo && (
        <Link to={backTo} className="header-icon-btn" title="Takaisin" aria-label="Takaisin">←</Link>
      )}
      <div className="header-left">
        <h1>{title}</h1>
        {subtitle && <div className="subtitle">{subtitle}</div>}
      </div>
      {actions && <div className="header-right">{actions}</div>}
    </header>
  )
}
