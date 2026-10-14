// TÉRMINOS Y PRIVACIDAD — español.
//
// Translated 4 Sept 2026. The English at backend/legal.js is the source and is legally
// controlling; this exists so that a Spanish-speaking traveler or operator can actually read
// what they are agreeing to. The governing-language notice appears at the top of each page,
// not buried at the bottom, because a reader is entitled to know that before they read on.
//
// REGISTER: usted, and the English's plainness preserved. These documents were deliberately
// written so a normal person can read them — "Pricing — the promise", "the price quoted at
// reservation is the price charged". Spanish legal prose drifts toward the notarial by habit;
// that drift would undo the one thing these documents were written for.
//
// STILL DRAFTS. The English carries a status note saying it awaits review by a Florida
// attorney before non-test rides begin. The translation inherits that status and adds to it:
// a bilingual attorney should read this before an operator signs anything in Spanish.
const GOVERNING =
  'Esta traducción se ofrece para que pueda leer este documento en su idioma. La versión en ' +
  'inglés es la jurídicamente vinculante.';

const TERMS_ES = `
<h1>Términos del Servicio</h1>
<p class="updated">Última actualización: 13 de octubre de 2026</p>

<div class="panel">${GOVERNING}</div>

<div class="panel"><strong>American Rider se encuentra en su periodo de pruebas.</strong> La
aplicación se distribuye a través de Apple TestFlight y algunas funciones son
demostraciones. En la aplicación se indica, en el momento del pago, si este es real o
simulado.</div>

<section><h2>1 · Qué es American Rider</h2>
<p>American Rider es una plataforma tecnológica que conecta a viajeros con conductores
profesionales independientes («operadores»). Nosotros organizamos el viaje, mostramos un
único precio final y gestionamos el pago. La conducción la prestan operadores
independientes, no American Rider: somos una plataforma de coordinación, no una empresa de
transporte.</p></section>

<section><h2>2 · Cuenta y edades</h2>\n<p>Las cuentas ordinarias de Viajeros y Operadores son para mayores de 18 años. El programa Familia/Adolescentes permite cuentas verificadas de 13 a 17 años con invitación y autorización del tutor, controles de seguridad y revocación. No se permiten cuentas para menores de 13 años.</p></section>

<section><h2>3 · Precio total confirmado</h2>\n<p>Antes de reservar, se muestra un solo Total que comprende la tarifa del viaje, la tarifa de plataforma y los peajes o cargos públicos aplicables. La tarifa de plataforma se calcula según los costes del servicio y no es inferior a 2,50 USD; ya está incluida en el Total mostrado. El Operador conserva el 99 % de la tarifa del viaje y la comisión de American Rider es del 1 %. Si cambia el Total antes de reservar, debe revisar y confirmar el nuevo importe. No se efectuará un cargo superior sin su aceptación.</p></section>

<section><h2>4 · Cancelaciones</h2>
<ul>
<li>Antes de que llegue su operador, puede cancelar y se le devuelve la tarifa íntegra.</li>
<li>Una vez que su operador ha llegado, al cancelar se le devuelve la tarifa menos una tasa
de llegada de 3,00 USD. Esa tasa se abona al operador, que condujo hasta usted y esperó.</li>
<li>Una vez iniciado el viaje no puede cancelarse. Atención al Viajero resuelve cualquier
incidencia de un viaje ya en curso.</li>
</ul></section>

<section><h2>5 · Pagos</h2>
<p>Los pagos los procesa Stripe. American Rider nunca ve ni almacena el número completo de
su tarjeta. La aplicación indica si un pago es real o simulado en el momento de cobrarlo.</p></section>

<section><h2>6 · Viajar con nosotros</h2>
<p>Los viajeros no pueden utilizar la plataforma con fines ilícitos ni interferir en el
control seguro del vehículo por parte del operador. Deben atenderse las peticiones
razonables del operador —cinturones de seguridad, no fumar y similares—. Una cuenta que
ponga en riesgo a un operador o a otro viajero puede ser suspendida.</p></section>

<section><h2>7 · Durante el periodo de pruebas</h2>
<p>El servicio se presta «tal cual» mientras realizamos pruebas. Algunas funciones pueden
estar simuladas, cambiar o fallar; la aplicación puede no estar disponible en algunos
momentos. En la máxima medida que permita la legislación de Florida, la responsabilidad de
American Rider durante el programa de pruebas se limita a los importes que usted nos haya
abonado efectivamente.</p></section>

<section><h2>8 · Discrepancias</h2>
<p>Plantee cualquier incidencia a través de Atención al Viajero en la aplicación. Para
aquello que no pueda resolverse allí, estos términos se rigen por la legislación de Florida
y cualquier controversia corresponde a los tribunales del condado de Miami-Dade,
Florida.</p></section>

<section><h2>9 · Cambios de los términos</h2>\n<p>Publicaremos la fecha y la versión de los términos actualizados. Los cambios importantes recibirán el aviso y el consentimiento que exija la ley; no modifican retroactivamente el Total de un viaje ya confirmado.</p></section>
`;

