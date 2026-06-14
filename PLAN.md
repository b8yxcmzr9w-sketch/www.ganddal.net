# PLAN.md – Ganddal Portal

---

## Skolerute per skoleår – admin-fanen
_Økt opprettet 2026-06-14_

### Funn før koding

| Element | Status |
|---|---|
| Eksisterende `renderSkolerute` / `skoleaarIntervall` i kodebasen | **Finnes ikke** – bygges fra scratch |
| Eksisterende PLAN.md | **Finnes ikke** – dette er første seksjon |
| Edge-funksjon `ai-parse-skolerute` i dette repoet | **Finnes ikke** – se note nedenfor |
| `v4/index.html` | **Finnes ikke** – cache-buster settes i `admin.html` |

> **Note om edge-funksjonen:** Det finnes ingen Supabase-konfigurasjon i dette
> repoet. Hvis `ai-parse-skolerute` er deployet i et adskilt Supabase-prosjekt,
> oppgi prosjektets URL / function-endepunkt. Inntil da implementerer jeg
> kallet som et konfigurerbart endepunkt i admin-innstillinger (localStorage),
> med en tydelig feilmelding hvis feltet er tomt.

### Datamodell

Ny nøkkel `skolerute` legges til i `data.json`:

```json
"skolerute": [
  {
    "id": "2025-08-19",
    "start_date": "2025-08-19",
    "end_date":   "2025-08-19",
    "title":      "Første skoledag",
    "deleted":    false
  }
]
```

Felt `deleted: true` brukes for soft-sletting (erstatt-modus).

### Delsteg

- [ ] **S1** – Hjelpefunksjoner i `admin.js`: `skoleaarIntervall(skolear)`, `aktivtSkolear()`, `nesteSkolear()`, `formaterSkolear(skolear)`
- [ ] **S2** – HTML: ny «Skolerute»-fane i `admin.html` (tab-knapp + `#tab-skolerute` innhold med velger, liste, knapper)
- [ ] **S3** – `renderSkolerute()`: tabvelger-aktivering, yearly-velger rendret, liste filtrert på valgt år
- [ ] **S4** – Filtrert liste: kun rader med `start_date` innenfor `skoleaarIntervall(valgtSkolear)`; banneret viser valgt år
- [ ] **S5** – AI-import: kaller konfigurerbart edge-endepunkt med `{ skolear: valgtSkolear }` i body; viser forhåndsvisning (`visSkoleruteForhandsvisning`)
- [ ] **S6** – Erstatt-modus i forhåndsvisning: soft-sletter rader for **valgt** år; teksten viser «Erstatt eksisterende skolerute for skoleåret XX/YY»
- [ ] **S7** – Manuell «+ Legg til»: forhåndsutfylles med dato i valgt år; advarsel (ikke blokkering) hvis dato er utenfor intervallet
- [ ] **S8** – Edge-endepunkt-felt i Innstillinger-fanen (localStorage)
- [ ] **S9** – Bump `?v=` på `<script src="js/admin.js">` i `admin.html`, kryss av alle delsteg, commit + push

### Avgrensning

Rører **ikke**: automatisk årsbytte, sommerside, «Avansert»-seksjon, kopibuggen i økt-modalene, migrasjon 017.
