// CONDIZIONI E PRIVACY — italiano.
//
// See legal-es.js for the reasoning. English is the source and legally controlling.
// REGISTER: "Lei", and the English's plainness preserved. Italian legal drafting is the most
// ceremonious of the four by habit; that ceremony is what these documents were written against.
const GOVERNING =
  'Questa traduzione è fornita affinché possa leggere questo documento nella sua lingua. ' +
  'La versione inglese è quella giuridicamente vincolante.';

const TERMS_IT = `
<h1>Condizioni del Servizio</h1>
<p class="updated">Ultimo aggiornamento: 13 ottobre 2026</p>

<div class="panel">${GOVERNING}</div>

<div class="panel"><strong>American Rider è nel suo periodo di prova.</strong> L’applicazione
è distribuita tramite Apple TestFlight e alcune funzioni sono dimostrative. L’applicazione
indica, al momento del pagamento, se questo è reale o simulato.</div>

<section><h2>1 · Che cos’è American Rider</h2>
<p>American Rider è una piattaforma tecnologica che mette in contatto viaggiatori con
conducenti professionisti indipendenti («operatori»). Noi organizziamo il viaggio, mostriamo
un unico prezzo comprensivo di tutto e gestiamo il pagamento. La guida è fornita da operatori
indipendenti, non da American Rider: siamo una piattaforma di coordinamento, non un vettore.</p></section>

<section><h2>2 · Account ed età</h2>\n<p>Gli account ordinari di Viaggiatori e Operatori sono riservati a persone di almeno 18 anni. Il programma Famiglia/Adolescenti consente account verificati per i 13–17 anni, su invito e con autorizzazione del tutore, soggetti a controlli di sicurezza e revoca. Nessun account per bambini sotto i 13 anni.</p></section>

<section><h2>3 · Totale confermato</h2>\n<p>Prima della prenotazione viene mostrato un unico Totale comprensivo di tariffa di viaggio, commissione di piattaforma, pedaggi e oneri pubblici applicabili. La commissione di piattaforma dipende dai costi del servizio ed è almeno 2,50 USD; è già compresa nel Totale. L'Operatore trattiene il 99 % della tariffa di viaggio e American Rider riceve l'1 %. Se il Totale cambia prima della prenotazione, è richiesta una nuova conferma espressa. Non saranno addebitati importi superiori non accettati.</p></section>

<section><h2>4 · Annullamenti</h2>
<ul>
<li>Prima dell’arrivo del suo operatore può annullare e la tariffa le viene restituita per
intero.</li>
<li>Una volta arrivato l’operatore, l’annullamento restituisce la tariffa al netto di una
tassa di arrivo di 3,00 USD. Tale importo è corrisposto all’operatore, che ha guidato fino a
lei e ha atteso.</li>
<li>Una volta iniziato, il viaggio non può essere annullato. L’Assistenza Viaggiatori risolve
qualsiasi problema relativo a un viaggio già in corso.</li>
</ul></section>

<section><h2>5 · Pagamenti</h2>
<p>I pagamenti sono elaborati da Stripe. American Rider non vede né memorizza mai il numero
completo della sua carta. L’applicazione indica se un pagamento è reale o simulato nel
momento in cui viene effettuato.</p></section>

<section><h2>6 · Viaggiare con noi</h2>
<p>I viaggiatori non possono utilizzare la piattaforma per scopi illeciti né interferire con
il controllo sicuro del veicolo da parte dell’operatore. Le richieste ragionevoli
dell’operatore — cinture di sicurezza, divieto di fumo e simili — devono essere rispettate.
Un account che metta a rischio un operatore o un altro viaggiatore può essere sospeso.</p></section>

<section><h2>7 · Durante il periodo di prova</h2>
<p>Il servizio è fornito «così com’è» durante la fase di prova. Alcune funzioni possono essere
simulate, cambiare o non funzionare; l’applicazione può risultare non disponibile in alcuni
momenti. Nella massima misura consentita dalla legge della Florida, la responsabilità di
American Rider durante il programma di prova è limitata agli importi che lei ci ha
effettivamente versato.</p></section>

<section><h2>8 · Controversie</h2>
<p>Segnali qualsiasi problema tramite l’Assistenza Viaggiatori nell’applicazione. Per quanto
non possa esservi risolto, le presenti condizioni sono regolate dalla legge della Florida e
ogni controversia è di competenza dei tribunali della contea di Miami-Dade, Florida.</p></section>

<section><h2>9 · Modifiche</h2>\n<p>Pubblicheremo le nuove condizioni con la data di aggiornamento. Per le modifiche importanti forniremo informazioni e richiederemo il consenso previsto dalla legge, senza modificare il Totale già confermato.</p></section>
`;

