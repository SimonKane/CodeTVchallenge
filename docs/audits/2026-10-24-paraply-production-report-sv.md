# Paraply – slutrapport 24 oktober 2026

## Status

Implementationen är färdig på `codex/paraply-production-quality`. Rollback-punkten finns på `codex/rollback-pre-production-2026-10-24` (commit `fe939aa`). Ingen deploy, push eller ändring av `main` har gjorts. Inga beroenden har lagts till.

Lösningen är funktionellt och visuellt verifierad, men markeras inte som helt produktionsverifierad eftersom mobilens repeterade Chromium-mätning fortfarande innehöll fler ramar på minst 50 ms än rollback-versionen, trots förbättrad medel-FPS och p95.

## Ändrade filer

- `src/components/Experience/animations/NarrativeTimeline.ts` – tog bort ScrollGovernor och `normalizeScroll`; använder native scroll + ScrollTrigger, bibehåller pin/scrub, samordnar refresh/resize och kapitelstatus utan layoutändring.
- `src/components/Experience/Experience.css` – konstant fast kapitelfotavtryck, förbättrad mobil/tablet-typografi och kontrast, responsiv paraplykomposition, tillgänglig interaktionsknapp och komplett fallback/reduced-motion-presentation.
- `src/components/Experience/Experience.astro` – lade till “Open the umbrella”-knapp, ARIA-tillstånd, live-status och koppling till sluttexten.
- `src/components/Experience/Experience.ts` – installerar/städar statisk paraplyinteraktion för reduced motion och WebGL-fallback samt samordnar ResizeObserver med ScrollTrigger-refresh.
- `src/components/Experience/animations/UmbrellaChapter.ts` – premiuminteraktion med befintlig authored open/closed-sekvens, click/tap/Enter/Space, ARIA, reducerad rörelse och koordinerat regn.
- `src/components/Experience/animations/WaterTextReveal.ts` – tidigare och längre läsbar reveal som tar bort den tomma vattenpassagen.
- `playwright.config.ts` – system-Chrome och statisk Vite-preview; stöd för isolerad extern baseline-URL.
- `tests/audit/scroll-ux.spec.ts` – native wheel-förväntan samt robust crossfade-/scrollkontroll.
- `tests/audit/paraply.audit.spec.ts` – elva narrativa checkpoints, maxScroll- och wheel-mätning.
- `tests/audit/fallback.audit.spec.ts` – verifierar interaktivt paraply och laddad authored bild i reduced-motion-fallback.
- `tests/audit/interaction-and-scroll.spec.ts` – ny matris för maxScroll, reverse/fast/repeated input, tangentbord, touch, resize/reload och interaktionsbilder.
- `tests/audit/webgl-fallback.spec.ts` – ny no-WebGL-regression för paraplyinteraktionen.

## Verifiering

- `npm run build`: godkänd. Endast befintlig Vite-varning om chunk över 500 kB.
- `npm run test:audit-unit`: godkänd.
- Playwright funktionsmatris: 17 godkända och 10 avsiktligt viewport-skippade; tre fel orsakades av för snäva testtidpunkter. Efter korrigering godkändes den fokuserade regressionen 3/3. Hela kombinerade matrisen kördes inte om efter den sista harness-korrigeringen enligt användarens instruktion att avsluta utan fler tester.
- Full narrativ audit: 3/3 desktop/tablet/mobile godkända.
- Reduced motion + no-WebGL: 6/6 godkända.
- Repeterad jämförelse: 6/6 rollback och 6/6 efterversion godkända.
- Native scroll: första 480 px wheel-input gav 480 px scroll i alla eftermätningar.
- Stabil höjd: maxScroll-intervall 0 px i desktop, tablet och mobil. Rollback ändrade höjd med exakt en viewport: 1100/1024/844 px.
- Resize/reload, reverse scroll, upprepad input, PageDown, touch, click/tap/Enter/Space och fortsatt scroll efter paraplyöppning: godkända i utförda regressioner.
- TypeScript-fristående kontroll: hoppad. Projektet har inte `typescript`/`@astrojs/check` installerat; `npx tsc --noEmit` kunde inte hämta paket på grund av nätverksbegränsning. Astro-byggens typgenerering lyckades.

