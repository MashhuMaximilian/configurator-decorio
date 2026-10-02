# Builder de perimetre Decorio — 2026-10-02

## Bucla de construcție

Proiectul rămâne permanent în scenă. Catalogul este o trusă de piese, nu un ecran de previzualizare care înlocuiește proiectul.

1. **Garduri:** alegi modelul, vezi dimensiunile și culoarea piesei active, modifici opțiunile dacă este nevoie. Click–click sau tragere creează o latură; continui din capătul marcat. Lungimea numerică arată lungimea rezultată înaintea plasării. Încheie/Esc termină traseul.
2. **Porți:** alegi o poartă din catalog și o apropii de o latură. Previzualizarea rezervă deschiderea și reface panourile învecinate. Click confirmă. Produsele cu același desen sunt prioritizate, fără a pretinde compatibilitate de montaj.
3. **Selectează:** click pe gard/poartă deschide proprietățile elementului; poți înlocui modelul, schimba dimensiunile sau culoarea, muta poarta, inversa sensul și șterge. Un colț se trage pentru redimensionare. Gardul unei laturi poate fi aplicat explicit pe întreg perimetrul.
4. **Panouri întregi:** pentru sistemele fixe există o acțiune explicită care ajustează lungimea laturii și pozițiile porților împreună. Resturile nu sunt ascunse prin întinderea geometriei.
5. **Accesorii:** alegi un articol și cantitatea comercială. Apare în lista proiectului și CSV; montajul și includerea într-un kit se confirmă. Nu inventăm geometrie sau preț.
6. **Anulează/Refă:** o plasare, tragere sau aplicare este o operație. Previzualizarea nu intră în proiect, istoric sau salvare. „Proiect nou” oferă export și resetare recuperabilă prin undo.

Plan 2D și 3D sunt vederi ale aceluiași ansamblu. Camera nu este reîncadrată continuu în timpul desenării. Rotița apropie, butonul drept rotește în 3D/deplasează planul, butonul mijlociu deplasează; pe tactil, două degete sunt rezervate navigației. Mobilul are trusa persistentă și spațiu separat pentru scenă și sertarele de configurare.

## Arhitectură și reutilizare

- `builder-engine.js`: stare v3, graf de laturi, porți cu identitate și interval propriu, accesorii, comenzi atomice și un rezultat comun de calcul. Refolosește ontologia și derivarea componentelor din module documentate; nu mai folosește restricția globală din vechiul editor care bloca toate porțile fără compatibilitate completă.
- `builder-scene.js`: interacțiuni directe pe planul comun Three.js, selectare, ghost, noduri și contururi. Extinde `DecorioViewer`/`FenceScene`, folosind camera, suprafața, materialele, geometria, iluminarea, cotele și ciclul de viață shared-3d.
- `decorio-app.js`: catalog, piesă activă, inspector contextual, comenzi și istoric. Refolosește shell-ul, controalele dimensionale, managerul de istoric și API-urile comune pentru proiecte.
- Vechile `editor.js`/`placement.js` rămân în istoric/surse, dar nu sunt încărcate de noua aplicație. Nu există al doilea renderer sau sistem de materiale.

## Persistență și onestitate tehnică

Schema 3 și cheia locală `decorio-fence:v3:builder-draft` păstrează separat noul proiect. Proiectele v2 sunt importate numai printr-o acțiune explicită și validate; sursa locală v2 rămâne neatinsă. API-urile păstrează `productType: fence`.

Planificarea este distinctă de validarea montajului. Panourile la comandă respectă limitele catalogului; rosturile, stâlpii și prinderile necunoscute sunt semnalate. Produsele fără reconstrucție vizuală sunt contururi portocalii etichetate, nu garduri generice. Nu sunt incluse calcule structurale, pante, prețuri comerciale sau checkout.

Starea verificărilor și limitele sunt în [acceptance.md](acceptance.md). Acest document descrie mecanicile implementate, nu înlocuiește verificarea manuală restantă.
