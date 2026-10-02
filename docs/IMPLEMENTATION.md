# Configurator Decorio

Fork: `MashhuMaximilian/configurator-decorio`, branch `codex/decorio-demo`. Baza comună: `office-360design/configurator-360@83376ec`. Refacerea curentă folosește shell-ul shared-ui, managerul de istoric, controalele comune și sistemul shared-3d; detaliile sunt în `refactor-audit.md`.

## Preview local

Node >=20: `npm ci`, `npm run check`, `npm run dev`. Deschide http://127.0.0.1:4173/configurator-garduri/ . Buildul este servit din `dist/site`; rulează `npm run build` după editări. Configurarea și exporturile locale sunt disponibile fără cont.

## Flux și date

Proiect permanent → alegere gard/poartă/accesoriu din trusă → configurarea piesei → plasare directă → editare și listă de materiale. JSON v3 păstrează laturile, porțile și accesoriile separat. Configurațiile v2 sunt importate explicit, cu păstrarea originalului. Calculatorul alimentează planul, scena și componentele. Experiența și reutilizarea sunt descrise în `construction-experience.md`. Nu sunt incluse prețuri comerciale, checkout sau cereri de ofertă.

`scripts/build-ontology.py` compilează catalogul intermediar și dovezile locale în `catalog/ontology.json`; `catalog/visual-definitions.json` păstrează definițiile vizuale. `npm run catalog:report` produce matricea pe modele. Reconstrucția din surse necesită inventarul HTML/PDF descărcat cu `inventory.py` și `download-evidence.py`, apoi `build-catalog.py`. Documentele brute nu intră în deployment.

## Stare și izolarea publicării

Implementare în lucru: consultă `acceptance.md` și `catalog-coverage.md`. Modelele parțial documentate și cele încă neimplementate sunt diferențiate de o configurație validată; listele de piese sunt preliminare.

Buildul include doar dependențele Decorio și bibliotecile comune necesare. Nu publică alte configuratoare, administrarea tenanturilor, Firebase Functions sau reguli. Workflowul manual rămâne dedicat Decorio, iar Actions rămân dezactivate. Ultima versiune live anterioară refacerii este `fb6908c`; noua refacere nu a fost publicată.

Tenantul și salvarea/distribuirea autentificată rămân blocate de drepturile de provisioning ale contului. Nu s-a acordat acces administrativ suplimentar. Backendul platformei standard nu a fost modificat pentru produsele Decorio.
