import JSZip from 'jszip';

/*
 * Gráficos nativos de Excel en un .xlsx ya armado.
 *
 * ExcelJS no sabe crear gráficos, así que después de escribir el libro se
 * le agregan a mano las piezas que usa Excel (DrawingML): un "drawing" por
 * hoja con el lugar de cada gráfico, y un chartN.xml por gráfico que lee
 * sus datos de celdas de la hoja. Así son gráficos de verdad: se pueden
 * editar, cambian si se cambian los datos y se ven en Excel, Google
 * Sheets y LibreOffice.
 */

export type TipoDeGrafico = 'columnas' | 'barras' | 'linea' | 'dona';

export interface SerieDeGrafico {
  nombre: string;
  /** Rango de los valores: "'Gráficos'!$B$4:$B$10". */
  rango: string;
  valores: number[];
  /** Color en hex sin #: "D98C2B". */
  color: string;
}

export interface GraficoExcel {
  tipo: TipoDeGrafico;
  titulo: string;
  /** Nombre de la hoja donde va el gráfico. */
  hoja: string;
  categorias: { rango: string; valores: string[] };
  series: SerieDeGrafico[];
  /** Formato de los números en el eje y las etiquetas. */
  formato: string;
  /** Colores de cada porción (solo dona). */
  coloresPorcion?: string[];
  /** Esquinas en celdas, desde 0: [columna, fila] a [columna, fila]. */
  desde: [number, number];
  hasta: [number, number];
}

const NS_C = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const NS_R =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_XDR =
  'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing';
const NS_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const REL_DRAWING = `${NS_R}/drawing`;
const REL_CHART = `${NS_R}/chart`;
const TIPO_DRAWING =
  'application/vnd.openxmlformats-officedocument.drawing+xml';
const TIPO_CHART =
  'application/vnd.openxmlformats-officedocument.drawingml.chart+xml';

const GRIS_LINEA = 'E5E0D8';
const TINTA_SUAVE = '4C5C6B';

export function escaparXml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Referencia absoluta a un rango de una hoja: 'Hoja'!$B$4:$B$10. */
export function rangoDe(
  hoja: string,
  columna: string,
  desde: number,
  hasta: number,
): string {
  return `'${hoja.replace(/'/g, "''")}'!$${columna}$${desde}:$${columna}$${hasta}`;
}

function texto(tamano: number, negrita: boolean, color = TINTA_SUAVE) {
  return `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${tamano}" b="${negrita ? 1 : 0}"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></a:defRPr></a:pPr><a:endParaRPr lang="es-EC"/></a:p></c:txPr>`;
}

function titulo(textoTitulo: string) {
  return `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1200" b="1"/></a:pPr><a:r><a:rPr lang="es-EC" sz="1200" b="1"><a:solidFill><a:srgbClr val="1B2A38"/></a:solidFill></a:rPr><a:t>${escaparXml(textoTitulo)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/>`;
}

function categorias(grafico: GraficoExcel) {
  const { rango, valores } = grafico.categorias;
  const puntos = valores
    .map((v, i) => `<c:pt idx="${i}"><c:v>${escaparXml(v)}</c:v></c:pt>`)
    .join('');
  return `<c:cat><c:strRef><c:f>${escaparXml(rango)}</c:f><c:strCache><c:ptCount val="${valores.length}"/>${puntos}</c:strCache></c:strRef></c:cat>`;
}

function valores(serie: SerieDeGrafico, formato: string) {
  const puntos = serie.valores
    .map((v, i) => `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`)
    .join('');
  return `<c:val><c:numRef><c:f>${escaparXml(serie.rango)}</c:f><c:numCache><c:formatCode>${escaparXml(formato)}</c:formatCode><c:ptCount val="${serie.valores.length}"/>${puntos}</c:numCache></c:numRef></c:val>`;
}

