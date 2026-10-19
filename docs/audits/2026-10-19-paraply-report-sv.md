# Paraply — teknisk och visuell granskningsrapport

Granskad 2026-10-19 i produktionsbygge med Playwright och Chrome DevTools Protocol på desktop (1440×1100), tablet (768×1024) och mobil (390×844). Varje resultat är medianen av tre sekventiella körningar efter en separat uppvärmning. FPS är en kontrollerad jämförelse med SwiftShader och ska inte tolkas som utlovad prestanda på fysisk hårdvara.

## Resultat

| Profil | FPS före → efter | p95 bildruta | Långa tasks | Total tid i långa tasks | LCP | Navigation CLS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Desktop | 9,11 → 23,15 (+154 %) | 150 → 83,4 ms (−44 %) | 509 → 47 (−91 %) | 51 468 → 4 421 ms (−91 %) | 5 224 → 4 564 ms | 0 → 0 |
| Tablet | 32,14 → 37,95 (+18 %) | 50,1 → 50,0 ms | 19 → 8 (−58 %) | 2 174 → 1 436 ms (−34 %) | 4 580 → 4 544 ms | 0 → 0 |
| Mobil | 50,17 → 51,71 (+3 %) | 33,4 → 33,4 ms | 10 → 10 | 1 262 → 1 224 ms | 4 540 → 4 536 ms | 0 → 0 |

## Vad som var fel och ändrades

- Produktionsbygget var trasigt på Astro 6.3.1. Astro uppdaterades till 7.4.0; bygget fungerar nu.
- SwiftShader upptäcktes men fick en för tung generell kvalitetsprofil. En separat mjukvaruprofil sänker renderingsskala, regnpartiklar och dimlager utan att ändra hårdvarurenderad desktopkvalitet.
- WebGL-loopen fortsatte bakom de senare redaktionella kapitlen på desktop. Den pausas nu när scenen är täckt och återupptas korrekt vid bakåtscroll.
- Fem senare bilder saknade intrinsic dimensions och laddningsprioritet. De har nu dimensioner, lazy/low-priority-laddning och senare explicit avkodning.
- Reduced-motion/no-WebGL-fallbacken använde två PNG-filer på sammanlagt 4 435,7 KB trots befintliga WebP-versioner. Den använder nu 321,9 KB WebP (−92,7 %).

## Kontroller utan fel

Inga konsolfel, misslyckade förstapartsanrop eller horisontella överflöden hittades. Alla sju bilder har `alt`. Dokumentet har ett `main` och korrekt H1→H2-ordning. Två H1 finns i DOM eftersom fallbacken för-renderas, men endast en är synlig och tillgänglig åt gången. Sidan innehåller avsiktligt inga knappar, länkar eller menyer.

LCP styrs av den avsedda 4,35-sekunders hero-introduktionen och har därför inte kortats genom att ändra animationens timing. Desktopvärdet `journey CLS = 1` inträffar vid den avsedda ScrollTrigger-frigöringen av den pinnade helskärmsduken; navigation CLS är 0. Ett CSS-försök gav ingen mätbar förbättring och ändrade slutkompositionen, så det återställdes.

## Manuell faktakontroll krävs

Ingen statistik eller juridisk utfästelse ändrades. Följande texter bör verifieras manuellt mot källa och faktisk tjänsteprocess: “1 in 3 children…”, anonymitetslöftet samt påståendet att alla samtal och chattar är konfidentiella.

Råa, kompakta mätvärden finns i `2026-10-19-paraply-before.json` och `2026-10-19-paraply-after.json`; exakta fynd och filorsaker finns i `2026-10-19-paraply-findings.md`.
