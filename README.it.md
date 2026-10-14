<p align="center"><img src="extension/icons/icon128.png" width="96" alt=""></p>

<h1 align="center">GX-like Dark Mode</h1>

<p align="center">Tasto destro, <b>Forza pagina scura</b>, fatto. Il tema scuro per singola pagina di Opera GX, su Google Chrome.</p>

<p align="center"><a href="README.md">Read in English</a></p>

---

## Perché esiste

Ho usato Opera GX per molto tempo, e la funzione che preferivo era **Force dark page** nel menu del tasto destro: qualsiasi sito bianco accecante diventa scuro con un clic, e GX se lo ricorda per quel sito.

Col tempo però GX era diventato lento e laggava, così sono tornato a Chrome. Chrome è di nuovo veloce, ma non ha niente di equivalente: il suo force dark integrato è nascosto in `chrome://flags` e vale per tutti i siti insieme, senza scelta per sito e senza voce nel menu. Questa estensione riporta il comportamento di GX.

> **Nota: questo progetto è vibe coded.** L'ho costruito insieme a un assistente AI (Claude), descrivendo cosa volevo e provando il risultato, invece di scrivere ogni riga a mano. Il codice è stato rivisto per la sicurezza ed è coperto da test automatici nel browser, ma leggi [SECURITY.md](SECURITY.md) e trattalo come un piccolo progetto amatoriale.

## Funzioni

- **Forza pagina scura** nel menu del tasto destro, ricordata per ogni sito
- **Forza scuro su tutti i siti** come interruttore globale, con eccezioni per singolo sito
- Clic sull'icona, oppure **Alt+Shift+D**, per attivare o disattivare il sito corrente
- Il badge **ON** sull'icona indica che il sito corrente è scurito
- In incognito le scelte restano solo in memoria e spariscono alla chiusura del browser
- Interfaccia in italiano e inglese
- Niente tracciamento, nessuna richiesta di rete, nessun codice remoto, nessun dato esce dal browser

## Due versioni

Nella repository ci sono due versioni. Installane **una sola**.

| | `extension/` (consigliata) | `extension-native/` |
|---|---|---|
| Come scurisce | Inverte la pagina con un filtro CSS, poi riporta foto e video ai colori originali | Attiva il motore Auto Dark Mode di Chrome, lo stesso di `chrome://flags/#enable-force-dark` e di Opera GX |
| Resa | Buona sulla maggior parte dei siti, alcune immagini di sfondo e loghi possono apparire invertiti | La più simile a Opera GX, gestisce meglio le immagini |
| Barra di avviso | Nessuna | Chrome mostra *"ha avviato il debug di questo browser"* mentre un sito è scurito (vedi sotto) |
| Permessi | Menu contestuale, memoria, accesso alle pagine http/https/file | Menu contestuale, memoria, schede, **debugger** |

### La barra di avviso della versione nativa

Chrome permette a un'estensione di accendere il motore scuro nativo solo tramite l'API `debugger`, e mostra sempre una barra di avviso quando quell'API è in uso. È una protezione di Chrome e non si può disattivare dall'estensione.

Per avere la resa nativa senza barra, avvia Chrome con il parametro `--silent-debugger-extension-api`:

- **Windows**: tasto destro sul collegamento di Chrome, *Proprietà*, e aggiungi ` --silent-debugger-extension-api` dopo le virgolette finali in *Destinazione*. Le icone fissate sulla barra delle applicazioni sono collegamenti separati, modifica anche quelle.
- **macOS**: chiudi Chrome e lancia `open -a "Google Chrome" --args --silent-debugger-extension-api`
- **Linux**: `google-chrome --silent-debugger-extension-api`

Il parametro nasconde l'avviso per **tutte** le estensioni che usano il debugger, quindi usalo solo se ti fidi di tutte quelle che hai installato. Premere *Annulla* sulla barra spegne il tema scuro in quella scheda finché non lo riattivi.

## Installazione

L'estensione non è sul Chrome Web Store, quindi la carichi tu. Ci vuole un minuto.

1. Scarica lo zip più recente da [Releases](../../releases), oppure clona la repository.
2. Estrailo in una cartella che terrai (Chrome lo carica da lì ogni volta).
3. Apri `chrome://extensions` e attiva **Modalità sviluppatore** in alto a destra.
4. Clicca **Carica estensione non pacchettizzata** e scegli la cartella `extension` (oppure `extension-native`).
5. Ricarica le schede già aperte.

Per i file locali (`file://`), apri i dettagli dell'estensione e attiva **Consenti l'accesso agli URL dei file**.

Funziona su Chrome 110 o successivi e sugli altri browser Chromium come Edge, Brave e Vivaldi.

## Come funziona

**Memoria per sito.** Le scelte sono salvate in `chrome.storage.local` per nome di dominio, senza `www.`, quindi `www.example.com` ed `example.com` condividono la stessa impostazione. La scelta per sito vince sempre sull'interruttore globale.

**Versione CSS.** Un piccolo script gira su ogni pagina all'inizio del caricamento. Legge la scelta salvata e, se la pagina va scurita, imposta un attributo su `<html>`. Il foglio di stile agisce solo quando quell'attributo è presente: applica `invert(1) hue-rotate(180deg)` a tutta la pagina e di nuovo a immagini, video e player incorporati, così appaiono normali. Con l'interruttore globale acceso, le pagine che hanno già uno sfondo scuro vengono lasciate stare; un sito acceso a mano viene scurito sempre.

**Versione nativa.** Non c'è nessuno script nelle pagine. Il service worker si collega alle schede scelte e invia un solo comando del protocollo DevTools, `Emulation.setAutoDarkModeOverride`, che fa disegnare la pagina a Chrome con il suo motore scuro integrato. Spegnendo, si scollega e la pagina torna subito normale.

## Limiti

- Chrome non permette alle estensioni di agire sulle pagine `chrome://`, sul Chrome Web Store o sulle pagine di altre estensioni.
- Versione CSS: le immagini di sfondo CSS vengono invertite insieme alla pagina, e i colori delle foto possono variare leggermente perché `hue-rotate` è un'approssimazione.
- Versione nativa: la barra di avviso descritta sopra.

## Sviluppo

```
extension/          versione con filtro CSS
extension-native/   versione con motore nativo
tests/              test end-to-end con Playwright e Chromium
```

Per i test (Python 3, `pip install playwright pillow`, poi `playwright install chromium`):

```
python3 tests/test_extensions.py
```

Caricano entrambe le versioni in un Chromium reale e verificano scurimento, memoria per sito, interruttore globale, pagine già scure, colori delle immagini, media a schermo intero, siti che riscrivono gli attributi di `<html>` e chiavi di memoria come `__proto__`.

Gli zip per le release si creano con `./scripts/package.sh`.

## Nessuna affiliazione

È un progetto amatoriale indipendente. Non è realizzato, approvato o affiliato con Opera, Opera GX o Google. "Opera GX" è citato solo per descrivere la funzione che l'estensione imita.

## Licenza

[MIT](LICENSE) © 2026 Ruben Pacchin