function etiquetasDeDatos(formato: string, porcentaje = false) {
  return `<c:dLbls>${porcentaje ? '' : `<c:numFmt formatCode="${escaparXml(formato)}" sourceLinked="0"/>`}<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>${texto(900, false)}<c:showLegendKey val="0"/><c:showVal val="${porcentaje ? 0 : 1}"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="${porcentaje ? 1 : 0}"/><c:showBubbleSize val="0"/>${porcentaje ? '<c:showLeaderLines val="1"/>' : ''}</c:dLbls>`;
}

function ejes(grafico: GraficoExcel, horizontal: boolean) {
  // Barras horizontales: la primera categoría arriba (y los valores abajo).
  const invertido = grafico.tipo === 'barras';
  const catAx = `<c:catAx><c:axId val="500"/><c:scaling><c:orientation val="${invertido ? 'maxMin' : 'minMax'}"/></c:scaling><c:delete val="0"/><c:axPos val="${horizontal ? 'l' : 'b'}"/><c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:spPr><a:ln w="6350"><a:solidFill><a:srgbClr val="${GRIS_LINEA}"/></a:solidFill></a:ln></c:spPr>${texto(900, false)}<c:crossAx val="501"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>`;
  const valAx = `<c:valAx><c:axId val="501"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="${horizontal ? 'b' : 'l'}"/><c:majorGridlines><c:spPr><a:ln w="6350"><a:solidFill><a:srgbClr val="${GRIS_LINEA}"/></a:solidFill></a:ln></c:spPr></c:majorGridlines><c:numFmt formatCode="${escaparXml(grafico.formato)}" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:spPr><a:ln><a:noFill/></a:ln></c:spPr>${texto(900, false)}<c:crossAx val="500"/><c:crosses val="${invertido ? 'max' : 'autoZero'}"/><c:crossBetween val="between"/></c:valAx>`;
  return catAx + valAx;
}

function leyenda(visible: boolean) {
  return visible
    ? `<c:legend><c:legendPos val="${'r'}"/><c:overlay val="0"/>${texto(900, false)}</c:legend>`
    : '';
}

