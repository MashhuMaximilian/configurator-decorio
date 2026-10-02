# Verificarea noului builder Decorio — 2026-10-02

Această revizie înlocuiește interfața și motorul de plasare anterior. Builderul este publicat pe https://decorio.360configurator.ro, cod `82aed12`, și păstrat în PR draft. Publicarea demo-ului nu reprezintă certificarea montajului. Verificările vechi sunt păstrate separat în [acceptance-ontology.md](acceptance-ontology.md); nu constituie verificări ale noii interfețe.

## Verificat acum

`npm run check` a trecut pentru `fecef76`: 67 de teste automate și build izolat cu 70 de dependențe ale aplicației și bibliotecilor comune. Dintre teste, 19 sunt specifice noului motor/scenei și două coșului/prețurilor demo; restul verifică ontologia, geometria, modulele reutilizate și izolarea.

- Calculator nou: porțile din catalog ocupă intervale pe laturi și elimină panourile din deschidere; mutarea, schimbarea lățimii/modelului, sensul și ștergerea refac ansamblul.
- Suprapunerile de porți, depășirea laturii, traversarea unei porți de către o ramificație și suprapunerile de garduri sunt respinse fără modificarea originalului. Ramificațiile în afara porții împart latura și păstrează poziția mondială a porții.
- Panouri la comandă: 5 m devin 1,66 + 1,67 + 1,67 m, în limitele modelului. Panourile fixe nu se întind. Ajustarea explicită a unei laturi Vega cu poartă de 1,2 m poate produce 11,2 m: patru panouri de 2,5 m și poarta, fără rest.
- Rolele identice se însumează înaintea rotunjirii cantității de cumpărat. Accesoriile sunt articole comerciale adăugate manual, fără explodarea implicită a ambalajelor sau dublarea automată a kiturilor.
- Testul exhaustiv de calcul trece prin toate cele 329 de modele de gard/poartă plasabile din catalogul curent. Acesta verifică generarea configurației și cantități finite, nu certifică montajul sau fidelitatea vizuală.
- Teste de scenă: planul și 3D-ul folosesc aceleași poziții și identități, porțile au identitate separată de latură, rezultatul calculatorului nu este modificat de randare, geometria comună se eliberează. Modelele fără reconstrucție sunt contururi de rezervare.
- Browser desktop: construire dreptunghi Home Inclusive, alegerea porții pietonale din catalog, plasare prin click pe latură în 2D, selectare, inversare, poziționare numerică prin Enter la 2 m și verificare în 3D, adăugare de accesoriu în lista proiectului, restaurare la reîncărcare.
- Dovadă locală: `output/builder-gate-project.png`. Proiectele utilizatorului din originile anterioare nu au fost resetate.

## Reverificare: meniul contextual, unghiuri și coș

- Browser desktop și mobil 390×844: meniu în scenă, acces separat la proprietăți, continuare din capăt, poartă din catalog, inversare, ștergere și undo.
- Latură de 9,6 m la 113° plasată numeric și verificată vizual în 3D. Regresia automată eșuează pe implementarea veche la 113° și trece cu corecția în toate cadranele.
- Proiect cu 30 m de Home Inclusive: 11.250 RON fictivi; adăugarea a 9,6 m și înlocuirea a 1,2 m cu poartă produce 16.070 RON fictivi. Coșul păstrează cele două copii și totalul 27.320 RON. Editarea/actualizarea primei copii păstrează două intrări.
- Coșul și configurația se restaurează la reload. CSV-ul descărcat efectiv în Downloads conține BOM-ul, avertismentul demo, problemele de montaj și totalul 11.250, concordant cu interfața. Evenimentul de download al instrumentului a expirat, dar fișierul real a fost verificat de pe disc.
- Rămân neverificate aici: trimiterea reală a ofertei, gesturile multi-touch reale și drag-ul porții pe dispozitiv fizic. Modelele 3D lipsă au fost explicit amânate de utilizator.

## Acoperire și limite exacte

În catalog sunt 372 de modele de gard/poartă în scop. 329 au date utilizabile pentru plasare; dintre acestea 248 au reconstrucție 3D și 81 sunt rezervări de spațiu cu fotografie în catalog. 40 nu au încă parametrii necesari plasării, iar trei au conflict de unități în sursă. Categoria mobile are 20 de modele cu dimensiuni utilizabile; existența parametrilor nu înseamnă validarea bazelor/prinderilor.

Modelele PI 95, Modest și Gardia sunt păstrate în catalog, cu explicație la plasare. Paginile publică deschideri de ordinul miilor cu unitatea „m”; nu convertim tacit în mm. Surse consultate la 2026-10-02:

- [PI 95](https://decorio.ro/product/pi-95-poarta-culisanta-in-consola-8573525), secțiunea Specificații tehnice.
- [Modest](https://decorio.ro/product/modest-poarta-bordurata-culisanta-in-consola-modest-culisanta), aceeași secțiune.
- [Gardia](https://decorio.ro/product/gardia-poarta-dublu-fir-culisanta-in-consola-gardia-culisanta), aceeași secțiune.

Planificarea unei porți sau îmbinări fără montaj verificat este permisă cu probleme explicite în listă și CSV. Lățimea publicată nu este declarată automat gol montat. Arcele de operare și mecanismele 3D sunt orientative; cinematică bi-fold, coliziuni de operare, fundații și legături între sisteme necesită documentare. Nicio listă nu este declarată completă.

## Infrastructură și verificare live — 2026-10-02

- Accesul de administrare a tenanturilor a fost acordat explicit contului autorizat, prin scriptul existent al platformei. Tenantul `decorio` a fost creat prin interfața de provisioning: plan `go_live_now_1`, doar Fence, deschidere directă, stare activă. Proprietarul dashboardului nu a fost atribuit.
- Cod live `82aed12`, revizie `configurator-decorio-00007-ztr`, 100% trafic. Prima încercare de publicare a evidențiat ruta Nginx lipsă `/shared-3d/`; s-a revenit temporar la revizia anterioară, apoi ruta a fost corectată. Cele cinci teste de izolare, inclusiv noua regresie pentru rutele publice ale dependențelor, trec. Buildul containerului verifică servirea HTTP a tuturor fișierelor JavaScript.
- Toate cele 70 de dependențe din manifest au fost descărcate prin HTTPS de pe domeniul public fără erori. Pagina, versiunea și shared-3d răspund corect, cu noindex. Domeniile Decorio `.com` și `.de` redirecționează către `.ro`, păstrând calea și query-ul.
- Autentificarea Google a funcționat. Proiectul `Verificare Decorio 02.10`, dreptunghi Home Inclusive de 10×5 m, 16 panouri, a fost salvat și restaurat după reload. Distribuirea a produs un link, iar deschiderea lui într-un tab nou a restaurat numele, dimensiunile și cele 16 panouri. Fără erori sau avertismente în consola tabului sursă.
- Dovezi: `output/decorio-live-2026-10-02.png`. Testul autentificat folosește serviciile comune; nu constituie un audit adversarial App Check sau de acces între tenanturi. La autentificare, shell-ul comun trece la spațiul contului; proiectul guest nu este transferat automat.
- HTML-ul demo-ului standard și al tenantului AKS are același SHA-256 înainte și după publicare. Nu s-au publicat Firebase Functions/reguli și nu s-au modificat rutele wildcard, certificatele sau serviciile standard. Actions rămân dezactivate. Rollback-ul este documentat în `deployment.md`.
