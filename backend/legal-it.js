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
<p class="updated">Ultimo aggiornamento: 6 agosto 2026</p>

<div class="panel">${GOVERNING}</div>

<div class="panel"><strong>American Rider è nel suo periodo di prova.</strong> L’applicazione
è distribuita tramite Apple TestFlight e alcune funzioni sono dimostrative. L’applicazione
indica, al momento del pagamento, se questo è reale o simulato.</div>

<section><h2>1 · Che cos’è American Rider</h2>
<p>American Rider è una piattaforma tecnologica che mette in contatto viaggiatori con
conducenti professionisti indipendenti («operatori»). Noi organizziamo il viaggio, mostriamo
un unico prezzo comprensivo di tutto e gestiamo il pagamento. La guida è fornita da operatori
indipendenti, non da American Rider: siamo una piattaforma di coordinamento, non un vettore.</p></section>

<section><h2>2 · Il suo account</h2>
<ul>
<li>Deve avere almeno 18 anni per avere un account. I minori viaggiano accompagnati dal
titolare dell’account.</li>
<li>Mantenga aggiornati e riservati il suo indirizzo e-mail e le sue credenziali. Quanto
avviene sul suo account è sua responsabilità: ci avvisi immediatamente (tramite Assistenza
Viaggiatori) se ritiene che un’altra persona lo stia utilizzando.</li>
</ul></section>

<section><h2>3 · Prezzi — l’impegno</h2>
<ul>
<li>Le viene mostrato <strong>un unico prezzo comprensivo di tutto prima della
prenotazione</strong>: la tariffa del viaggio più una commissione di piattaforma. La
commissione di piattaforma è di 1,50 USD o del 5 % della tariffa del viaggio, a seconda di
quale sia maggiore. L’elaborazione del pagamento è pagata con tale commissione.</li>
<li>Il prezzo indicato alla prenotazione è il prezzo addebitato.</li>
<li>Il suo operatore trattiene il 99 % della tariffa del viaggio. La nostra commissione è
l’1 % della tariffa del viaggio.</li>
</ul></section>

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

<section><h2>9 · Modifiche alle presenti condizioni</h2>
<p>Quando aggiorneremo le presenti condizioni — anche prima dell’inizio dei viaggi reali a
pagamento — pubblicheremo qui la nuova versione e aggiorneremo la data riportata in alto.
L’uso dell’applicazione dopo una modifica comporta l’accettazione delle condizioni
aggiornate.</p></section>
`;

const PRIVACY_IT = `
<h1>Informativa sulla Privacy</h1>
<p class="updated">Ultimo aggiornamento: 6 agosto 2026</p>

<div class="panel">${GOVERNING}</div>

<div class="panel"><strong>In breve:</strong> raccogliamo quanto necessario per organizzare i
suoi viaggi — il suo indirizzo e-mail e i luoghi dei suoi spostamenti. Non vendiamo i suoi
dati, non mostriamo pubblicità, e il numero della sua carta va a Stripe, mai a noi.</div>

<section><h2>1 · Che cosa raccogliamo</h2>
<ul>
<li><strong>Account:</strong> il suo indirizzo e-mail e una password (conservata in modo
sicuro da Google Firebase — noi non vediamo mai la password stessa).</li>
<li><strong>Viaggi:</strong> luoghi di ritiro e destinazione, percorso, orari e prezzo di
ciascun viaggio: è ciò di cui è composta una ricevuta.</li>
<li><strong>Posizione:</strong> la posizione del suo dispositivo, soltanto mentre imposta un
punto di ritiro o durante un viaggio, per orientare la freccia verso il suo veicolo e mostrare
l’avanzamento. Può rifiutarla nelle Impostazioni iOS; l’applicazione funziona ugualmente.</li>
</ul></section>

<section><h2>2 · A che cosa serve</h2>
<p>A far funzionare il servizio: assegnarle un operatore, calcolare e mostrare il prezzo del
suo viaggio, emettere ricevute, risolvere i problemi che ci segnala e mantenere sicura la
piattaforma. Nient’altro.</p></section>

<section><h2>3 · Chi tratta i dati (i nostri responsabili)</h2>
<ul>
<li><strong>Google Firebase</strong> — account e registrazioni dei viaggi.</li>
<li><strong>Stripe</strong> — pagamenti. I dati della sua carta vanno direttamente a Stripe;
noi non memorizziamo mai un numero di carta completo.</li>
<li><strong>Render</strong> — ospita il nostro server.</li>
<li>Le ricerche di percorso inviano le coordinate del viaggio (mai il suo nome) a un servizio
di calcolo dei percorsi.</li>
</ul>
<p>Non vendiamo le sue informazioni personali a nessuno e non mostriamo pubblicità.</p></section>

<section><h2>4 · Per quanto tempo li conserviamo</h2>
<p>Lo storico dei viaggi resta sul suo account affinché le sue ricevute esistano. Desidera che
il suo account e i suoi dati vengano eliminati? Lo richieda tramite l’Assistenza Viaggiatori
nell’applicazione e sarà fatto.</p></section>

<section><h2>5 · Minori</h2>
<p>Gli account American Rider sono riservati agli adulti dai 18 anni in su. Non raccogliamo
consapevolmente dati di minori.</p></section>

<section><h2>6 · Modifiche</h2>
<p>Se la presente informativa cambia, la nuova versione sarà pubblicata qui con una data
aggiornata in alto.</p></section>
`;

module.exports = { TERMS_IT, PRIVACY_IT, GOVERNING };
