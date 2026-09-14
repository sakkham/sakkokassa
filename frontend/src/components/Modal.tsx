import type { ReactNode } from 'react'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
}

/** Yleiskäyttöinen bottom-sheet-modaali (sakon lisäys, liittyminen jne.
 * käyttävät tätä myöhemmissä vaiheissa). */
export function Modal({ title, onClose, children }: ModalProps) {
  return (
    <div
      className="modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="modal">
        <div className="modal-handle" />
        <button className="modal-close" onClick={onClose} aria-label="Sulje">✕</button>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  )
}
