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
<p class="updated">Zuletzt aktualisiert: 13. Oktober 2026</p>

<div class="panel">${GOVERNING}</div>

<div class="panel"><strong>American Rider befindet sich in der Testphase.</strong> Die App wird
über Apple TestFlight verteilt, und einige Funktionen sind Demonstrationen. Die App gibt im
Moment der Zahlung an, ob diese echt oder simuliert ist.</div>

<section><h2>1 · Was American Rider ist</h2>
<p>American Rider ist eine Technologieplattform, die Reisende mit unabhängigen
Berufsfahrern („Operatoren“) verbindet. Wir organisieren die Fahrt, zeigen einen einzigen
Gesamtpreis und wickeln die Zahlung ab. Die Beförderung erbringen unabhängige Operatoren,
nicht American Rider: Wir sind eine Vermittlungsplattform, kein Beförderungsunternehmen.</p></section>

<section><h2>2 · Konto und Alter</h2>
<p>Normale Reisenden- und Operator-Konten sind für Personen ab 18 Jahren. Das Familien-/Jugendprogramm ermöglicht verifizierte Konten für 13- bis 17-Jährige mit Einladung und Zustimmung eines Erziehungsberechtigten sowie Sicherheitskontrollen und Widerruf. Keine Konten für Kinder unter 13 Jahren.</p></section>

<section><h2>3 · Bestätigter Gesamtpreis</h2>
<p>Vor der Buchung wird ein einziger Gesamtpreis einschließlich Fahrpreis, Plattformgebühr, anwendbarer Maut und behördlicher Abgaben angezeigt. Die Plattformgebühr richtet sich nach den Dienstkosten, beträgt mindestens 2,50 USD und ist im angezeigten Gesamtpreis enthalten. Der Operator erhält 99 % des Fahrpreises, American Rider 1 % Provision. Ändert sich der Gesamtpreis vor der Buchung, ist eine neue ausdrückliche Zustimmung erforderlich. Ein nicht bestätigter höherer Betrag wird nicht belastet.</p></section>

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

<section><h2>9 · Änderungen</h2>
<p>Neue Bedingungen werden mit Datum veröffentlicht. Über wesentliche Änderungen informieren wir und holen gesetzlich erforderliche Zustimmungen ein; ein bereits bestätigter Gesamtpreis wird nicht rückwirkend geändert.</p></section>
`;

const PRIVACY_DE = `
<h1>Datenschutzerklärung</h1>
<p class="updated">Zuletzt aktualisiert: 13. Oktober 2026</p>

<div class="panel">${GOVERNING}</div>

<div class="panel"><strong>Kurz gefasst:</strong> Wir erheben, was zur Organisation Ihrer
Fahrten nötig ist — Ihre E-Mail-Adresse und Ihre Fahrtorte. Wir verkaufen Ihre Daten nicht,
wir zeigen keine Werbung, und Ihre Kartennummer geht an Stripe, niemals an uns.</div>

<section><h2>1 · Erhobene Daten</h2>
<p>Wir erfassen Name, E-Mail-Adresse, Anmeldeidentität und Sitzungsdaten; genaue Abhol- und Zielorte, Strecke, Zeiten, Preise und Belege; Nachrichten sowie Support- und Sicherheitsberichte. Bei Operatoren auch Führerschein, Fahrzeug, gewerbliche Versicherung, Prüfungen und Ergebnisse der Hintergrundkontrolle. Beim Familien-/Jugendprogramm auch Name, verifizierte E-Mail, Geburtsdatum, Zustimmung der Erziehungsberechtigten und Sicherheitsstandort. Während des Dienstes kann bei erteilter Erlaubnis auch im Hintergrund der Operator-Standort verarbeitet werden; ohne diese Erlaubnis kann die Dienstbereitschaft eingeschränkt sein.</p></section>

<section><h2>2 · Zwecke</h2>
<p>Wir verarbeiten diese Daten für Identität, Sicherheit, Berechtigung, Preisberechnung, Fahrtvermittlung, Fahrtverfolgung, Familien-/Jugendschutz, Zahlungen, Erstattungen, Support und Betrugsabwehr. Die freiwillige Preisforschung erfordert eine gesonderte Zustimmung.</p></section>

<section><h2>3 · Empfänger</h2>
<p>Google Firebase verwaltet Konten und Fahrten; Stripe verarbeitet Zahlungen, ohne dass wir vollständige Kartennummern speichern; Render hostet den Dienst. Karten-, Routen-, Maut-, Prüf-, Nachrichten- und Benachrichtigungsdienste erhalten erforderliche Informationen. Zugewiesene Operatoren und berechtigte Erziehungsberechtigte erhalten fahrtbezogene Daten; Rettungsdienste und Behörden nur im erforderlichen bzw. gesetzlich vorgesehenen Umfang. Wir verkaufen keine personenbezogenen Daten und schalten keine Werbung.</p></section>

<section><h2>4 · Aufbewahrung und Löschung</h2>
<p>Über Konto > Konto löschen können Sie die Löschung in der App veranlassen. Ohne App können Sie an americanrider.communications@gmail.com schreiben. Zugeordnete Daten werden gelöscht, außer soweit Aufbewahrung für Gesetze, Belege, Sicherheit, Steuerrecht, Streitfälle oder Betrugsabwehr erforderlich ist. Eine laufende Fahrt kann die endgültige Löschung verzögern. Support beantwortet Anträge auf Auskunft, Berichtigung und Informationen zur Speicherdauer.</p></section>

<section><h2>4A · Freiwillige Preisstudie</h2>
<p>Nur wenn Sie bei Anzeige des Fahrpreises ausdrücklich zustimmen, erfassen wir den
Landkreis, eine grobe Entfernungskategorie, den angezeigten Gesamtbetrag, den Zeitpunkt
Ihrer Zustimmung und ob eine Buchung vorbereitet wurde. Ihr Name und genaue Adressen
werden nicht im Forschungsdatensatz gespeichert. Autorisierte Mitarbeiter können eine
Buchungsreferenz Ihrem Konto zuordnen. Wir verkaufen diese Daten nicht und verwenden
sie nicht für Werbung. Die Teilnahme ist freiwillig und beeinflusst weder Preis noch
Zugang zur Fahrt. Die Löschung ist nach sieben Tagen vorgesehen; die Verarbeitung beim
Datenbankanbieter kann länger dauern. Beim Löschen des Kontos werden verknüpfte
Forschungsdaten früher entfernt. Sie können den Widerruf auch beim Kundenservice
beantragen.</p></section>

<section><h2>5 · Minderjährige</h2>
<p>Normale Konten sind für Erwachsene ab 18 Jahren. Verifizierte Familien-/Jugendkonten für 13- bis 17-Jährige erfordern Zustimmung und Kontrolle der Erziehungsberechtigten. Konten für Kinder unter 13 Jahren werden nicht wissentlich eingerichtet.</p></section>

<section><h2>6 · Änderungen</h2>
<p>Ändert sich diese Erklärung, wird die neue Fassung hier mit aktualisiertem Datum oben
veröffentlicht.</p></section>
`;

module.exports = { TERMS_DE, PRIVACY_DE, GOVERNING };
