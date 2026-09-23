/**
 * Tienda de demostración con un mes de movimiento realista, para probar
 * cada pantalla de KontaGo (incluido el historial).
 *
 *   npm run seed:demo        (con el backend corriendo)
 *
 * Se puede correr las veces que haga falta: borra la tienda demo anterior
 * y arma una nueva con ventas de los últimos 30 días Y de HOY (las
 * pantallas arrancan en el día en curso, así que una demo de ayer se ve
 * vacía).
 *
 * Todo pasa por la API real (IVA, stock, costo promedio y movimientos
 * quedan calculados como en el uso normal). La base solo se toca para dos
 * cosas que la API no permite a propósito: borrar la demo anterior y
 * llevar cada registro a su fecha (la API siempre usa "ahora").
 */
import 'dotenv/config';
import pg from 'pg';

if (process.env.NODE_ENV === 'production') {
  console.error('seed:demo no se corre en producción.');
  process.exit(1);
}

const API = process.env.API_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
const CLAVE = 'demo1234';
const ADMIN = { email: 'demo@kontago.test', nombre: 'María Salazar', tienda: 'Minimarket La Esquina' };
const CAJERO = { email: 'cajero@kontago.test', nombre: 'Pedro Gómez' };
const CAJERA_INACTIVA = { email: 'rosa@kontago.test', nombre: 'Rosa Andrade' };

// clave, código, nombre, categoría, precio¢, costo¢, stock final, mínimo, vence en (días), exento de IVA
const PRODUCTOS = [
  ['coca', '7861001234567', 'Coca-Cola 500 ml', 'Bebidas', 90, 55, 34, 12, null, false],
  ['agua', '7862100040011', 'Agua Tesalia 1 L', 'Bebidas', 75, 42, 28, 12, null, false],
  ['jugo', '7861023400123', 'Jugo Sunny naranja 1 L', 'Bebidas', 135, 88, 14, 6, 40, false],
  ['fiora', '7861001234598', 'Fioravanti fresa 3 L', 'Bebidas', 210, 145, 9, 4, null, false],
  ['leche', '7861001234568', 'Leche Vita entera 1 L', 'Lácteos', 110, 80, 3, 10, 6, true],
  ['yogurt', '7861001234571', 'Yogurt Toni frutilla 200 g', 'Lácteos', 125, 85, 2, 8, 4, false],
  ['queso', '7861054300087', 'Queso fresco Kiosko 500 g', 'Lácteos', 285, 210, 6, 3, 0, true],
  ['arroz', '7861001234570', 'Arroz Gustadina 2 kg', 'Abarrotes', 320, 240, 22, 6, null, true],
  ['azucar', '7861008800014', 'Azúcar San Carlos 2 kg', 'Abarrotes', 260, 195, 15, 5, null, true],
  ['aceite', '7861001234574', 'Aceite La Favorita 1 L', 'Abarrotes', 399, 310, 11, 4, null, false],
  ['fideo', '7861012300456', 'Fideo Don Vittorio 400 g', 'Abarrotes', 95, 62, 30, 10, null, true],
  ['atun', '7861001234572', 'Atún Real en aceite 180 g', 'Abarrotes', 185, 130, 26, 8, 220, false],
  ['sal', '7861031100019', 'Sal Crisal 1 kg', 'Abarrotes', 60, 38, 18, 5, null, true],
  ['huevos', '7861099900302', 'Huevos cubeta x30', 'Abarrotes', 550, 430, 2, 3, 12, true],
  ['pan', '7861001234569', 'Pan de molde Supan', 'Panadería', 250, 170, 1, 5, 2, false],
  ['galletas', '7861001234573', 'Galletas Amor', 'Snacks', 60, 35, 44, 12, 45, false],
  ['doritos', '7862001100455', 'Doritos queso 45 g', 'Snacks', 75, 48, 25, 10, 60, false],
  ['manicho', '7861062200017', 'Chocolate Manicho', 'Snacks', 50, 30, 36, 10, 120, false],
  ['jabon', '7702010500327', 'Jabón Protex 110 g', 'Aseo', 110, 72, 17, 6, null, false],
  ['papel', '7702026100093', 'Papel higiénico Familia x4', 'Aseo', 295, 215, 12, 4, null, false],
  ['deja', '7861024500091', 'Detergente Deja 1 kg', 'Aseo', 340, 255, 10, 4, null, false],
  ['colgate', '7891024132005', 'Pasta dental Colgate 75 ml', 'Aseo', 195, 135, 13, 5, null, false],
];

