// CONDITIONS ET CONFIDENTIALITÉ — français.
//
// See legal-es.js for the reasoning. English is the source and legally controlling; the
// governing-language notice sits at the top of each page, before any substantive section.
//
// REGISTER: vouvoiement, and the English's plainness preserved. French legal drafting reaches
// for the impersonal by convention — "il est porté à la connaissance de l'utilisateur" — and
// that convention is exactly what these documents were written to avoid.
const GOVERNING =
  'Cette traduction est fournie afin que vous puissiez lire ce document dans votre langue. ' +
  'La version anglaise est juridiquement contraignante.';

const TERMS_FR = `
<h1>Conditions Générales</h1>
<p class="updated">Dernière mise à jour : 6 août 2026</p>

<div class="panel">${GOVERNING}</div>

<div class="panel"><strong>American Rider est en période de test.</strong> L’application est
distribuée via Apple TestFlight et certaines fonctions sont des démonstrations. L’application
indique, au moment du paiement, si celui-ci est réel ou simulé.</div>

<section><h2>1 · Ce qu’est American Rider</h2>
<p>American Rider est une plateforme technologique qui met en relation des voyageurs avec des
conducteurs professionnels indépendants (« opérateurs »). Nous organisons le trajet,
affichons un prix unique tout compris et gérons le paiement. La conduite est assurée par des
opérateurs indépendants, et non par American Rider : nous sommes une plateforme de
coordination, non un transporteur.</p></section>

<section><h2>2 · Votre compte</h2>
<ul>
<li>Vous devez avoir 18 ans ou plus pour détenir un compte. Les mineurs voyagent accompagnés
du titulaire du compte.</li>
<li>Tenez votre adresse e-mail et vos identifiants à jour et confidentiels. Ce qui se passe
sur votre compte relève de votre responsabilité ; prévenez-nous immédiatement (via
l’Assistance Voyageurs) si vous pensez qu’une autre personne l’utilise.</li>
</ul></section>

<section><h2>3 · Tarification — l’engagement</h2>
<ul>
<li>Un <strong>prix unique tout compris vous est indiqué avant la réservation</strong> : le
tarif du trajet plus des frais de plateforme. Les frais de plateforme s’élèvent à 1,50 USD
ou à 5 % du tarif du trajet, selon le montant le plus élevé. Le traitement du paiement est
prélevé sur ces frais.</li>
<li>Le prix indiqué à la réservation est le prix débité.</li>
<li>Votre opérateur conserve 99 % du tarif du trajet. Notre commission s’élève à 1 % du tarif
du trajet.</li>
</ul></section>

<section><h2>4 · Annulations</h2>
<ul>
<li>Avant l’arrivée de votre opérateur, vous pouvez annuler et votre tarif vous est
intégralement restitué.</li>
<li>Une fois votre opérateur arrivé, l’annulation vous restitue le tarif diminué de frais
d’arrivée de 3,00 USD. Ces frais sont versés à l’opérateur, qui s’est déplacé jusqu’à vous et
a patienté.</li>
<li>Une fois le trajet commencé, il ne peut plus être annulé. L’Assistance Voyageurs règle
tout incident survenant sur un trajet déjà en cours.</li>
</ul></section>

<section><h2>5 · Paiements</h2>
<p>Les paiements sont traités par Stripe. American Rider ne voit ni ne conserve jamais le
numéro complet de votre carte. L’application indique si un paiement est réel ou simulé au
moment où il est prélevé.</p></section>

<section><h2>6 · Voyager avec nous</h2>
<p>Les voyageurs ne peuvent utiliser la plateforme à des fins illicites ni entraver le
contrôle du véhicule par l’opérateur en toute sécurité. Les demandes raisonnables de
l’opérateur — ceinture de sécurité, interdiction de fumer et autres — doivent être
respectées. Un compte mettant en danger un opérateur ou un autre voyageur peut être
suspendu.</p></section>

<section><h2>7 · Pendant la période de test</h2>
<p>Le service est fourni « en l’état » pendant nos tests. Certaines fonctions peuvent être
simulées, évoluer ou ne pas fonctionner ; l’application peut être indisponible par moments.
Dans toute la mesure permise par le droit de Floride, la responsabilité d’American Rider
pendant le programme de test est limitée aux montants que vous nous avez effectivement
versés.</p></section>

<section><h2>8 · Différends</h2>
<p>Signalez tout incident via l’Assistance Voyageurs dans l’application. Pour ce qui ne peut y
être résolu, les présentes conditions sont régies par le droit de Floride et tout litige
relève des tribunaux du comté de Miami-Dade, Floride.</p></section>

<section><h2>9 · Modification des présentes conditions</h2>
<p>Lorsque nous modifierons ces conditions — y compris avant le début des trajets payants
réels — nous publierons ici la nouvelle version et mettrons à jour la date figurant en haut.
L’utilisation de l’application après une modification vaut acceptation des conditions
mises à jour.</p></section>
`;

