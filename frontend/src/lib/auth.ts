// Käyttäjä kirjautuu pelkällä käyttäjätunnuksella + salasanalla, mutta
// Supabase Authissa käyttäjä tunnistetaan aina sähköpostiosoitteella.
// Ratkaisu: muodostetaan tunnuksesta deterministinen "näennäisosoite" —
// käyttäjä ei koskaan näe eikä syötä sitä.
const EMAIL_DOMAIN = 'sakko.local'

export const MIN_PASSWORD_LENGTH = 6

export function toSyntheticEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${EMAIL_DOMAIN}`
}