## Jämförbar prestanda

Chrome 156.0.8078.47, ANGLE Metal på Intel UHD Graphics 617. Samma auditkod, viewport, hårdvara och browser användes mot isolerat rollback-bygge och arbetsgren. Desktop är ett matchat run; tablet/mobil är median av tre matchade run.

| Viewport | Mätvärde | Rollback | Efter |
|---|---:|---:|---:|
| Desktop | medel-FPS | 14,93 | 20,39 |
|  | p95 frame | 216,7 ms | 133,3 ms |
|  | ramar ≥50 ms | 280 | 73 |
|  | long tasks | 109 / 13 184 ms | 22 / 3 949 ms |
|  | maxScroll-variation | 1100 px | 0 px |
| Tablet | medel-FPS | 22,30 | 24,64 |
|  | p95 frame | 100,0 ms | 83,3 ms |
|  | ramar ≥50 ms | 69 | 28 |
|  | long tasks | 13 / 4 177 ms | 8 / 1 593 ms |
|  | maxScroll-variation | 1024 px | 0 px |
| Mobil | medel-FPS | 25,09 | 39,05 |
|  | p95 frame | 66,7 ms | 50,0 ms |
|  | ramar ≥50 ms | 15 | 25 |
|  | long tasks | 5 / 1 239 ms | 14 / 2 533 ms |
|  | maxScroll-variation | 844 px | 0 px |

Desktop och tablet förbättrades tydligt. Mobil förbättrade FPS och p95 men missade kravet “inga nya ≥50 ms-spikar” i medianen; detta är kvarstående prestandarisk och skälet till att produktionsberedskap inte hävdas.

## Skärmbilder och rådata

- Efter, komplett kapitelmatris: `audit-results/2026-10-24-comparable-after/{desktop,tablet,mobile}/run-1/`
- Repeterade eftermätningar: `audit-results/2026-10-24-comparable-after-repeat/{tablet,mobile}/run-{1,2,3}/`
- Jämförbar rollback: `audit-results/2026-10-24-comparable-baseline/{desktop,tablet,mobile}/run-1/`
- Repeterad rollback: `audit-results/2026-10-24-comparable-baseline-repeat/{tablet,mobile}/run-{1,2,3}/`
- Interaktionens stängda/öppna tillstånd: `audit-results/interaction/{desktop,tablet,mobile}/`
- Reduced-motion-fallback: `audit-results/fallback/`

Varje audit-run innehåller PNG-bilder, `metrics.json` och `chrome-trace.json`. De kontrollerade slutbilderna behåller barnet under paraplyet, undviker kritisk beskärning och har förbättrad läsbarhet på tablet och mobil. Vattenkapitlet har nu innehåll vid entry och en avsiktlig typografisk upplösning i stället för en tom passage.

## Interaktivt paraply och kända begränsningar

“Open the umbrella” använder befintliga authored paraplybilder, GSAP-systemet och regncanvasen. Den fungerar med click, tap, Enter och Space, annonserar status, respekterar reduced motion, fungerar utan WebGL och blockerar inte fortsatt scroll. Ingen ny 3D-motor eller dependency används. Effekten är en komponerad 2D-sekvens; inget falskt volymetriskt 3D-paraply har skapats eftersom något sådant skulle kräva en ny authored 3D-asset.

Kvarstår:

- Mobilens ≥50 ms-/long-task-median behöver ytterligare profilering innan strikt produktionsklar-status.
- Fristående TypeScript-check är inte verifierad eftersom TypeScript-tooling saknas i projektet.
- Den refererade fullständiga October 24-auditfilen fanns inte i repository, bifogade artefakter eller lokal task-historik. Den bevarade rollback-versionen mättes därför om med den nya identiska harnessen; October 19-materialet lästes och dess SwiftShader-data hölls separat från hårdvaruaccelererad jämförelse.

