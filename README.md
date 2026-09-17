# Sakkokassa

Joukkueen sakkokassan seurantasovellus — [sakkham.github.io/sakkokassa](https://sakkham.github.io/sakkokassa/)

## Teknologiat

- **Frontend:** React + TypeScript (Vite), React Router
- **Backend:** Supabase (PostgreSQL + Auth + Row Level Security)
- **Julkaisu:** GitHub Pages, automaattisesti GitHub Actionsilla (`.github/workflows/deploy.yml`)

## Ylläpito

- `.github/workflows/keepalive.yml` herättää Supabase-tietokannan päivittäin, jotta ilmaistason 7 päivän jäädytys ei laukea.
- Jos koko repo on täysin hiljaa lähestymässä 60 päivää, ajastetut workflowt poistuvat GitHubin toimesta automaattisesti käytöstä — tämä tiedosto on turvallinen paikka tehdä tarvittaessa pieni "turha" commit sen estämiseksi (esim. päivitä rivi alla).

Viimeksi kosketettu: 2026-09-17
