import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
import { toSyntheticEmail } from '../lib/auth'

export interface Profile {
  id: string
  username: string
  globalRole: string
}

interface AuthContextValue {
  session: Session | null
  profile: Profile | null
  /** Alkuperäisen istunnon/profiilin lataus on kesken. */
  loading: boolean
  checkUsernameExists: (username: string) => Promise<boolean>
  register: (username: string, password: string) => Promise<void>
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const userId = session?.user.id
    if (!userId) {
      setProfile(null)
      return
    }

    let cancelled = false
    supabase
      .from('profiles')
      .select('id, username, global_role')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (cancelled || !data) return
        setProfile({ id: data.id, username: data.username, globalRole: data.global_role })
      })

    return () => { cancelled = true }
  }, [session?.user.id])

  async function checkUsernameExists(username: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('username_exists', { p_username: username.trim() })
    if (error) throw error
    return data === true
  }

  async function register(username: string, password: string): Promise<void> {
    const trimmed = username.trim()
    const { error } = await supabase.auth.signUp({
      email: toSyntheticEmail(trimmed),
      password,
      options: { data: { username: trimmed } },
    })
    if (error) throw error
  }

  async function login(username: string, password: string): Promise<void> {
    const { error } = await supabase.auth.signInWithPassword({
      email: toSyntheticEmail(username),
      password,
    })
    if (error) throw error
  }

  async function logout(): Promise<void> {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, checkUsernameExists, register, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth() vaatii AuthProviderin')
  return ctx
}
