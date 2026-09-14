import { MIN_PASSWORD_LENGTH } from './auth'

/** Muuntaa Supabase Auth -virheen suomenkieliseksi viestiksi. Supabase-js
 * antaa virhekohtaisen `code`-kentän suurimmalle osalle Auth-virheistä;
 * osa (etenkin heikko salasana signUp:issa) tunnistetaan vain viestistä. */
export function authErrorMessage(error: unknown): string {
  const code = (error as { code?: string } | null)?.code
  const message = error instanceof Error ? error.message : String(error)

  if (code === 'invalid_credentials') return 'Väärä käyttäjätunnus tai salasana.'
  if (code === 'user_already_exists' || code === 'user_already_registered') {
    return 'Tunnus on jo käytössä.'
  }
  if (code === 'weak_password' || /password/i.test(message)) {
    return `Salasanan tulee olla vähintään ${MIN_PASSWORD_LENGTH} merkkiä.`
  }
  if (code === 'over_request_rate_limit') {
    return 'Liian monta yritystä. Yritä hetken kuluttua uudelleen.'
  }
  if (code === 'signup_disabled') {
    return 'Uusien tunnusten luonti ei ole tällä hetkellä käytössä.'
  }
  return 'Yhteysvirhe. Yritä uudelleen.'
}