const PRIVACY_FR = `
<h1>Politique de Confidentialité</h1>
<p class="updated">Dernière mise à jour : 6 août 2026</p>

<div class="panel">${GOVERNING}</div>

<div class="panel"><strong>En résumé :</strong> nous collectons ce qui est nécessaire pour
organiser vos trajets — votre adresse e-mail et les lieux de vos déplacements. Nous ne
vendons pas vos données, nous n’affichons pas de publicité, et le numéro de votre carte est
transmis à Stripe, jamais à nous.</div>

<section><h2>1 · Ce que nous collectons</h2>
<ul>
<li><strong>Compte :</strong> votre adresse e-mail et un mot de passe (conservé de manière
sécurisée par Google Firebase — nous ne voyons jamais le mot de passe lui-même).</li>
<li><strong>Trajets :</strong> lieux de prise en charge et de destination, itinéraire,
horaires et prix de chaque trajet — c’est ce dont un reçu est constitué.</li>
<li><strong>Localisation :</strong> la position de votre appareil, uniquement lorsque vous
définissez un point de prise en charge ou pendant un trajet, afin d’orienter la flèche vers
votre véhicule et d’afficher la progression. Vous pouvez la refuser dans les Réglages iOS ;
l’application fonctionne sans elle.</li>
</ul></section>

<section><h2>2 · À quoi cela nous sert</h2>
<p>À faire fonctionner le service : vous attribuer un opérateur, calculer et afficher le prix
de votre trajet, établir les reçus, résoudre les problèmes que vous signalez et préserver la
sécurité de la plateforme. Rien d’autre.</p></section>

<section><h2>3 · Qui traite les données (nos sous-traitants)</h2>
<ul>
<li><strong>Google Firebase</strong> — comptes et enregistrements de trajets.</li>
<li><strong>Stripe</strong> — paiements. Les données de votre carte sont transmises
directement à Stripe ; nous ne conservons jamais un numéro de carte complet.</li>
<li><strong>Render</strong> — héberge notre serveur.</li>
<li>Les recherches d’itinéraire transmettent les coordonnées du trajet (jamais votre nom) à un
service de calcul d’itinéraire.</li>
</ul>
<p>Nous ne vendons vos informations personnelles à personne et nous n’affichons pas de
publicité.</p></section>

<section><h2>4 · Durée de conservation</h2>
<p>L’historique des trajets reste sur votre compte afin que vos reçus existent. Vous
souhaitez la suppression de votre compte et de ses données ? Demandez-le via l’Assistance
Voyageurs dans l’application et cela sera fait.</p></section>

<section><h2>5 · Mineurs</h2>
<p>Les comptes American Rider sont réservés aux adultes de 18 ans et plus. Nous ne collectons
pas sciemment de données concernant des mineurs.</p></section>

<section><h2>6 · Modifications</h2>
<p>En cas de modification de la présente politique, la nouvelle version sera publiée ici avec
une date mise à jour en haut de page.</p></section>
`;

module.exports = { TERMS_FR, PRIVACY_FR, GOVERNING };
