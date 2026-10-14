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
<p class="updated">Dernière mise à jour : 13 octobre 2026</p>

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

<section><h2>2 · Compte et âge</h2>\n<p>Les comptes ordinaires Voyageur et Opérateur sont réservés aux personnes de 18 ans et plus. Le programme Famille/Adolescents permet aux 13–17 ans de créer un compte vérifié sur invitation et avec autorisation du responsable légal, sous réserve des contrôles de sécurité et de révocation. Aucun compte pour les moins de 13 ans.</p></section>

<section><h2>3 · Prix total confirmé</h2>\n<p>Avant toute réservation, un seul Total inclut le tarif du trajet, les frais de plateforme ainsi que les péages et prélèvements publics applicables. Les frais de plateforme dépendent des coûts du service et ne sont pas inférieurs à 2,50 USD ; ils sont déjà compris dans le Total affiché. L'Opérateur conserve 99 % du tarif du trajet et American Rider reçoit une commission de 1 %. Si le Total change avant la réservation, un nouvel accord exprès est nécessaire. Aucun montant supérieur non accepté ne sera débité.</p></section>

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

<section><h2>9 · Modifications</h2>\n<p>Nous publions les nouvelles conditions et leur date. Toute modification importante fera l'objet de l'information et du consentement requis par la loi, sans effet rétroactif sur le Total déjà accepté.</p></section>
`;

const PRIVACY_FR = `
<h1>Politique de Confidentialité</h1>
<p class="updated">Dernière mise à jour : 13 octobre 2026</p>

<div class="panel">${GOVERNING}</div>

<div class="panel"><strong>En résumé :</strong> nous collectons ce qui est nécessaire pour
organiser vos trajets — votre adresse e-mail et les lieux de vos déplacements. Nous ne
vendons pas vos données, nous n’affichons pas de publicité, et le numéro de votre carte est
transmis à Stripe, jamais à nous.</div>

<section><h2>1 · Données collectées</h2>\n<p>Nous recueillons le nom, l'adresse e-mail, l'identité de connexion et les informations de session ; les lieux précis de départ et d'arrivée, l'itinéraire, les heures, le prix et les reçus ; les messages et dossiers d'assistance ou de sécurité. Pour les Opérateurs : permis, véhicule, assurance commerciale, vérifications et résultats des contrôles d'antécédents. Pour Famille/Adolescents : nom, e-mail vérifié, date de naissance, autorisation du responsable légal et informations de suivi. La localisation de l'Opérateur peut continuer en arrière-plan lorsqu'il est en service et l'a autorisée ; le refus peut empêcher la mise en service.</p></section>

<section><h2>2 · Utilisation</h2>\n<p>Ces informations servent à l'identification, la sécurité, l'admissibilité, la tarification, la répartition des trajets, leur suivi, les contrôles Famille/Adolescents, les paiements, les remboursements, l'assistance et la prévention de la fraude. Les études facultatives de prix nécessitent un consentement distinct.</p></section>

<section><h2>3 · Destinataires</h2>\n<p>Google Firebase traite les comptes et trajets ; Stripe traite les paiements sans que nous conservions les numéros complets de carte ; Render héberge les services. Les prestataires d'itinéraires, de cartes, de péages, de contrôle, de messagerie et de notifications ne reçoivent que les informations nécessaires. L'Opérateur affecté et le responsable légal autorisé peuvent recevoir les données pertinentes pour le trajet ; les autorités ou secours lorsque cela est justifié. Nous ne vendons pas les données personnelles et n'affichons pas de publicité.</p></section>

<section><h2>4 · Conservation et suppression</h2>\n<p>La rubrique Compte > Supprimer le compte permet de demander sa suppression dans l'application. La demande peut aussi être envoyée sans l'application à americanrider.communications@gmail.com. Les données liées sont supprimées, sauf les dossiers dont la conservation est justifiée par la loi, les reçus, la sécurité, la fiscalité, les litiges ou la prévention de la fraude. Un trajet actif peut différer la fin du traitement. L'Assistance traite les demandes d'accès, de correction et de durée de conservation.</p></section>

<section><h2>4A · Étude facultative des tarifs</h2>
<p>Uniquement si vous acceptez expressément lorsque le prix est affiché, nous enregistrons
le comté, une catégorie générale de distance, le total affiché, la date de votre choix
et si une réservation a été préparée. L'étude ne conserve ni votre nom ni les adresses
exactes. Une référence de réservation peut être reliée à votre compte par le personnel
autorisé. Ces données ne sont ni vendues ni utilisées pour la publicité. Le choix est
facultatif et ne modifie ni le prix ni l'accès aux trajets. La suppression est programmée
après sept jours, avec un délai de traitement supplémentaire possible. La suppression
du compte retire plus tôt les données liées. Vous pouvez aussi demander le retrait
auprès de l'Assistance Voyageurs.</p></section>

<section><h2>5 · Mineurs</h2>\n<p>Les comptes ordinaires sont réservés aux adultes. Les comptes vérifiés Famille/Adolescents sont destinés aux 13–17 ans avec accord et contrôle du responsable légal. Nous n'ouvrons pas sciemment de compte aux moins de 13 ans.</p></section>

<section><h2>6 · Modifications</h2>
<p>En cas de modification de la présente politique, la nouvelle version sera publiée ici avec
une date mise à jour en haut de page.</p></section>
`;

module.exports = { TERMS_FR, PRIVACY_FR, GOVERNING };
