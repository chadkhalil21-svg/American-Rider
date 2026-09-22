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
<p class="updated">Última actualización: 6 de agosto de 2026</p>

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

<section><h2>2 · Su cuenta</h2>
<ul>
<li>Debe tener 18 años o más para tener una cuenta. Los menores viajan acompañados del
titular de la cuenta.</li>
<li>Mantenga su correo electrónico y sus datos de acceso actualizados y en privado. Lo que
ocurra en su cuenta es su responsabilidad, así que avísenos de inmediato (a través de
Atención al Viajero) si cree que otra persona la está usando.</li>
</ul></section>

<section><h2>3 · Precios — el compromiso</h2>
<ul>
<li>Se le muestra <strong>un único precio final antes de reservar</strong>: la tarifa del
viaje más una tarifa de plataforma. La tarifa de plataforma es de 1,50 USD o el 5 % de la
tarifa del viaje, lo que sea mayor. El procesamiento del pago se paga con cargo a esa
tarifa.</li>
<li>El precio indicado al reservar es el precio que se cobra.</li>
<li>Su operador retiene el 99 % de la tarifa del viaje. Nuestra comisión es del 1 % de la
tarifa del viaje.</li>
</ul></section>

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

<section><h2>9 · Cambios en estos términos</h2>
<p>Cuando actualicemos estos términos —incluso antes de que comiencen los viajes reales de
pago— publicaremos aquí la nueva versión y actualizaremos la fecha que figura arriba. El uso
de la aplicación tras un cambio implica la aceptación de los términos actualizados.</p></section>
`;

const PRIVACY_ES = `
<h1>Política de Privacidad</h1>
<p class="updated">Última actualización: 6 de agosto de 2026</p>

<div class="panel">${GOVERNING}</div>

<div class="panel"><strong>La versión breve:</strong> recogemos lo necesario para organizar
sus viajes —su correo electrónico y las ubicaciones de sus trayectos—. No vendemos sus
datos, no mostramos publicidad, y el número de su tarjeta va a Stripe, nunca a nosotros.</div>

<section><h2>1 · Qué recogemos</h2>
<ul>
<li><strong>Cuenta:</strong> su dirección de correo electrónico y una contraseña (almacenada
de forma segura por Google Firebase; nosotros nunca vemos la contraseña).</li>
<li><strong>Viajes:</strong> ubicaciones de recogida y destino, la ruta, los horarios y el
precio de cada viaje: eso es lo que compone un recibo.</li>
<li><strong>Ubicación:</strong> la ubicación de su dispositivo, únicamente mientras fija un
punto de recogida o durante un viaje, para orientar la flecha hacia su vehículo y mostrar el
avance del trayecto. Puede denegarla en los Ajustes de iOS; la aplicación sigue funcionando
sin ella.</li>
</ul></section>

<section><h2>2 · Para qué lo utilizamos</h2>
<p>Para prestar el servicio: asignarle un operador, calcular y mostrar el precio de su
viaje, emitir recibos, resolver los problemas que nos comunique y mantener la seguridad de
la plataforma. Nada más.</p></section>

<section><h2>3 · Quién trata los datos (nuestros encargados)</h2>
<ul>
<li><strong>Google Firebase</strong> — cuentas y registros de viajes.</li>
<li><strong>Stripe</strong> — pagos. Los datos de su tarjeta van directamente a Stripe;
nosotros nunca almacenamos un número de tarjeta completo.</li>
<li><strong>Render</strong> — aloja nuestro servidor.</li>
<li>Las consultas de ruta envían coordenadas del trayecto (nunca su nombre) a un servicio de
cálculo de rutas.</li>
</ul>
<p>No vendemos su información personal a nadie y no mostramos publicidad.</p></section>

<section><h2>4 · Cuánto tiempo lo conservamos</h2>
<p>El historial de viajes permanece en su cuenta para que existan sus recibos. ¿Desea que se
eliminen su cuenta y sus datos? Solicítelo a través de Atención al Viajero en la aplicación
y así se hará.</p></section>

<section><h2>5 · Menores</h2>
<p>Las cuentas de American Rider son para adultos mayores de 18 años. No recogemos
conscientemente datos de menores.</p></section>

<section><h2>6 · Cambios</h2>
<p>Si esta política cambia, la nueva versión se publicará aquí con una fecha actualizada
en la parte superior.</p></section>
`;

module.exports = { TERMS_ES, PRIVACY_ES, GOVERNING };
