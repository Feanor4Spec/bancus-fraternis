/**
 * ============================================
 * ConsórcioPro V7 - Base da Prateleira
 * ============================================
 * Loader dinâmico que carrega 17.000+ grupos
 * reais do arquivo Tab_Grupos_Consorcio.json.
 * Mantém fallback para o catálogo simulado.
 * ============================================
 */

// ─── Dimensões de Referência ───

const SegmentosRef = {
  1: { nome: 'Imóveis', macro: 'imovel', icon: '🏠' },
  2: { nome: 'Pesados e Equipamentos', macro: 'pesado', icon: '🚜' },
  3: { nome: 'Automóveis', macro: 'automovel', icon: '🚗' },
  4: { nome: 'Motos', macro: 'moto', icon: '🏍️' },
  5: { nome: 'Outros Bens Móveis', macro: 'outros', icon: '📦' },
  6: { nome: 'Serviços Turísticos', macro: 'servico', icon: '✈️' }
};

const IndiceCorrecaoRef = {
  1: 'INCC',
  2: 'IPCA',
  3: 'IGP-M',
  4: 'FIPE',
  5: 'TR',
  6: 'Pré-fixado',
  99: 'Outro'
};

const NomeAdministradoraRef = {};

// Mapa de fallback CNPJ → Nome (para JSONs antigos que não incluem nomeAdministradora)
const _cnpjFallbackMap = {
  '00000776': 'ITAÚ ADM DE CONSÓRCIOS LTDA',
  '00266031': 'CICAL ADM DE CONS LTDA',
  '00600262': 'FERRAZ CONSORCIOS',
  '00643742': 'FUNDACAO HAB. DO EXERCITO-FHE',
  '02010478': 'BANCORBRÁS',
  '03403333': 'IRMÃOS DE MARCO ADM CONS LTDA',
  '03586655': 'H. CONSÓRCIO',
  '03762395': 'BRENNER ADM CONS LTDA',
  '03762583': 'ÁPICE ADM DE CONSORCIO LTDA',
  '03828278': 'ADM CONS BECKER LTDA',
  '03832228': 'APEC ADM CONSORCIO S/A',
  '04058605': 'SOLUÇÃO ADM. DE CONSÓRCIOS LTD',
  '04124922': 'MULTIMARCAS ADM.CONS.LTDA.',
  '04250224': 'MAGGI ADM CONS LTDA',
  '04751943': 'FRANCAUTO ADM CONS LTDA.',
  '05126027': 'MOTOASA ADM. CONS. LTDA',
  '05349595': 'CNP CONSORCIO S.A. ADM CONS',
  '05395814': 'NOVOTEMPO ADM CONS',
  '05551841': 'TÁGIDE CONSÓRCIOS',
  '05652765': 'CONSORCIO NACIONAL NANUQUE',
  '06043050': 'BB CONSÓRCIOS',
  '06044551': 'CONSORCIO GAZIN',
  '06046109': 'BRISA ADM CONSÓRCIOS',
  '06181431': 'BP',
  '06940240': 'FIEL CONSÓRCIOS',
  '60746948': 'BRADESCO ADM DE CONSÓRCIOS LTDA',
  '61855045': 'PORTO SEGURO CONSÓRCIOS',
  '00360305': 'CAIXA CONSÓRCIOS',
  '49925225': 'VOLKSWAGEN CONSÓRCIO',
  '73178600': 'EMBRACON ADM DE CONSÓRCIOS LTDA',
  '89437043': 'RANDON CONSÓRCIO',
  '07318435': 'MAGALU CONSÓRCIO'
};

// ─── Catálogo Principal (será populado via fetch) ───

let ShelfCatalog = [];
let _shelfDataLoaded = false;
let _shelfDataError = null;
let _shelfDataSource = 'pending';
let _shelfDataStats = {
  total: 0,
  valid: 0,
  path: '',
  loadedAt: null
};

function _applyFallbackCatalog(message) {
  _shelfDataLoaded = false;
  _shelfDataError = message || null;
  _shelfDataSource = 'fallback';

  if (ShelfCatalog.length === 0) {
    try {
      ShelfCatalog = _getSimulatedCatalog().map(enrichGroup);
      console.warn(`Catalogo real indisponivel. Usando fallback com ${ShelfCatalog.length} grupos.`);
    } catch (fallbackErr) {
      ShelfCatalog = [];
      console.warn('Catalogo real e fallback indisponiveis. App iniciado sem grupos.');
    }
  }

  _shelfDataStats = {
    total: ShelfCatalog.length,
    valid: ShelfCatalog.length,
    path: 'fallback-simulado',
    loadedAt: new Date().toISOString()
  };

  return ShelfCatalog.length;
}

