// THE DISCLOSURE, IN THE LANGUAGE THE OPERATOR ACTUALLY READS.
//
// §627.748(8)(a) requires the disclosure to be MADE to the driver before they accept a ride.
// A disclosure in a language the operator cannot read has not been made in any sense the
// statute would recognise — and the operators American Rider is recruiting in Miami are
// substantially Spanish-speaking. This is compliance, not courtesy.
//
// THE ENGLISH GOVERNS, AND THAT IS STATED ON EVERY TRANSLATION. Not hedging: if a translation
// and the English ever diverge, the operator agreed to something we did not write, and the
// acknowledgement record would be evidence of the wrong thing. So the English is controlling
// and the translation exists to be understood.
//
// WHAT IS STORED IS THE VERSION AND THE LANGUAGE. server.js records which disclosure version
// was shown; it now records which language too, so the exact words an operator saw can be
// reproduced later rather than reconstructed. That is the whole reason this file exists
// instead of a translation call at render time.
//
// A NOTE ON REGISTER. The English is deliberately blunt — "There are no coverage types and no
// limits to state because there is no coverage." Spanish and Italian both invite softening
// that sentence into something more polite. They must not. An operator deciding whether to
// spend $200 a month on commercial cover is entitled to the same flat statement in their own
// language that an English speaker gets.
const { readKey } = require('./env');
const COVERAGE_KEYS = { es:'TNC_INSURANCE_DISCLOSURE_ES', fr:'TNC_INSURANCE_DISCLOSURE_FR', it:'TNC_INSURANCE_DISCLOSURE_IT', de:'TNC_INSURANCE_DISCLOSURE_DE' };