// Lo que suele llevar la gente junta en un minimarket.
const CANASTAS = [
  [['coca', 1], ['doritos', 1]],
  [['pan', 1], ['leche', 1]],
  [['arroz', 1], ['aceite', 1]],
  [['huevos', 1]],
  [['galletas', 3], ['manicho', 2]],
  [['yogurt', 2]],
  [['agua', 2]],
  [['atun', 2], ['fideo', 2]],
  [['azucar', 1], ['sal', 1]],
  [['jabon', 1], ['colgate', 1]],
  [['papel', 1], ['deja', 1]],
  [['coca', 2], ['galletas', 2]],
  [['jugo', 1], ['pan', 1]],
  [['fiora', 1], ['doritos', 2]],
  [['queso', 1], ['leche', 1]],
  [['manicho', 3]],
];

// Ventas por hora: arranque suave, pico al mediodía y otro a la salida del trabajo.
const VENTAS_POR_HORA = { 8: 2, 9: 3, 10: 4, 11: 4, 12: 6, 13: 6, 14: 3, 15: 3, 16: 4, 17: 6, 18: 6, 19: 4, 20: 2 };

// Días completos de historia antes de hoy.
const DIAS_DE_HISTORIA = 30;
// Movimiento según el día de la semana (domingo … sábado): el sábado es el fuerte.
const MOVIMIENTO_SEMANAL = [0.7, 0.85, 0.85, 0.9, 1, 1.15, 1.3];
// Hace cuántos días llegó el pedido semanal (lo mismo que llega hoy).
const REPOSICIONES = [28, 21, 14, 7];
// Rosa (hoy desactivada) atendió hasta hace dos semanas.
const ROSA_HASTA_HACE = 15;
const MOTIVOS_ANULACION = [
  'Se cobró dos veces',
  'El cliente cambió de marca',
  'Error al escanear',
  'El cliente no tenía suficiente dinero',
];

// Mercadería que llegó a primera hora: [producto, cantidad, costo unitario¢, proveedor]
const ABASTECIMIENTOS = [
  ['coca', 24, 52, 'Arca Continental'],
  ['leche', 12, 78, 'Pasteurizadora Quito'],
  ['galletas', 24, 34, 'Nestlé Ecuador'],
  ['pan', 6, 168, 'Supan'],
];

// Pérdidas del día: [producto, cantidad, motivo]
const MERMAS = [
  ['yogurt', 2, 'vencido'],
  ['galletas', 3, 'danado'],
  ['coca', 1, 'robado'],
];

// ---------------------------------------------------------------------------