/**
 * Enriquece um grupo com campos derivados caso estejam ausentes.
 * Garante compatibilidade entre base real (JSON) e catálogo simulado.
 */
function _firstValue(source, keys, fallback) {
  for (const key of keys) {
    const value = source ? source[key] : undefined;
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return fallback;
}

function _asText(value, fallback = '') {
  if (value === undefined || value === null) return fallback;
  const text = String(value).trim();
  return text === '' ? fallback : text;
}

function _onlyDigits(value, fallback = '') {
  const digits = _asText(value).replace(/\D/g, '');
  return digits || fallback;
}

function _parseNumber(value, fallback = 0) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (value === undefined || value === null || value === '') return fallback;

  let text = String(value).trim().replace(/[^\d,.-]/g, '');
  if (!text) return fallback;

  const lastComma = text.lastIndexOf(',');
  const lastDot = text.lastIndexOf('.');

  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSep = lastComma > lastDot ? ',' : '.';
    const thousandSep = decimalSep === ',' ? '.' : ',';
    text = text.split(thousandSep).join('');
    if (decimalSep === ',') text = text.replace(',', '.');
  } else if (lastComma >= 0) {
    text = text.replace(/\./g, '').replace(',', '.');
  }

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function _parseInteger(value, fallback = 0) {
  return Math.max(0, Math.round(_parseNumber(value, fallback)));
}

function _parseRatio(value, fallback = 0) {
  const parsed = _parseNumber(value, fallback);
  return parsed > 1 ? parsed / 100 : parsed;
}

function _parseBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value === undefined || value === null || value === '') return fallback;
  const text = String(value).trim().toLowerCase();
  if (['true', '1', 'sim', 's', 'yes'].includes(text)) return true;
  if (['false', '0', 'nao', 'não', 'n', 'no'].includes(text)) return false;
  return fallback;
}

function _normalizeGroup(raw, index = 0) {
  const g = raw && typeof raw === 'object' ? { ...raw } : {};
  const codigoSegmento = _parseInteger(_firstValue(g, ['codigoSegmento', 'segmentoCodigo', 'codSegmento'], 0));
  const prazoMeses = _parseInteger(_firstValue(g, ['prazoMeses', 'prazo', 'prazoOriginal'], 0));
  const indiceMaturidadeRaw = _parseRatio(_firstValue(g, ['indiceMaturidade', 'maturidade'], 0));
  const assembleias = _parseInteger(
    _firstValue(g, ['assembleias', 'qtdAssembleias', 'assembleiasRealizadas', 'numeroAssembleia'], indiceMaturidadeRaw * prazoMeses),
    0
  );
  const indiceMaturidade = indiceMaturidadeRaw || (prazoMeses > 0 ? assembleias / prazoMeses : 0);
  const cnpjRaiz = _onlyDigits(_firstValue(g, ['cnpjRaiz', 'cnpjAdministradora', 'cnpj'], ''), _asText(g.cnpjRaiz));
  const codigoGrupo = _asText(_firstValue(g, ['codigoGrupo', 'grupo', 'idGrupo'], ''), `GRUPO-${index + 1}`);
  const dataBase = _firstValue(g, ['dataBase', 'competencia'], '');

  g.cnpjRaiz = cnpjRaiz;
  g.cnpjAdministradora = _asText(_firstValue(g, ['cnpjAdministradora', 'cnpj', 'cnpjRaiz'], cnpjRaiz));
  g.codigoGrupo = codigoGrupo;
  g.codigoSegmento = codigoSegmento;
  g.valorCartaRef = _parseNumber(_firstValue(g, ['valorCartaRef', 'valorCarta', 'cartaCredito'], 0));
  g.prazoMeses = prazoMeses;
  g.assembleias = assembleias;
  g.taxaAdmPct = _parseNumber(_firstValue(g, ['taxaAdmPct', 'taxaAdministracaoPct', 'taxaAdm'], 0));
  g.fundoReservaPct = _parseNumber(_firstValue(g, ['fundoReservaPct', 'fundoReserva'], 2), 2);
  g.indiceCorrecaoCodigo = _parseInteger(_firstValue(g, ['indiceCorrecaoCodigo'], 99), 99);
  g.indiceCorrecaoNome = _asText(
    _firstValue(g, ['indiceCorrecaoNome', 'indiceCorrecao'], IndiceCorrecaoRef[g.indiceCorrecaoCodigo] || 'Outro'),
    'Outro'
  );
  g.qtdAtivasEmDia = _parseInteger(_firstValue(g, ['qtdAtivasEmDia', 'qtdAtivas'], 0));
  g.qtdContempladasNoMes = _parseInteger(_firstValue(g, ['qtdContempladasNoMes', 'qtdContempladasMes'], 0));
  g.qtdQuitadas = _parseInteger(_firstValue(g, ['qtdQuitadas', 'quitadas'], 0));
  g.qtdExcluidas = _parseInteger(_firstValue(g, ['qtdExcluidas', 'qtdCanceladas', 'excluidas'], 0));
  g.qtdCreditoPendente = _parseInteger(_firstValue(g, ['qtdCreditoPendente', 'creditoPendente'], 0));
  g.taxaInadimplencia = _parseRatio(_firstValue(g, ['taxaInadimplencia', 'inadimplenciaPct'], 0));
  g.indiceMaturidade = indiceMaturidade;
  g.contemplacoesRelativasPct = _parseNumber(_firstValue(g, ['contemplacoesRelativasPct'], 0));
  g.lanceEmbutidoMaxPct = _parseNumber(_firstValue(g, ['lanceEmbutidoMaxPct'], 30), 30);
  g.lanceFixoPct = _parseNumber(_firstValue(g, ['lanceFixoPct'], 20), 20);
  g.parcelaReduzidaDisponivel = _parseBoolean(_firstValue(g, ['parcelaReduzidaDisponivel'], true), true);
  g.reducaoMaxParcelaPct = _parseNumber(_firstValue(g, ['reducaoMaxParcelaPct'], 30), 30);
  g.seguroPctComercial = _parseNumber(_firstValue(g, ['seguroPctComercial'], 0));
  g.fgtsPermitido = _parseBoolean(_firstValue(g, ['fgtsPermitido'], codigoSegmento === 1), codigoSegmento === 1);
  g.statusComercial = _asText(_firstValue(g, ['statusComercial'], 'ativo'), 'ativo');
  g.dataBase = dataBase;

  if (!g.groupKey) {
    const adminKey = cnpjRaiz || _asText(g.nomeAdministradora, 'ADMIN');
    g.groupKey = `${adminKey}|${dataBase || 'sem-data'}|${codigoSegmento || 'sem-segmento'}|${codigoGrupo}`;
  }
  g.idGrupo = _asText(_firstValue(g, ['idGrupo'], g.groupKey), g.groupKey);

  return g;
}

