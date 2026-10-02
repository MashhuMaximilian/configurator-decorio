# Verificare Decorio — refacere 2026-10-02

**Planul integral nu este finalizat.** Această revizie este verificabilă local; nu înlocuiește încă versiunea publicată. Numerele de inventar, parametri sau teste nu reprezintă acceptarea întregii oferte.

## Verificări efectuate

- 39 teste automate: tuple comerciale valide și combinații inexistente, propuneri explicite pentru proprietăți dependente, limite la comandă, RAL solicitat fără SKU inventat, surse individuale, geometrie finită pentru definițiile distincte, eliberarea resurselor comune, stâlpi și prinderi din tabele, intersecții și suprapuneri, aplicare atomică, JSON și CSV, kituri și role, istoric, 100 de segmente și izolarea buildului/deploymentului.
- Buildul folosește 58 de dependențe comune; 54 sunt identice cu sursa. Administrarea tenanturilor, celelalte configuratoare și Firebase Functions/regulile sunt excluse. `reuse-manifest.json` păstrează comparația fișierelor.
- Browser desktop la 1366×768 și browser mobil la 390×844. Catalogul și proprietățile sunt accesibile direct. Categoria Panouri aluminiu afișează cele 9 intrări; căutarea în categoria porților găsește Home Inclusive 10.228+.
- AL.101: schimbarea lățimii la 2,4 m urmată imediat de culoarea Verde păstrează ambele alegeri, actualizează cotele și scena. Navigarea și configurarea previzualizării păstrează proiectul existent.
- Noistop Steel: alegerea lățimii de 3 m din configurația 1×1 m păstrează selecția veche și cere alegerea explicită a uneia dintre înălțimile publicate, 0,6 m sau 0,4 m. Confirmarea setează proprietățile împreună.
- Mobil: două segmente numerice de 4,8 m la 0° și 90°, ramificație cu pointerul dintr-un nod comun, mutare de nod și restaurare printr-o singură anulare. Cotele nu se micșorează odată cu viewportul. Zona invizibilă a meniului comun de instrumente nu mai blochează Desenează.
- Proiect de stres încărcat în browser: 100 de segmente, 200 de panouri, 500 m. Randarea s-a încheiat fără erori de consolă. Acesta nu este un benchmark FPS sau o validare pe telefon fizic. Geometriile identice se reutilizează; pentru proiecte mari, cotele 3D se restrâng la segmentul selectat.
- Pe catalogul `2026-10-02.4`, JSON-ul descărcat din browser este identic cu configurația importată. CSV-ul descărcat este identic byte-for-byte cu exportul calculatorului pentru aceeași stare: cinci panouri AL.101 2,4×1,5 m Verde pe trei segmente, restul fiind semnalat.
- Modelul de date respinge explicit configurații standard, versiuni incompatibile, produse necunoscute și îmbinări neconfirmate. Nu s-a introdus conversie automată pentru vechile configurații.

Dovezi locale: `output/refactor-mobile-2d.png`, `output/refactor-desktop-product.png`, `output/refactor-v4-example.json`, `output/refactor-v4-browser.json`, `output/refactor-v4-browser.csv`. Fișierele de test/randare sunt excluse din Git.

## Puncte rămase deschise

- 907 intrări provizorii în scop: 332 au proprietăți implementate și 249 au reconstrucții vizuale active. Celelalte necesită analiză, reconciliere și implementare. Cele 46 definiții schematice nu sunt prezentate drept modele 3D finalizate; interfața folosește fotografia. Aceste limite nu demonstrează absența documentației furnizorului.
- Verificarea vizuală individuală din față și perspectivă a tuturor modelelor, inclusiv detaliile porților, sistemele industriale, finisajele și accesoriile. Testul de geometrie finită nu înlocuiește această verificare.
- Montaj complet: pas montat, rosturi, lungimi de stâlpi și prinderi pentru toate sistemele, colțuri/ramificații și compatibilități între sisteme. Există patru modele grupate cu tabele parțiale de stâlpi; nicio listă nu este declarată completă.
- Poarta cu anvelopă și desen configurabile nu poate fi introdusă automat în proiect fără gol, spațiu de operare și compatibilitate documentate. Acoperirea porților batante duble, bi-fold, culisante și coliziunile dintre două porți rămân de implementat/verificat.
- Selecția compatibilă a întregii game de accesorii și reconcilierea tuturor kiturilor. Intrările încă neimplementate sunt etichetate ca atare, fără a pune lipsa pe seama furnizorului.
- Autentificare, App Check, salvări, restaurare, distribuire și izolare între tenanturi în mediul Decorio final. Contul de provisioning a fost respins pentru lipsa autorizării; reverificarea read-only din această revizie a găsit HTTP 404 atât pentru tenantul public Decorio, cât și pentru documentul de autorizare al contului. Nu s-au acordat privilegii noi.
- Teste pe dispozitive fizice, benchmark de performanță și întregul workflow manual de publicare.

## Infrastructură — verificări anterioare refacerii

Rutarea dedicată, redirecturile `.com`/`.de` cu păstrarea query-ului, antetele noindex și păstrarea rutelor standard/AKS au fost verificate pentru versiunea live `fb6908c`. Reviziile Cloud Run permit rollback. Aceste rezultate nu substituie retestarea după publicarea refacerii.

Corecția formularului de provisioning din platforma standard rămâne în PR separat `office-360design/configurator-360#494`; nu a fost publicată de acest refactor. Noua implementare este în fork, PR draft `MashhuMaximilian/configurator-decorio#1`. Actions rămân dezactivate.