/** El chartN.xml de un gráfico. */
export function xmlDelGrafico(grafico: GraficoExcel): string {
  let trazado: string;
  const variasSeries = grafico.series.length > 1;

  if (grafico.tipo === 'dona') {
    const serie = grafico.series[0];
    const porciones = (grafico.coloresPorcion ?? [])
      .map(
        (color, i) =>
          `<c:dPt><c:idx val="${i}"/><c:bubble3D val="0"/><c:spPr><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:ln w="12700"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:ln></c:spPr></c:dPt>`,
      )
      .join('');
    trazado = `<c:doughnutChart><c:varyColors val="1"/><c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:v>${escaparXml(serie.nombre)}</c:v></c:tx>${porciones}${etiquetasDeDatos(grafico.formato, true)}${categorias(grafico)}${valores(serie, grafico.formato)}</c:ser><c:firstSliceAng val="0"/><c:holeSize val="55"/></c:doughnutChart>`;
  } else if (grafico.tipo === 'linea') {
    const series = grafico.series
      .map(
        (serie, i) =>
          `<c:ser><c:idx val="${i}"/><c:order val="${i}"/><c:tx><c:v>${escaparXml(serie.nombre)}</c:v></c:tx><c:spPr><a:ln w="28575" cap="rnd"><a:solidFill><a:srgbClr val="${serie.color}"/></a:solidFill><a:round/></a:ln></c:spPr><c:marker><c:symbol val="circle"/><c:size val="5"/><c:spPr><a:solidFill><a:srgbClr val="${serie.color}"/></a:solidFill><a:ln><a:noFill/></a:ln></c:spPr></c:marker>${categorias(grafico)}${valores(serie, grafico.formato)}<c:smooth val="0"/></c:ser>`,
      )
      .join('');
    trazado = `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${series}<c:marker val="1"/><c:axId val="500"/><c:axId val="501"/></c:lineChart>${ejes(grafico, false)}`;
  } else {
    const horizontal = grafico.tipo === 'barras';
    const series = grafico.series
      .map(
        (serie, i) =>
          `<c:ser><c:idx val="${i}"/><c:order val="${i}"/><c:tx><c:v>${escaparXml(serie.nombre)}</c:v></c:tx><c:spPr><a:solidFill><a:srgbClr val="${serie.color}"/></a:solidFill></c:spPr><c:invertIfNegative val="0"/>${grafico.series.length === 1 && grafico.categorias.valores.length <= 12 ? etiquetasDeDatos(grafico.formato) : ''}${categorias(grafico)}${valores(serie, grafico.formato)}</c:ser>`,
      )
      .join('');
    trazado = `<c:barChart><c:barDir val="${horizontal ? 'bar' : 'col'}"/><c:grouping val="clustered"/><c:varyColors val="0"/>${series}<c:gapWidth val="60"/>${variasSeries ? '<c:overlap val="-10"/>' : ''}<c:axId val="500"/><c:axId val="501"/></c:barChart>${ejes(grafico, horizontal)}`;
  }

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<c:chartSpace xmlns:c="${NS_C}" xmlns:a="${NS_A}" xmlns:r="${NS_R}"><c:roundedCorners val="0"/><c:chart>${titulo(grafico.titulo)}<c:plotArea><c:layout/>${trazado}</c:plotArea>${leyenda(grafico.tipo === 'dona' || variasSeries)}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart><c:spPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln w="6350"><a:solidFill><a:srgbClr val="${GRIS_LINEA}"/></a:solidFill></a:ln></c:spPr></c:chartSpace>`
  );
}

function anclaDelGrafico(grafico: GraficoExcel, id: number, relId: string) {
  const [c1, f1] = grafico.desde;
  const [c2, f2] = grafico.hasta;
  return `<xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>${c1}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${f1}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>${c2}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${f2}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${id + 1}" name="${escaparXml(grafico.titulo)}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="${NS_C}"><c:chart xmlns:c="${NS_C}" xmlns:r="${NS_R}" r:id="${relId}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`;
}

/** El archivo de cada hoja, por su nombre (según workbook.xml). */
async function archivosDeHojas(zip: JSZip): Promise<Map<string, string>> {
  const libro = await zip.file('xl/workbook.xml')!.async('string');
  const rels = await zip.file('xl/_rels/workbook.xml.rels')!.async('string');
  const destinos = new Map<string, string>();
  for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = /\bId="([^"]+)"/.exec(m[0])?.[1];
    const destino = /\bTarget="([^"]+)"/.exec(m[0])?.[1];
    if (id && destino) destinos.set(id, destino.replace(/^\/?xl\//, ''));
  }
  const hojas = new Map<string, string>();
  for (const m of libro.matchAll(/<sheet\b[^>]*\/>/g)) {
    const nombre = /\bname="([^"]+)"/.exec(m[0])?.[1];
    const id = /\br:id="([^"]+)"/.exec(m[0])?.[1];
    if (!nombre || !id || !destinos.has(id)) continue;
    const real = nombre
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
    hojas.set(real, `xl/${destinos.get(id)}`);
  }
  return hojas;
}

/** Siguiente rId libre en un archivo de relaciones. */
function siguienteRelId(rels: string): string {
  const usados = [...rels.matchAll(/\bId="rId(\d+)"/g)].map((m) =>
    Number(m[1]),
  );
  return `rId${Math.max(0, ...usados) + 1}`;
}

/**
 * Agrega los gráficos al libro. Cada gráfico va en su hoja; las hojas que
 * ya tienen un drawing propio (imágenes de ExcelJS) no se tocan.
 */