function enrichGroup(g, index = 0) {
  g = _normalizeGroup(g, index);
  // Garantir campos de segmento
  if (!g.nomeSegmento) {
    g.nomeSegmento = SegmentosRef[g.codigoSegmento]?.nome || 'Desconhecido';
  }
  if (!g.macroCategoria) {
    g.macroCategoria = SegmentosRef[g.codigoSegmento]?.macro || 'outros';
  }
  if (!g.iconSegmento) {
    g.iconSegmento = SegmentosRef[g.codigoSegmento]?.icon || '📦';
  }

  // Garantir groupKey
  if (!g.groupKey) {
    g.groupKey = `${g.cnpjRaiz || ''}|${g.dataBase || ''}|${g.codigoSegmento || ''}|${g.codigoGrupo || ''}`;
  }

  // Garantir campo de contemplações relativas
  if (g.contemplacoesRelativasPct == null) {
    g.contemplacoesRelativasPct = g.qtdAtivasEmDia > 0
      ? ((g.qtdContempladasNoMes / g.qtdAtivasEmDia) * 100)
      : 0;
  }

  // Garantir campos comerciais padrão (a base real não traz, usa defaults)
  if (g.lanceEmbutidoMaxPct == null) g.lanceEmbutidoMaxPct = 30;
  if (g.lanceFixoPct == null) g.lanceFixoPct = 20;
  if (g.parcelaReduzidaDisponivel == null) g.parcelaReduzidaDisponivel = true;
  if (g.reducaoMaxParcelaPct == null) g.reducaoMaxParcelaPct = 30;
  if (g.seguroPctComercial == null) g.seguroPctComercial = 0;
  if (g.fgtsPermitido == null) g.fgtsPermitido = (g.codigoSegmento === 1);
  if (g.statusComercial == null) g.statusComercial = 'ativo';
  if (g.fundoReservaPct == null) g.fundoReservaPct = 2;
  if (g.origem == null) g.origem = (g.codigoSegmento === 1) ? 'imoveis' : 'moveis';

  // Garantir nome da administradora (fallback via CNPJ se JSON antigo sem o campo)
  if (!g.nomeAdministradora && g.cnpjRaiz) {
    // Tenta usar nome já mapeado por outro grupo do mesmo CNPJ
    if (NomeAdministradoraRef[g.cnpjRaiz]) {
      g.nomeAdministradora = NomeAdministradoraRef[g.cnpjRaiz];
    } else {
      // Fallback com mapa de CNPJs conhecidos (principais do mercado)
      g.nomeAdministradora = _cnpjFallbackMap[g.cnpjRaiz] || `Administradora ${g.cnpjRaiz}`;
    }
  }
  if (g.nomeAdministradora) {
    NomeAdministradoraRef[g.cnpjRaiz] = g.nomeAdministradora;
  }

  return g;
}