// Generador con semilla: la demo sale igual cada vez que se corre.
function aleatorio(semilla) {
  return () => {
    semilla |= 0;
    semilla = (semilla + 0x6d2b79f5) | 0;
    let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const azar = aleatorio(20260922);
const elegir = (lista) => lista[Math.floor(azar() * lista.length)];

function fechaEnDias(dias) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  const dos = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

async function api(ruta, { method = 'GET', token, body } = {}) {
  const r = await fetch(API + ruta, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`${method} ${ruta} → ${r.status}: ${texto.slice(0, 200)}`);
  return texto ? JSON.parse(texto) : null;
}

const db = new pg.Client({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  user: process.env.DB_USER ?? 'kontago',
  password: process.env.DB_PASSWORD ?? 'kontago',
  database: process.env.DB_NAME ?? 'kontago',
});

// Mueve un registro recién creado a la hora planeada, corriéndolo la
// diferencia entre el momento en que se creó y esa hora. Así no importa
// en qué zona horaria guarda la base: se mueve relativo a su propio valor.
// Las ventas se crean de a varias, pero la conexión a la base es una sola:
// las consultas van en fila.
let fila = Promise.resolve();
async function moverA(tabla, id, creadoEnMs, planeado) {
  const segundos = (creadoEnMs - planeado.getTime()) / 1000;
  const consulta = fila.then(() =>
    db.query(`UPDATE ${tabla} SET created_at = created_at - make_interval(secs => $1) WHERE id = $2`, [segundos, id]),
  );
  fila = consulta.catch(() => {});
  await consulta;
}

// Corre las tareas de a `cuantas` a la vez (un mes son más de mil ventas).
async function enParalelo(tareas, cuantas) {
  let siguiente = 0;
  const trabajador = async () => {
    while (siguiente < tareas.length) await tareas[siguiente++]();
  };
  await Promise.all(Array.from({ length: cuantas }, trabajador));
}

// Un día a las hh:mm (hora local), `hace` días atrás.
function diaA(hace, horas, minutos = 0) {
  const d = new Date();
  d.setDate(d.getDate() - hace);
  d.setHours(horas, minutos, 0, 0);
  return d;
}

// ---------------------------------------------------------------------------

try {
  await api('/health');
} catch {
  console.error(`No responde el backend en ${API}. Levantalo con "npm run start:dev" y volvé a correr esto.`);
  process.exit(1);
}
await db.connect();

try {
  // 1. Borrar la demo anterior (solo la tienda cuyo admin es la cuenta demo).
  const previa = await db.query('SELECT tenant_id FROM usuarios WHERE email = $1', [ADMIN.email]);
  for (const { tenant_id: tenantId } of previa.rows) {
    await db.query('BEGIN');
    await db.query('DELETE FROM anulaciones_venta WHERE tenant_id = $1', [tenantId]);
    await db.query('DELETE FROM venta_items WHERE venta_id IN (SELECT id FROM ventas WHERE tenant_id = $1)', [tenantId]);
    await db.query('DELETE FROM ventas WHERE tenant_id = $1', [tenantId]);
    await db.query('DELETE FROM movimientos_inventario WHERE tenant_id = $1', [tenantId]);
    await db.query('DELETE FROM productos WHERE tenant_id = $1', [tenantId]);
    await db.query('DELETE FROM usuarios WHERE tenant_id = $1', [tenantId]);
    await db.query('DELETE FROM tenants WHERE id = $1', [tenantId]);
    await db.query('COMMIT');
    console.log('· Borrada la demo anterior');
  }

  // 2. Tienda y equipo
  const { accessToken: admin } = await api('/auth/registro', {
    method: 'POST',
    body: { nombreTienda: ADMIN.tienda, nombreAdmin: ADMIN.nombre, email: ADMIN.email, password: CLAVE },
  });
  await api('/usuarios', { method: 'POST', token: admin, body: { nombre: CAJERO.nombre, email: CAJERO.email, password: CLAVE } });
  const rosa = await api('/usuarios', {
    method: 'POST',
    token: admin,
    body: { nombre: CAJERA_INACTIVA.nombre, email: CAJERA_INACTIVA.email, password: CLAVE },
  });
  const { accessToken: cajero } = await api('/auth/login', {
    method: 'POST',
    body: { email: CAJERO.email, password: CLAVE },
  });
  // Rosa se desactiva al final: antes vende en los días en que trabajaba.
  const { accessToken: tokenRosa } = await api('/auth/login', {
    method: 'POST',
    body: { email: CAJERA_INACTIVA.email, password: CLAVE },
  });
  const tokens = { admin, cajero, rosa: tokenRosa };
  const { rows: [{ tenant_id: tenantId }] } = await db.query('SELECT tenant_id FROM usuarios WHERE email = $1', [
    ADMIN.email,
  ]);
  console.log('· Tienda y equipo creados');

  // 3. Planear las ventas: un mes de días completos y hoy.
  const ahora = new Date();
  const hasta = new Date(ahora.getTime() - 5 * 60_000);

  // Horarios de venta de un día; `factor` escala el movimiento de cada hora.
  function horariosDe(dia, factor, variar) {
    const lista = [];
    for (const [hora, base] of Object.entries(VENTAS_POR_HORA)) {
      const cantidad = variar ? Math.round(base * factor * (0.75 + azar() * 0.5)) : base;
      for (let i = 0; i < cantidad; i++) {
        const t = new Date(dia);
        t.setHours(Number(hora), Math.floor(azar() * 58) + 1, Math.floor(azar() * 59), 0);
        lista.push(t);
      }
    }
    return lista.sort((a, b) => a - b);
  }

  function vendedorDe(hace) {
    const r = azar();
    if (hace >= ROSA_HASTA_HACE) return r < 0.4 ? 'rosa' : r < 0.7 ? 'cajero' : 'admin';
    return r < 0.6 ? 'cajero' : 'admin';
  }

  function planear(cuando, hace) {
    const canasta = [...elegir(CANASTAS)];
    if (azar() < 0.3) canasta.push(...elegir(CANASTAS)); // algunos llevan de más
    const items = new Map();
    for (const [clave, cant] of canasta) items.set(clave, (items.get(clave) ?? 0) + cant);
    // En días pasados, alguna venta se anuló (las de hoy se eligen en el paso 8).
    let anular = null;
    if (hace > 0 && azar() < 0.025) {
      const [primera, cantPrimera] = [...items][0];
      anular = items.size > 1 || cantPrimera > 1 ? { clave: primera, cantidad: 1 } : 'total';
      if (azar() < 0.6) anular = 'total';
    }
    return { cuando, items, vendedor: vendedorDe(hace), anular };
  }

  const planes = [];
  for (let hace = DIAS_DE_HISTORIA; hace >= 1; hace--) {
    const dia = diaA(hace, 0);
    // Un poco menos de movimiento al principio del mes: la tienda viene creciendo.
    const tendencia = 0.85 + 0.15 * (1 - hace / DIAS_DE_HISTORIA);
    for (const cuando of horariosDe(dia, MOVIMIENTO_SEMANAL[dia.getDay()] * tendencia, true)) {
      planes.push(planear(cuando, hace));
    }
  }

  // Hoy: si ya pasaron varias horas, solo se usan las que pasaron (no hay
  // ventas "del futuro"). Si es muy temprano, se usa el horario completo de
  // hoy aunque algunas horas todavía no hayan llegado: si no, la demo
  // quedaría casi vacía.
  let horarios = horariosDe(ahora, 1, false);
  const pasados = horarios.filter((t) => t < hasta);
  const diaCompleto = pasados.length < 12;
  if (!diaCompleto) horarios = pasados;
  const planesDeHoy = horarios.map((cuando) => planear(cuando, 0));
  planes.push(...planesDeHoy);

  // Stock inicial = lo que se va a vender + perder + lo que debe quedar − lo que llega.
  // Lo anulado vuelve al stock, así que no cuenta como consumo.
  const consumo = new Map();
  const sumar = (k, c) => consumo.set(k, (consumo.get(k) ?? 0) + c);
  for (const plan of planes) {
    if (plan.anular === 'total') continue;
    for (const [k, c] of plan.items) sumar(k, c);
    if (plan.anular) sumar(plan.anular.clave, -plan.anular.cantidad);
  }
  for (const [k, c] of MERMAS) sumar(k, c);
  const entregas = REPOSICIONES.filter((hace) => hace <= DIAS_DE_HISTORIA).length + 1;
  const llega = new Map(ABASTECIMIENTOS.map(([k, c]) => [k, c * entregas]));

  // 4. Catálogo
  const ids = new Map();
  const precios = new Map();
  for (const [clave, codigo, nombre, categoria, precio, costo, final, minimo, vence, exento] of PRODUCTOS) {
    const stockInicial = Math.max(0, (consumo.get(clave) ?? 0) + final - (llega.get(clave) ?? 0));
    const p = await api('/productos', {
      method: 'POST',
      token: admin,
      body: {
        codigoBarras: codigo,
        nombre,
        categoria,
        precioVentaCentavos: precio,
        costoUnitarioCentavos: costo,
        stockInicial,
        stockMinimo: minimo,
        ivaExento: exento,
        ...(vence === null ? {} : { fechaVencimiento: fechaEnDias(vence) }),
      },
    });
    ids.set(clave, p.id);
    precios.set(clave, precio);
  }
  const descontinuado = await api('/productos', {
    method: 'POST',
    token: admin,
    body: { codigoBarras: '7861001299001', nombre: 'Gaseosa Tropical 2 L', categoria: 'Bebidas', precioVentaCentavos: 150, stockInicial: 0 },
  });
  await api(`/productos/${descontinuado.id}/baja`, { method: 'PATCH', token: admin });
  console.log(`· ${PRODUCTOS.length} productos (y uno dado de baja)`);

  // La tienda, el equipo y el catálogo existen desde antes del primer día.
  const apertura = diaA(DIAS_DE_HISTORIA + 1, 7, 30);
  await db.query('UPDATE tenants SET created_at = $2, updated_at = $2 WHERE id = $1', [tenantId, apertura]);
  for (const tabla of ['usuarios', 'productos']) {
    await db.query(`UPDATE ${tabla} SET created_at = $2 WHERE tenant_id = $1`, [tenantId, apertura]);
  }
  await db.query('UPDATE movimientos_inventario SET created_at = $2 WHERE tenant_id = $1', [tenantId, apertura]);

  // 5. Mercadería: el pedido semanal y el de esta mañana. Todo se carga
  // antes de las ventas para que nunca falte stock al registrarlas.
  const llegadas = [...REPOSICIONES.filter((hace) => hace <= DIAS_DE_HISTORIA).map((hace) => diaA(hace, 7, 40))];
  llegadas.push(new Date(horarios[0].getTime() - 20 * 60_000));
  for (const cuando of llegadas) {
    for (const [clave, cantidad, costo, proveedor] of ABASTECIMIENTOS) {
      const antes = Date.now();
      const mov = await api('/inventario/abastecimiento', {
        method: 'POST',
        token: admin,
        body: { productoId: ids.get(clave), cantidad, costoUnitarioCentavos: costo, proveedor },
      });
      await moverA('movimientos_inventario', mov.id, antes, cuando);
    }
  }

  // 6. Las ventas. Las anulaciones de días pasados se hacen apenas se crea
  // la venta (la API solo deja anular las de hoy) y después se llevan las
  // dos a su fecha.
  const billetes = [100, 200, 500, 1000, 2000];
  const anuladasAntes = [];
  const tareas = planes.map((plan) => {
    const items = [...plan.items].map(([k, cantidad]) => ({ productoId: ids.get(k), cantidad }));
    const total = [...plan.items].reduce((acc, [k, c]) => acc + precios.get(k) * c, 0);
    const recibido = azar() < 0.4 ? total : (billetes.find((b) => b >= total) ?? Math.ceil(total / 1000) * 1000);
    const motivo = elegir(MOTIVOS_ANULACION);
    return async () => {
      const antes = Date.now();
      const venta = await api('/ventas', {
        method: 'POST',
        token: tokens[plan.vendedor],
        body: { items, montoRecibidoCentavos: recibido },
      });
      if (plan.anular) {
        const linea = plan.anular === 'total' ? null : venta.items.find((i) => i.productoId === ids.get(plan.anular.clave));
        await api(`/ventas/${venta.id}/anular`, {
          method: 'POST',
          token: admin,
          body: { motivo, ...(linea ? { items: [{ ventaItemId: linea.id, cantidad: plan.anular.cantidad }] } : {}) },
        });
        anuladasAntes.push(venta.id);
      }
      await moverA('ventas', venta.id, antes, plan.cuando);
    };
  });
  await enParalelo(tareas, 6);
  if (anuladasAntes.length > 0) {
    await db.query(
      `UPDATE anulaciones_venta a SET created_at = v.created_at + interval '12 minutes'
         FROM ventas v WHERE a.venta_id = v.id AND v.id = ANY($1)`,
      [anuladasAntes],
    );
  }
  await api(`/usuarios/${rosa.id}/desactivar`, { method: 'PATCH', token: admin });
  console.log(
    `· ${planes.length - planesDeHoy.length} ventas en los ${DIAS_DE_HISTORIA} días anteriores (${anuladasAntes.length} anuladas)`,
  );
  console.log(`· ${planesDeHoy.length} ventas hoy entre las ${horarios[0]?.getHours()}h y las ${horarios.at(-1)?.getHours()}h`);

  // 7. Pérdidas, a media tarde (o antes si es temprano)
  const quinceVeinte = new Date(ahora).setHours(15, 20, 0, 0);
  const tarde = new Date(diaCompleto ? quinceVeinte : Math.min(quinceVeinte, hasta.getTime()));
  for (const [clave, cantidad, motivo] of MERMAS) {
    const antes = Date.now();
    const mov = await api('/inventario/merma', {
      method: 'POST',
      token: admin,
      body: { productoId: ids.get(clave), cantidad, motivo },
    });
    await moverA('movimientos_inventario', mov.id, antes, tarde);
  }

  // 8. Dos anulaciones: una completa y una parcial
  const deHoy = await api('/ventas/hoy', { token: admin });
  const completa = deHoy.find(
    (v) => v.vendedor === CAJERO.nombre && v.totalCentavos >= 400 && !v.items.some((i) => /Leche|Yogurt|Pan|Huevos/.test(i.nombre)),
  );
  if (completa) {
    await api(`/ventas/${completa.id}/anular`, {
      method: 'POST',
      token: admin,
      body: { motivo: 'El cliente se arrepintió antes de irse' },
    });
  }
  const conYogurt = deHoy.find((v) => v.id !== completa?.id && v.items.some((i) => /Yogurt/.test(i.nombre)));
  if (conYogurt) {
    const linea = conYogurt.items.find((i) => /Yogurt/.test(i.nombre));
    await api(`/ventas/${conYogurt.id}/anular`, {
      method: 'POST',
      token: admin,
      body: { motivo: 'Devolvió un yogurt con la tapa rota', items: [{ ventaItemId: linea.id, cantidad: 1 }] },
    });
  }
  // Cada anulación, unos minutos después de su venta (la API las fecha
  // "ahora", que puede ser antes que la venta si es muy temprano).
  const anuladas = [completa?.id, conYogurt?.id].filter(Boolean);
  if (anuladas.length > 0) {
    await db.query(
      diaCompleto
        ? `UPDATE anulaciones_venta a SET created_at = v.created_at + interval '12 minutes'
             FROM ventas v WHERE a.venta_id = v.id AND v.id = ANY($1)`
        : `UPDATE anulaciones_venta a SET created_at = LEAST(v.created_at + interval '12 minutes', now())
             FROM ventas v WHERE a.venta_id = v.id AND v.id = ANY($1)`,
      [anuladas],
    );
  }
  console.log('· Mermas y anulaciones registradas');

  const resumen = await api('/ventas/resumen-dia', { token: admin });
  const mes = await api(`/ventas/resumen?desde=${fechaEnDias(-DIAS_DE_HISTORIA)}&hasta=${fechaEnDias(0)}`, {
    token: admin,
  });
  const alertas = await api('/productos/alertas', { token: admin });
  const pesos = (c) => `$${(c / 100).toFixed(2)}`;

  console.log(`
Listo: "${ADMIN.tienda}"

  Entrar como admin :  ${ADMIN.email} / ${CLAVE}
  Entrar como cajero:  ${CAJERO.email} / ${CLAVE}
  (${CAJERA_INACTIVA.email} está desactivada: no puede entrar)
${diaCompleto ? '\n  Nota: es temprano, así que las ventas se repartieron en todo el horario de hoy\n  (8h a 20h), aunque algunas horas todavía no hayan llegado.\n' : ''}
  Hoy: ${resumen.cantidadVentas} ventas · ingreso ${pesos(resumen.ingresoBrutoCentavos)} · ganancia ${pesos(resumen.gananciaCentavos)} · anulado ${pesos(resumen.anuladoCentavos)}
  Con los ${DIAS_DE_HISTORIA} días anteriores: ${mes.cantidadVentas} ventas · ingreso ${pesos(mes.ingresoBrutoCentavos)} · ganancia ${pesos(mes.gananciaCentavos)} · anulado ${pesos(mes.anuladoCentavos)}
  Alertas: ${alertas.stockBajo.length} con stock bajo, ${alertas.porVencer.length} por vencer
`);
} finally {
  await db.end();
}