const PRIVACY_ES = `
<h1>Política de Privacidad</h1>
<p class="updated">Última actualización: 13 de octubre de 2026</p>

<div class="panel">${GOVERNING}</div>

<div class="panel"><strong>La versión breve:</strong> recogemos lo necesario para organizar
sus viajes —su correo electrónico y las ubicaciones de sus trayectos—. No vendemos sus
datos, no mostramos publicidad, y el número de su tarjeta va a Stripe, nunca a nosotros.</div>

<section><h2>1 · Datos recopilados</h2>\n<p>Recopilamos nombre, correo electrónico, datos de autenticación y sesión; ubicaciones exactas de recogida y destino, ruta, hora, precio y recibos; mensajes y solicitudes de asistencia o seguridad. Para los Operadores, también datos del permiso de conducir, vehículo, seguro comercial, verificación y evaluación de antecedentes. Para Familia/Adolescentes, nombre, correo verificado, fecha de nacimiento, autorización del tutor y datos de seguimiento. La ubicación del Operador puede actualizarse en segundo plano mientras esté de servicio, según el permiso del dispositivo; rechazar dicho permiso puede impedir operar.</p></section>

<section><h2>2 · Finalidades</h2>\n<p>Usamos los datos para identidad, seguridad, cumplimiento, verificación, precios, asignación de viajes, seguimiento, protección de adolescentes y tutores, pagos, reembolsos, atención y prevención del fraude. Los estudios opcionales de precios requieren consentimiento aparte.</p></section>

<section><h2>3 · Destinatarios</h2>\n<p>Google Firebase almacena cuentas y viajes; Stripe procesa pagos sin que almacenemos números completos de tarjeta; Render aloja los servicios. Proveedores de mapas, rutas, peajes, verificaciones, mensajes y notificaciones reciben solo los datos necesarios para prestar el servicio. Compartimos información pertinente con el Operador asignado, el tutor autorizado durante viajes de adolescentes y, cuando corresponda, servicios de emergencia o autoridades. No vendemos datos personales ni mostramos publicidad.</p></section>

<section><h2>4 · Conservación y eliminación</h2>\n<p>La opción Cuenta > Eliminar cuenta permite iniciar la eliminación desde la aplicación. También puede solicitarla fuera de ella por correo electrónico a americanrider.communications@gmail.com. Eliminamos los datos asociados, salvo los registros que debamos conservar por ley o para recibos, seguridad, impuestos, reclamaciones, fraude y disputas; la eliminación puede estar pendiente mientras exista un viaje activo. Consulte Asistencia para solicitar acceso, corrección o detalles de conservación.</p></section>

<section><h2>4A · Estudio opcional de precios</h2>
<p>Solo si usted acepta expresamente al ver el precio de un viaje, registramos el condado,
una categoría general de distancia, el importe total mostrado, el momento de su elección
y si se inició una reserva. No guardamos su nombre ni las direcciones exactas en el registro
del estudio. Una referencia de reserva puede vincularse con su cuenta mediante personal
autorizado. No vendemos estos datos ni los usamos para publicidad. Participar es opcional
y no modifica el precio ni el acceso al servicio. Los datos se programan para eliminación
después de siete días; el proveedor puede tardar más en procesarla. La eliminación de la
cuenta retira antes los registros vinculados. También puede solicitar la retirada
a Atención al Viajero.</p></section>

<section><h2>5 · Menores</h2>\n<p>Las cuentas ordinarias son para adultos. El programa Familia/Adolescentes permite cuentas verificadas de 13 a 17 años con autorización y control del tutor. No creamos deliberadamente cuentas para menores de 13 años.</p></section>

<section><h2>6 · Cambios</h2>
<p>Si esta política cambia, la nueva versión se publicará aquí con una fecha actualizada
en la parte superior.</p></section>
`;

module.exports = { TERMS_ES, PRIVACY_ES, GOVERNING };