/**
 * Carrega a base real de grupos do JSON.
 * @param {string} jsonPath - Caminho relativo ao JSON
 * @returns {Promise<number>} - Quantidade de grupos carregados
 */
async function loadRealDatabase(jsonPath) {
  try {
    _shelfDataSource = 'loading';
    _shelfDataError = null;
    _shelfDataStats = {
      total: 0,
      valid: 0,
      path: jsonPath || '',
      loadedAt: null
    };

    if (typeof fetch !== 'function') {
      throw new Error('fetch indisponivel neste ambiente');
    }

    const response = await fetch(jsonPath);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error('Formato invalido: a base de grupos precisa ser um array');
    }

    // Filtrar apenas grupos ativos com dados mínimos válidos
    const validGroups = data.filter(g =>
      g &&
      Number(g.valorCartaRef) > 0 &&
      Number(g.prazoMeses) > 0 &&
      Number(g.qtdAtivasEmDia) >= 0
    );

    // Enriquecer cada grupo
    ShelfCatalog = validGroups.map(enrichGroup);

    _shelfDataLoaded = true;
    _shelfDataError = null;
    _shelfDataSource = 'real-json';
    _shelfDataStats = {
      total: data.length,
      valid: validGroups.length,
      path: jsonPath || '',
      loadedAt: new Date().toISOString()
    };

    console.log(`✅ Base real carregada: ${ShelfCatalog.length} grupos válidos de ${data.length} totais`);
    return ShelfCatalog.length;
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    console.warn(`Base real nao carregada (${message}).`);
    return _applyFallbackCatalog(message);
    console.error('❌ Erro ao carregar base real:', err);
    _shelfDataError = err.message;

    // Fallback para catálogo simulado se existir
    if (ShelfCatalog.length === 0) {
      ShelfCatalog = _getSimulatedCatalog().map(enrichGroup);
      console.warn(`⚠️ Usando catálogo simulado com ${ShelfCatalog.length} grupos`);
    }

    return ShelfCatalog.length;
  }
}

/**
 * Retorna o catálogo simulado como fallback.
 * Mantido para desenvolvimento offline.
 */
