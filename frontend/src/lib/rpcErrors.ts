/** Suomenkieliset virheviestit kannan RPC-funktioiden `raise exception '<koodi>'`
 * -virhekoodeille (ks. supabase/migrations/20260914130000_write_rpcs.sql).
 * Vastaa vanhan Index.html:n errMsg()-taulukkoa. */
const MESSAGES: Record<string, string> = {
  missing_fields: 'Täytä kaikki kentät.',
  unauthorized: 'Sinulla ei ole tähän oikeutta.',
  unauthorized_reject: 'Vain ylläpitäjä voi hylätä ehdotuksen.',
  cannot_vote_own: 'Et voi äänestää omaa ehdotustasi.',
  cannot_reject_own: 'Et voi hylätä itseäsi koskevaa sakkoehdotusta.',
  already_voted: 'Olet jo äänestänyt tätä ehdotusta.',
  already_resolved: 'Tämä ehdotus on jo käsitelty.',
  fee_not_found: 'Sakkoa ei löydy.',
  member_not_found: 'Jäsentä ei löydy.',
  suggestion_not_found: 'Ehdotusta ei löydy.',
  user_not_found: 'Käyttäjää ei löydy.',
  not_found: 'Kohdetta ei löydy.',
  not_member: 'Et ole tämän joukkueen jäsen.',
  already_member: 'Olet jo tässä joukkueessa.',
  username_taken: 'Tämä käyttäjänimi on jo käytössä tässä joukkueessa.',
  invalid_role: 'Virheellinen rooli.',
  invalid_vote_threshold: 'Äänimäärän täytyy olla 1–20.',
  invalid_max_fee: 'Maksimisumman täytyy olla vähintään 1.',
  player_suggest_disabled: 'Pelaajien sakkoehdotukset on poistettu käytöstä tässä joukkueessa.',
  exceeds_max_fee: 'Sakko ylittää suurimman sallitun summan.',
  no_active_fees: 'Ei aktiivisia sakkoja merkittäväksi maksetuksi.',
}

export function rpcErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : String(error)
  return MESSAGES[code] ?? 'Yhteysvirhe. Yritä uudelleen.'
}
