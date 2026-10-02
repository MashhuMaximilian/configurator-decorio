# Refacere Decorio — integrare și stare

Baza comună: `/Users/max/Documents/configurator-360`, platformă `83376ec`. Implementarea se află exclusiv în fork-ul `MashhuMaximilian/configurator-decorio`. Auditul compară SHA-256 pentru fiecare dependență comună în `reuse-manifest.json`.

| Subsistem | Reutilizare și adaptare |
|---|---|
| Shell / cont / proiecte / distribuire | `shared-ui/src/standaloneShell.js` și componentele sale. Capabilități pentru dezactivarea comerțului, analiticelor și autentificării când tenantul lipsește; preferințe fixe RO/metrice; numele proiectului sincronizat. API-urile de salvare/distribuire rămân cele comune. |
| Proprietăți | `shared-ui/src/components/panelControls.js`, acordeoane și stilurile comune. Binderul numeric permite respingerea explicită a unei valori fără clamp ascuns. Paleta și controalele specifice sunt generate din ontologie. |
| Istoric | `shared-ui/src/history/undoManager.js`, neschimbat. Un commit pentru o tragere, aplicare sau import. |
| Instrumente | Registrul și meniul comune. Containerul închis nu mai interceptează pointerul deasupra editorului. |
| Geometrie / materiale / UV | `shared-3d/src/createSurfaceSystem.js`, GeometryLibrary, MaterialLibrary, primitive, mapare UV în metri, texturi PBR și lifecycle. Detaliile curbe ale modelelor sunt înregistrate în aceeași bibliotecă. |
| Randare | Calitate, contact shading și controlul performanței din shared-3d. Camera, OrbitControls, cotele și iluminarea pornesc din FenceScene. Geometria identică a modulelor se reutilizează în cadrul unei reconstrucții. |
| Cod Decorio | Ontologie și rezolvare de proprietăți, definiții vizuale, adaptorul stării v2 către nucleul de graf și editorul SVG de traseu. Acestea sunt specifice produselor și interacțiunilor noi. |

Buildul include 58 de module/fișiere comune, dintre care 54 sunt identice cu sursa și patru sunt adaptate în fork. Dependency closure verificat: 68 de fișiere ale aplicației și bibliotecilor, plus activele și runtime-ul Three.js. Modulele administrative și celelalte configuratoare nu intră în build. Codul comercial importat tranzitiv de shell nu este expus în interfață; capabilitatea cart este dezactivată.

## Contracte și calcul

Contractele sunt descrise în `fence-configurator/js/contracts.d.ts`. Starea v2 persistă modelId și parametrii, nodurile, segmentele și porțile. Catalogul are versiunea `2026-10-02.4`. Configurațiile v1 și alte versiuni ale catalogului sunt respinse explicit; nu există încă migrare publică verificată.

Catalogul păstrează tuplele comerciale originale. Interfața modifică proprietăți separate. Pentru o combinație dependentă, prezintă variantele publicate și schimbările suplimentare înainte de aplicare. Culorile RAL la comandă fără mostră digitală sunt păstrate ca solicitare și randate neutru, cu explicație. Nu se fabrică un SKU.

Produsul în previzualizare este separat de proiect. Aplicarea este explicită, pe segment, traseu conectat sau proiect. Un singur rezultat de calcul alimentează planul, scena și exportul. Stâlpii din tabele păstrează separat lungimea comandată și poziționarea vizuală estimată. Nu deducem golul montat din lățimea foii porții.

## Limita acestei revizii

Aceasta este o refacere funcțională în lucru, nu acceptarea întregului plan. Inventarul provizoriu conține 907 intrări în scop; 332 au proprietăți implementate, 249 au reconstrucții vizuale, iar 46 definiții schematice rămân neactivate în interfață. Gruparea și implementarea tuturor accesoriilor, porților și sistemelor nu sunt terminate. Un produs rămas în analiză nu este automat un produs fără documentație.

Toate listele de piese rămân preliminare. Pasul montat, rosturile, toate îmbinările, gama completă de prinderi și toate spațiile de operare nu sunt validate. Fotografiile sunt afișate pentru modelele încă nereconstruite, fără înlocuirea lor printr-un model generic.

Vezi `catalog-coverage.md`, `model-coverage.json` și `acceptance.md` pentru limitele și verificările concrete. Nu publica această revizie drept configurator complet înaintea închiderii acestor puncte.