const PRIVACY_IT = `
<h1>Informativa sulla Privacy</h1>
<p class="updated">Ultimo aggiornamento: 13 ottobre 2026</p>

<div class="panel">${GOVERNING}</div>

<div class="panel"><strong>In breve:</strong> raccogliamo quanto necessario per organizzare i
suoi viaggi — il suo indirizzo e-mail e i luoghi dei suoi spostamenti. Non vendiamo i suoi
dati, non mostriamo pubblicità, e il numero della sua carta va a Stripe, mai a noi.</div>

<section><h2>1 · Dati raccolti</h2>\n<p>Raccogliamo nome, indirizzo e-mail, identità di accesso e dati della sessione; punti precisi di partenza e destinazione, percorso, orari, prezzi e ricevute; messaggi e segnalazioni di assistenza o sicurezza. Per gli Operatori anche patente, veicolo, assicurazione commerciale, verifiche e risultati dei controlli dei precedenti. Per Famiglia/Adolescenti anche nome, e-mail verificata, data di nascita, consenso del tutore e informazioni di monitoraggio. La posizione dell'Operatore può essere rilevata in background mentre è in servizio e ha autorizzato tale accesso; il rifiuto può impedire l'attivazione.</p></section>

<section><h2>2 · Utilizzo</h2>\n<p>Usiamo i dati per identità, sicurezza, idoneità, prezzo, assegnazione dei viaggi, monitoraggio, tutele per gli adolescenti, pagamenti, rimborsi, assistenza e prevenzione delle frodi. La ricerca facoltativa sui prezzi richiede consenso separato.</p></section>

<section><h2>3 · Destinatari</h2>\n<p>Google Firebase gestisce account e viaggi; Stripe elabora pagamenti senza che noi conserviamo numeri completi di carta; Render ospita il servizio. Fornitori di mappe, percorsi, pedaggi, verifiche, messaggi e notifiche ricevono solo le informazioni necessarie. L'Operatore assegnato e il tutore autorizzato possono vedere informazioni pertinenti; servizi di emergenza e autorità nei casi consentiti. Non vendiamo dati personali né mostriamo annunci.</p></section>

<section><h2>4 · Conservazione ed eliminazione</h2>\n<p>Si può avviare l'eliminazione in Account > Elimina account. Una richiesta esterna all'app può essere inviata a americanrider.communications@gmail.com. I dati collegati vengono eliminati salvo quanto debba essere conservato per legge, ricevute, sicurezza, imposte, contestazioni o prevenzione delle frodi. Un viaggio in corso può ritardare il completamento. L'Assistenza gestisce richieste di accesso, correzione e informazioni sui periodi di conservazione.</p></section>

<section><h2>4A · Ricerca facoltativa sui prezzi</h2>
<p>Solo se acconsente espressamente quando viene mostrato il prezzo, registriamo la contea,
una categoria generale della distanza, il totale visualizzato, l'ora della scelta
e se viene preparata una prenotazione. Il registro di ricerca non conserva il suo nome
né gli indirizzi esatti. Un riferimento alla prenotazione può essere associato al suo
account dal personale autorizzato. Non vendiamo questi dati e non li usiamo per pubblicità.
La partecipazione è facoltativa e non cambia il prezzo o l'accesso al servizio.
L'eliminazione è prevista dopo sette giorni, con eventuale ulteriore tempo di elaborazione.
L'eliminazione dell'account rimuove prima i dati collegati. Può anche chiedere il ritiro
all'Assistenza Viaggiatori.</p></section>

<section><h2>5 · Minori</h2>\n<p>Gli account ordinari sono per adulti. Il programma Famiglia/Adolescenti prevede account verificati di 13–17 anni con consenso e controllo del tutore. Non apriamo consapevolmente account a bambini sotto i 13 anni.</p></section>

<section><h2>6 · Modifiche</h2>
<p>Se la presente informativa cambia, la nuova versione sarà pubblicata qui con una data
aggiornata in alto.</p></section>
`;

module.exports = { TERMS_IT, PRIVACY_IT, GOVERNING };
