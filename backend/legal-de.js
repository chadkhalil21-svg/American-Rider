// NUTZUNGSBEDINGUNGEN UND DATENSCHUTZ — Deutsch.
//
// See legal-es.js for the reasoning. English is the source and legally controlling.
// REGISTER: "Sie", and the English's plainness preserved. German legal drafting is closest of
// the four to our own register by default, which makes the risk here bureaucratic coldness
// rather than ceremony. Plain German, precisely used — the same instruction as the English.
const GOVERNING =
  'Diese Übersetzung wird bereitgestellt, damit Sie dieses Dokument in Ihrer Sprache lesen ' +
  'können. Rechtlich verbindlich ist die englische Fassung.';

const TERMS_DE = `
<h1>Nutzungsbedingungen</h1>
<p class="updated">Zuletzt aktualisiert: 6. August 2026</p>

<div class="panel">${GOVERNING}</div>

<div class="panel"><strong>American Rider befindet sich in der Testphase.</strong> Die App wird
über Apple TestFlight verteilt, und einige Funktionen sind Demonstrationen. Die App gibt im
Moment der Zahlung an, ob diese echt oder simuliert ist.</div>

<section><h2>1 · Was American Rider ist</h2>
<p>American Rider ist eine Technologieplattform, die Reisende mit unabhängigen
Berufsfahrern („Operatoren“) verbindet. Wir organisieren die Fahrt, zeigen einen einzigen
Gesamtpreis und wickeln die Zahlung ab. Die Beförderung erbringen unabhängige Operatoren,
nicht American Rider: Wir sind eine Vermittlungsplattform, kein Beförderungsunternehmen.</p></section>

<section><h2>2 · Ihr Konto</h2>
<ul>
<li>Sie müssen mindestens 18 Jahre alt sein, um ein Konto zu führen. Minderjährige fahren in
Begleitung des Kontoinhabers.</li>
<li>Halten Sie Ihre E-Mail-Adresse und Ihre Zugangsdaten aktuell und vertraulich. Was auf
Ihrem Konto geschieht, liegt in Ihrer Verantwortung — teilen Sie uns daher umgehend über die
Reisendenbetreuung mit, wenn Sie vermuten, dass eine andere Person es nutzt.</li>
</ul></section>

<section><h2>3 · Preise — die Zusage</h2>
<ul>
<li>Ihnen wird <strong>vor der Reservierung ein einziger Gesamtpreis</strong> angezeigt: der
Fahrpreis zuzüglich einer Plattformgebühr. Die Plattformgebühr beträgt 1,50 USD oder 5 % des
Fahrpreises, je nachdem, welcher Betrag höher ist. Die Zahlungsabwicklung wird aus dieser
Gebühr bezahlt.</li>
<li>Der bei der Reservierung genannte Preis ist der Preis, der abgebucht wird.</li>
<li>Ihr Operator behält 99 % des Fahrpreises. Unsere Provision beträgt 1 % des Fahrpreises.</li>
</ul></section>

<section><h2>4 · Stornierungen</h2>
<ul>
<li>Vor Eintreffen Ihres Operators können Sie stornieren, und der Fahrpreis wird Ihnen
vollständig erstattet.</li>
<li>Nach Eintreffen des Operators wird bei Stornierung der Fahrpreis abzüglich einer
Anfahrtsgebühr von 3,00 USD erstattet. Diese Gebühr erhält der Operator, der zu Ihnen
gefahren ist und gewartet hat.</li>
<li>Eine begonnene Fahrt kann nicht storniert werden. Die Reisendenbetreuung klärt alles, was
bei einer bereits laufenden Fahrt schiefgeht.</li>
</ul></section>

<section><h2>5 · Zahlungen</h2>
<p>Zahlungen werden von Stripe abgewickelt. American Rider sieht und speichert Ihre
vollständige Kartennummer zu keinem Zeitpunkt. Die App gibt im Moment der Abbuchung an, ob
eine Zahlung echt oder simuliert ist.</p></section>

<section><h2>6 · Mitfahren</h2>
<p>Reisende dürfen die Plattform nicht für rechtswidrige Zwecke nutzen und die sichere
Führung des Fahrzeugs durch den Operator nicht beeinträchtigen. Angemessenen Aufforderungen
des Operators — Sicherheitsgurt, Rauchverbot und Ähnliches — ist Folge zu leisten. Ein Konto,
das einen Operator oder einen anderen Reisenden gefährdet, kann gesperrt werden.</p></section>

<section><h2>7 · Während der Testphase</h2>
<p>Der Dienst wird während unserer Tests „wie besehen“ bereitgestellt. Funktionen können
simuliert sein, sich ändern oder ausfallen; die App kann zeitweise nicht verfügbar sein.
Soweit das Recht Floridas dies zulässt, ist die Haftung von American Rider während des
Testprogramms auf die Beträge beschränkt, die Sie uns tatsächlich gezahlt haben.</p></section>

<section><h2>8 · Meinungsverschiedenheiten</h2>
<p>Melden Sie alles, was schiefgeht, über die Reisendenbetreuung in der App. Für alles, was
dort nicht geklärt werden kann, gilt das Recht Floridas, und für Streitigkeiten sind die
Gerichte des Miami-Dade County, Florida, zuständig.</p></section>

<section><h2>9 · Änderungen dieser Bedingungen</h2>
<p>Wenn wir diese Bedingungen aktualisieren — auch vor Beginn echter bezahlter Fahrten —
veröffentlichen wir die neue Fassung hier und aktualisieren das Datum oben. Die weitere
Nutzung der App nach einer Änderung gilt als Annahme der aktualisierten Bedingungen.</p></section>
`;