function _getSimulatedCatalog() {
  return [
    { dataBase: 202512, cnpjRaiz: '00000776', nomeAdministradora: 'ITAÚ ADM DE CONSÓRCIOS LTDA', codigoGrupo: '57', codigoSegmento: 1, valorCartaRef: 248543.52, taxaAdmPct: 20.61, prazoMeses: 200, indiceCorrecaoCodigo: 3, indiceCorrecaoNome: 'IGP-M', qtdAtivasEmDia: 709, qtdContempladasNoMes: 5, qtdExcluidas: 23, qtdQuitadas: 112, qtdCreditoPendente: 8 },
    { dataBase: 202512, cnpjRaiz: '00000776', nomeAdministradora: 'ITAÚ ADM DE CONSÓRCIOS LTDA', codigoGrupo: '102', codigoSegmento: 1, valorCartaRef: 350000.00, taxaAdmPct: 18.50, prazoMeses: 180, indiceCorrecaoCodigo: 1, indiceCorrecaoNome: 'INCC', qtdAtivasEmDia: 520, qtdContempladasNoMes: 8, qtdExcluidas: 15, qtdQuitadas: 85, qtdCreditoPendente: 3 },
    { dataBase: 202512, cnpjRaiz: '60746948', nomeAdministradora: 'BRADESCO ADM DE CONSÓRCIOS LTDA', codigoGrupo: '215', codigoSegmento: 1, valorCartaRef: 180000.00, taxaAdmPct: 16.99, prazoMeses: 150, indiceCorrecaoCodigo: 1, indiceCorrecaoNome: 'INCC', qtdAtivasEmDia: 890, qtdContempladasNoMes: 12, qtdExcluidas: 30, qtdQuitadas: 200, qtdCreditoPendente: 5 },
    { dataBase: 202512, cnpjRaiz: '61855045', nomeAdministradora: 'PORTO SEGURO CONSÓRCIOS', codigoGrupo: '88', codigoSegmento: 1, valorCartaRef: 220000.00, taxaAdmPct: 17.50, prazoMeses: 180, indiceCorrecaoCodigo: 1, indiceCorrecaoNome: 'INCC', qtdAtivasEmDia: 650, qtdContempladasNoMes: 7, qtdExcluidas: 18, qtdQuitadas: 130, qtdCreditoPendente: 4 },
    { dataBase: 202512, cnpjRaiz: '00360305', nomeAdministradora: 'CAIXA CONSÓRCIOS', codigoGrupo: '33', codigoSegmento: 1, valorCartaRef: 200000.00, taxaAdmPct: 15.50, prazoMeses: 180, indiceCorrecaoCodigo: 1, indiceCorrecaoNome: 'INCC', qtdAtivasEmDia: 1500, qtdContempladasNoMes: 20, qtdExcluidas: 60, qtdQuitadas: 500, qtdCreditoPendente: 15 },
    { dataBase: 202512, cnpjRaiz: '00000776', nomeAdministradora: 'ITAÚ ADM DE CONSÓRCIOS LTDA', codigoGrupo: '1200', codigoSegmento: 3, valorCartaRef: 65000.00, taxaAdmPct: 17.50, prazoMeses: 72, indiceCorrecaoCodigo: 4, indiceCorrecaoNome: 'FIPE', qtdAtivasEmDia: 450, qtdContempladasNoMes: 10, qtdExcluidas: 20, qtdQuitadas: 100, qtdCreditoPendente: 5 },
    { dataBase: 202512, cnpjRaiz: '49925225', nomeAdministradora: 'VOLKSWAGEN CONSÓRCIO', codigoGrupo: '500', codigoSegmento: 3, valorCartaRef: 85000.00, taxaAdmPct: 15.99, prazoMeses: 72, indiceCorrecaoCodigo: 4, indiceCorrecaoNome: 'FIPE', qtdAtivasEmDia: 900, qtdContempladasNoMes: 18, qtdExcluidas: 25, qtdQuitadas: 250, qtdCreditoPendente: 7 },
    { dataBase: 202512, cnpjRaiz: '73178600', nomeAdministradora: 'EMBRACON ADM DE CONSÓRCIOS LTDA', codigoGrupo: '4400', codigoSegmento: 4, valorCartaRef: 18000.00, taxaAdmPct: 20.00, prazoMeses: 60, indiceCorrecaoCodigo: 4, indiceCorrecaoNome: 'FIPE', qtdAtivasEmDia: 200, qtdContempladasNoMes: 5, qtdExcluidas: 8, qtdQuitadas: 40, qtdCreditoPendente: 1 },
    { dataBase: 202512, cnpjRaiz: '89437043', nomeAdministradora: 'RANDON CONSÓRCIO', codigoGrupo: '60', codigoSegmento: 2, valorCartaRef: 320000.00, taxaAdmPct: 14.00, prazoMeses: 120, indiceCorrecaoCodigo: 2, indiceCorrecaoNome: 'IPCA', qtdAtivasEmDia: 180, qtdContempladasNoMes: 3, qtdExcluidas: 4, qtdQuitadas: 25, qtdCreditoPendente: 1 },
    { dataBase: 202512, cnpjRaiz: '07318435', nomeAdministradora: 'MAGALU CONSÓRCIO', codigoGrupo: '800', codigoSegmento: 6, valorCartaRef: 12000.00, taxaAdmPct: 22.00, prazoMeses: 36, indiceCorrecaoCodigo: 2, indiceCorrecaoNome: 'IPCA', qtdAtivasEmDia: 500, qtdContempladasNoMes: 15, qtdExcluidas: 30, qtdQuitadas: 200, qtdCreditoPendente: 5 }
  ];
}

/**
 * Verifica se a base foi carregada com sucesso.
 */
function isShelfDataLoaded() {
  return _shelfDataLoaded;
}

function getShelfDataError() {
  return _shelfDataError;
}

function getShelfDataStatus() {
  return {
    loaded: _shelfDataLoaded,
    error: _shelfDataError,
    source: _shelfDataSource,
    count: Array.isArray(ShelfCatalog) ? ShelfCatalog.length : 0,
    stats: { ..._shelfDataStats }
  };
}