const TRANSLATIONS = {
  es: {
    title: 'Declaración de Seguro',
    provided: {
      heading: 'Lo que proporciona American Rider',
      body:
        'American Rider no proporciona seguro de responsabilidad civil de automóvil, cobertura ' +
        'para conductores sin seguro o con seguro insuficiente, ni protección contra lesiones ' +
        'personales en ningún momento. Ni mientras esté conectado a la red, ni mientras se ' +
        'dirige a una recogida, ni mientras lleva a un viajero en su vehículo. No hay tipos de ' +
        'cobertura ni límites que indicar porque no hay cobertura alguna.',
    },
    ownPolicy: {
      heading: 'Es posible que su propia póliza no le cubra',
      body:
        'Su póliza personal de seguro de automóvil podría no ofrecer ninguna cobertura ' +
        'mientras esté conectado a la red o lleve a un viajero, según sus condiciones. La ' +
        'mayoría de las pólizas personales excluyen el transporte de pasajeros a cambio de ' +
        'pago. Lea su póliza, o pregunte directamente a su aseguradora si le cubre mientras ' +
        'opera para una empresa de red de transporte.',
    },
    ownPolicyVerified: {
      heading: 'La póliza que usted ha aportado',
      body:
        'American Rider ha verificado una póliza comercial a su nombre y controla su fecha de ' +
        'vencimiento. La advertencia legal sigue siendo aplicable a cualquier póliza PERSONAL ' +
        'de automóvil que usted tenga: una póliza personal podría no ofrecer ninguna cobertura ' +
        'mientras esté conectado o lleve a un viajero, y la mayoría excluyen el transporte de ' +
        'pasajeros a cambio de pago. Su póliza comercial es la que le cubre aquí, y no se le ' +
        'asignan viajes una vez que vence.',
    },
    required: {
      heading: 'Lo que usted debe tener',
      body:
        'Florida exige que la cobertura del §627.748(7) esté vigente siempre que usted esté ' +
        'conectado. Dado que American Rider no proporciona ninguna parte de ella, toda debe ' +
        'proceder de una póliza que usted mismo tenga: comercial, de alquiler o de transporte ' +
        'de pasajeros. American Rider verifica esa póliza y su fecha de vencimiento, y no ' +
        'asignará viajes a un operador cuya cobertura haya vencido.',
    },
    acknowledgement:
      'He leído esta declaración. Entiendo que American Rider no proporciona ningún seguro y ' +
      'que mi propia póliza podría no cubrirme mientras esté conectado o lleve a un viajero.',
    governing:
      'Esta traducción se ofrece para que pueda leer este documento en su idioma. La versión ' +
      'en inglés es la jurídicamente vinculante.',
  },

  fr: {
    title: 'Déclaration d’Assurance',
    provided: {
      heading: 'Ce que fournit American Rider',
      body:
        'American Rider ne fournit aucune assurance responsabilité civile automobile, aucune ' +
        'garantie conducteur non assuré ou sous-assuré, ni aucune protection contre les ' +
        'dommages corporels, à aucun moment. Ni lorsque vous êtes connecté au réseau, ni ' +
        'lorsque vous vous rendez à une prise en charge, ni lorsqu’un voyageur se trouve dans ' +
        'votre véhicule. Il n’y a ni types de garantie ni plafonds à indiquer, car il n’y a ' +
        'aucune garantie.',
    },
    ownPolicy: {
      heading: 'Votre propre police pourrait ne pas vous couvrir',
      body:
        'Votre police d’assurance automobile personnelle pourrait n’offrir aucune garantie ' +
        'lorsque vous êtes connecté au réseau ou transportez un voyageur, selon ses ' +
        'conditions. La plupart des polices personnelles excluent le transport de passagers ' +
        'contre rémunération. Lisez votre police, ou demandez directement à votre assureur si ' +
        'elle vous couvre lorsque vous opérez pour une entreprise de réseau de transport.',
    },
    ownPolicyVerified: {
      heading: 'La police que vous avez fournie',
      body:
        'American Rider a vérifié une police commerciale à votre nom et en suit la date ' +
        'd’échéance. L’avertissement légal reste applicable à toute police PERSONNELLE ' +
        'd’automobile que vous détenez : une police personnelle pourrait n’offrir aucune ' +
        'garantie lorsque vous êtes connecté ou transportez un voyageur, et la plupart ' +
        'excluent le transport de passagers contre rémunération. C’est votre police ' +
        'commerciale qui vous couvre ici, et aucun trajet ne vous est attribué une fois ' +
        'qu’elle expire.',
    },
    required: {
      heading: 'Ce que vous devez détenir',
      body:
        'La Floride exige que la garantie prévue au §627.748(7) soit en vigueur dès lors que ' +
        'vous êtes connecté. American Rider n’en fournissant aucune partie, l’ensemble doit ' +
        'provenir d’une police que vous détenez vous-même — commerciale, de louage ou de ' +
        'transport de personnes. American Rider vérifie cette police et sa date d’échéance, et ' +
        'n’attribuera aucun trajet à un opérateur dont la garantie a expiré.',
    },
    acknowledgement:
      'J’ai lu cette déclaration. Je comprends qu’American Rider ne fournit aucune assurance ' +
      'et que ma propre police pourrait ne pas me couvrir lorsque je suis connecté ou ' +
      'transporte un voyageur.',
    governing:
      'Cette traduction est fournie afin que vous puissiez lire ce document dans votre langue. ' +
      'La version anglaise est juridiquement contraignante.',
  },

  it: {
    title: 'Informativa Assicurativa',
    provided: {
      heading: 'Che cosa fornisce American Rider',
      body:
        'American Rider non fornisce alcuna assicurazione di responsabilità civile auto, alcuna ' +
        'copertura per conducenti non assicurati o sottoassicurati, né alcuna protezione contro ' +
        'le lesioni personali, in nessun momento. Né mentre è connesso alla rete, né mentre si ' +
        'reca a un punto di ritiro, né mentre un viaggiatore si trova nel suo veicolo. Non vi ' +
        'sono tipi di copertura né massimali da indicare perché non vi è alcuna copertura.',
    },
    ownPolicy: {
      heading: 'La sua polizza potrebbe non coprirla',
      body:
        'La sua polizza assicurativa auto personale potrebbe non offrire alcuna copertura ' +
        'mentre è connesso alla rete o trasporta un viaggiatore, a seconda delle sue ' +
        'condizioni. La maggior parte delle polizze personali esclude il trasporto di ' +
        'passeggeri a pagamento. Legga la sua polizza, o chieda direttamente al suo ' +
        'assicuratore se la copre mentre opera per una società di rete di trasporto.',
    },
    ownPolicyVerified: {
      heading: 'La polizza che lei ha fornito',
      body:
        'American Rider ha verificato una polizza commerciale a suo nome e ne monitora la ' +
        'scadenza. L’avvertenza di legge resta applicabile a qualsiasi polizza auto PERSONALE ' +
        'da lei detenuta: una polizza personale potrebbe non offrire alcuna copertura mentre è ' +
        'connesso o trasporta un viaggiatore, e la maggior parte esclude il trasporto di ' +
        'passeggeri a pagamento. È la sua polizza commerciale a coprirla qui, e non le vengono ' +
        'assegnati viaggi una volta scaduta.',
    },
    required: {
      heading: 'Che cosa deve possedere',
      body:
        'La Florida richiede che la copertura di cui al §627.748(7) sia in vigore ogni volta ' +
        'che lei è connesso. Poiché American Rider non ne fornisce alcuna parte, tutta deve ' +
        'provenire da una polizza che lei stesso detiene — commerciale, per noleggio o per ' +
        'trasporto di persone. American Rider verifica tale polizza e la sua scadenza, e non ' +
        'assegnerà viaggi a un operatore la cui copertura sia scaduta.',
    },
    acknowledgement:
      'Ho letto questa informativa. Comprendo che American Rider non fornisce alcuna ' +
      'assicurazione e che la mia polizza potrebbe non coprirmi mentre sono connesso o ' +
      'trasporto un viaggiatore.',
    governing:
      'Questa traduzione è fornita affinché possa leggere il documento nella sua lingua. La ' +
      'versione inglese è quella giuridicamente vincolante.',
  },

  de: {
    title: 'Versicherungshinweis',
    provided: {
      heading: 'Was American Rider bereitstellt',
      body:
        'American Rider stellt zu keinem Zeitpunkt eine Kfz-Haftpflichtversicherung, einen ' +
        'Schutz gegen nicht oder unzureichend versicherte Fahrer oder eine Insassenunfall- ' +
        'versicherung bereit. Weder während Sie im Netzwerk angemeldet sind, noch auf dem Weg ' +
        'zu einer Abholung, noch während sich ein Reisender in Ihrem Fahrzeug befindet. Es gibt ' +
        'keine Deckungsarten und keine Deckungssummen anzugeben, weil kein Versicherungsschutz ' +
        'besteht.',
    },
    ownPolicy: {
      heading: 'Ihre eigene Police deckt Sie möglicherweise nicht',
      body:
        'Ihre private Kfz-Versicherung bietet je nach ihren Bedingungen möglicherweise keinerlei ' +
        'Schutz, während Sie im Netzwerk angemeldet sind oder einen Reisenden befördern. Die ' +
        'meisten privaten Policen schließen die entgeltliche Personenbeförderung aus. Lesen Sie ' +
        'Ihre Police, oder fragen Sie Ihren Versicherer direkt, ob sie Sie beim Betrieb für ein ' +
        'Transportnetzwerkunternehmen abdeckt.',
    },
    ownPolicyVerified: {
      heading: 'Die von Ihnen vorgelegte Police',
      body:
        'American Rider hat eine gewerbliche Police auf Ihren Namen geprüft und überwacht deren ' +
        'Ablaufdatum. Der gesetzliche Hinweis gilt weiterhin für jede PRIVATE Kfz-Police, die ' +
        'Sie halten: eine private Police bietet möglicherweise keinerlei Schutz, während Sie ' +
        'angemeldet sind oder einen Reisenden befördern, und die meisten schließen die ' +
        'entgeltliche Personenbeförderung aus. Ihre gewerbliche Police ist es, die Sie hier ' +
        'absichert, und nach deren Ablauf werden Ihnen keine Fahrten mehr zugewiesen.',
    },
    required: {
      heading: 'Was Sie vorhalten müssen',
      body:
        'Florida verlangt, dass der Versicherungsschutz nach §627.748(7) besteht, wann immer Sie ' +
        'angemeldet sind. Da American Rider keinen Teil davon bereitstellt, muss er vollständig ' +
        'aus einer Police stammen, die Sie selbst halten — gewerblich, Mietwagen oder ' +
        'Personenbeförderung. American Rider prüft diese Police und ihr Ablaufdatum und weist ' +
        'einem Operator, dessen Schutz abgelaufen ist, keine Fahrten zu.',
    },
    acknowledgement:
      'Ich habe diesen Hinweis gelesen. Mir ist bekannt, dass American Rider keinerlei ' +
      'Versicherung bereitstellt und dass meine eigene Police mich möglicherweise nicht ' +
      'abdeckt, während ich angemeldet bin oder einen Reisenden befördere.',
    governing:
      'Diese Übersetzung wird bereitgestellt, damit Sie dieses Dokument in Ihrer Sprache lesen ' +
      'können. Rechtlich verbindlich ist die englische Fassung.',
  },
};

/** Languages the disclosure exists in. English is the source and is always available. */
const DISCLOSURE_LANGUAGES = ['en', ...Object.keys(TRANSLATIONS)];

/**
 * The disclosure in `lang`, or null when we do not have it — the caller then serves English
 * rather than a half-translated document. A disclosure must never be part one language and
 * part another: an operator cannot tell which half they agreed to.
 */
function translationFor(lang) {
  const code = String(lang || '').slice(0, 2).toLowerCase();
  const base = TRANSLATIONS[code] || null;
  if (!base) return null;
  const coverage = String(readKey(COVERAGE_KEYS[code]) || '').trim();
  // Never serve the historical "no TNC coverage" paragraph after the contingency requirement
  // was identified. Until a reviewed translation of the bound policy is configured, this
  // language is unavailable and the caller falls back to the governing English disclosure.
  if (!coverage) return null;
  return { ...base, provided: { ...base.provided, body: coverage } };
}

module.exports = { TRANSLATIONS, DISCLOSURE_LANGUAGES, translationFor };