const PRIVACY_DE = `
<h1>Datenschutzerklärung</h1>
<p class="updated">Zuletzt aktualisiert: 6. August 2026</p>

<div class="panel">${GOVERNING}</div>

<div class="panel"><strong>Kurz gefasst:</strong> Wir erheben, was zur Organisation Ihrer
Fahrten nötig ist — Ihre E-Mail-Adresse und Ihre Fahrtorte. Wir verkaufen Ihre Daten nicht,
wir zeigen keine Werbung, und Ihre Kartennummer geht an Stripe, niemals an uns.</div>

<section><h2>1 · Was wir erheben</h2>
<ul>
<li><strong>Konto:</strong> Ihre E-Mail-Adresse und ein Passwort (sicher gespeichert von
Google Firebase — wir sehen das Passwort selbst nie).</li>
<li><strong>Fahrten:</strong> Abhol- und Zielorte, die Route, Zeiten und der Preis jeder
Fahrt — daraus besteht ein Beleg.</li>
<li><strong>Standort:</strong> der Standort Ihres Geräts, nur während Sie einen Abholpunkt
festlegen oder während einer Fahrt, um den Pfeil auf Ihr Fahrzeug auszurichten und den
Fahrtverlauf anzuzeigen. Sie können dies in den iOS-Einstellungen ablehnen; die App
funktioniert auch ohne.</li>
</ul></section>

<section><h2>2 · Wofür wir sie verwenden</h2>
<p>Für den Betrieb des Dienstes: Ihnen einen Operator zuzuweisen, Ihre Fahrt zu berechnen und
anzuzeigen, Belege zu erstellen, von Ihnen gemeldete Probleme zu lösen und die Plattform
sicher zu halten. Mehr nicht.</p></section>

<section><h2>3 · Wer die Daten verarbeitet (unsere Auftragsverarbeiter)</h2>
<ul>
<li><strong>Google Firebase</strong> — Konten und Fahrtdaten.</li>
<li><strong>Stripe</strong> — Zahlungen. Ihre Kartendaten gehen direkt an Stripe; wir
speichern niemals eine vollständige Kartennummer.</li>
<li><strong>Render</strong> — betreibt unseren Server.</li>
<li>Routenabfragen übermitteln Fahrtkoordinaten (niemals Ihren Namen) an einen
Routing-Dienst.</li>
</ul>
<p>Wir verkaufen Ihre personenbezogenen Daten an niemanden und zeigen keine Werbung.</p></section>

<section><h2>4 · Wie lange wir sie aufbewahren</h2>
<p>Der Fahrtverlauf bleibt auf Ihrem Konto, damit Ihre Belege existieren. Sie möchten Ihr
Konto und dessen Daten löschen lassen? Beantragen Sie es über die Reisendenbetreuung in der
App, und es wird erledigt.</p></section>

<section><h2>5 · Minderjährige</h2>
<p>American-Rider-Konten sind für Erwachsene ab 18 Jahren bestimmt. Wir erheben nicht
wissentlich Daten von Kindern.</p></section>

<section><h2>6 · Änderungen</h2>
<p>Ändert sich diese Erklärung, wird die neue Fassung hier mit aktualisiertem Datum oben
veröffentlicht.</p></section>
`;

module.exports = { TERMS_DE, PRIVACY_DE, GOVERNING };