export async function agregarGraficos(
  xlsx: Buffer,
  graficos: GraficoExcel[],
): Promise<Buffer> {
  if (graficos.length === 0) return xlsx;
  const zip = await JSZip.loadAsync(xlsx);
  const hojas = await archivosDeHojas(zip);
  let tipos = await zip.file('[Content_Types].xml')!.async('string');

  const porHoja = new Map<string, GraficoExcel[]>();
  for (const g of graficos) {
    porHoja.set(g.hoja, [...(porHoja.get(g.hoja) ?? []), g]);
  }

  let numeroDrawing = 0;
  let numeroGrafico = 0;
  for (const [nombreHoja, deLaHoja] of porHoja) {
    const archivoHoja = hojas.get(nombreHoja);
    if (!archivoHoja) continue;
    let xmlHoja = await zip.file(archivoHoja)!.async('string');
    if (xmlHoja.includes('<drawing ')) continue;

    numeroDrawing++;
    while (zip.file(`xl/drawings/drawing${numeroDrawing}.xml`)) numeroDrawing++;
    const archivoDrawing = `xl/drawings/drawing${numeroDrawing}.xml`;

    // Los gráficos de la hoja, y sus relaciones desde el drawing.
    const anclas: string[] = [];
    const relsDrawing: string[] = [];
    deLaHoja.forEach((grafico, i) => {
      numeroGrafico++;
      while (zip.file(`xl/charts/chart${numeroGrafico}.xml`)) numeroGrafico++;
      const relId = `rId${i + 1}`;
      zip.file(`xl/charts/chart${numeroGrafico}.xml`, xmlDelGrafico(grafico));
      tipos = tipos.replace(
        '</Types>',
        `<Override PartName="/xl/charts/chart${numeroGrafico}.xml" ContentType="${TIPO_CHART}"/></Types>`,
      );
      relsDrawing.push(
        `<Relationship Id="${relId}" Type="${REL_CHART}" Target="../charts/chart${numeroGrafico}.xml"/>`,
      );
      anclas.push(anclaDelGrafico(grafico, i + 1, relId));
    });
    zip.file(
      archivoDrawing,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<xdr:wsDr xmlns:xdr="${NS_XDR}" xmlns:a="${NS_A}">${anclas.join('')}</xdr:wsDr>`,
    );
    zip.file(
      `xl/drawings/_rels/drawing${numeroDrawing}.xml.rels`,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="${NS_REL}">${relsDrawing.join('')}</Relationships>`,
    );
    tipos = tipos.replace(
      '</Types>',
      `<Override PartName="/${archivoDrawing}" ContentType="${TIPO_DRAWING}"/></Types>`,
    );

    // La hoja apunta a su drawing.
    const carpeta = archivoHoja.slice(0, archivoHoja.lastIndexOf('/'));
    const base = archivoHoja.slice(archivoHoja.lastIndexOf('/') + 1);
    const archivoRels = `${carpeta}/_rels/${base}.rels`;
    let rels =
      (await zip.file(archivoRels)?.async('string')) ??
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="${NS_REL}"></Relationships>`;
    const relHoja = siguienteRelId(rels);
    rels = rels.replace(
      '</Relationships>',
      `<Relationship Id="${relHoja}" Type="${REL_DRAWING}" Target="../drawings/drawing${numeroDrawing}.xml"/></Relationships>`,
    );
    zip.file(archivoRels, rels);

    if (!/<worksheet\b[^>]*\bxmlns:r=/.test(xmlHoja)) {
      xmlHoja = xmlHoja.replace('<worksheet ', `<worksheet xmlns:r="${NS_R}" `);
    }
    // <drawing> va antes de estos elementos (orden del esquema de OOXML).
    const despues =
      /<(legacyDrawing|legacyDrawingHF|picture|oleObjects|controls|webPublishItems|tableParts|extLst)\b/.exec(
        xmlHoja,
      );
    const etiqueta = `<drawing r:id="${relHoja}"/>`;
    xmlHoja = despues
      ? xmlHoja.slice(0, despues.index) +
        etiqueta +
        xmlHoja.slice(despues.index)
      : xmlHoja.replace('</worksheet>', `${etiqueta}</worksheet>`);
    zip.file(archivoHoja, xmlHoja);
  }

  zip.file('[Content_Types].xml', tipos);
  return zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  });
}
