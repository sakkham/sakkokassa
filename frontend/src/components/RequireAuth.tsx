import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/** Päästää sisältöön vain kirjautuneena; muuten ohjaa kirjautumissivulle. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()

  if (loading) return <div className="loading">Ladataan...</div>
  if (!session) return <Navigate to="/" replace />
  return <>{children}</>
}

/** Käänteinen: kirjautunutta käyttäjää ei näytetä kirjautumissivulla. */
export function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()

  if (loading) return <div className="loading">Ladataan...</div>
  if (session) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}
