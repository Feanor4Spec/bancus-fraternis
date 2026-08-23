/**
 * ============================================
 * ConsórcioPro V7 - Motor de Análise Heurística
 * ============================================
 * Implementa as 6 Diretrizes de Qualidade do
 * DIRETRIZES_ANALISE_GRUPOS.md para classificação
 * executiva, tipificação de papel e sinopse.
 * ============================================
 */

const HeuristicEngine = (() => {
  'use strict';

  let _warnedAnalysisFallback = false;

  function _safeNumber(value, fallback = 0) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
    if (value == null || value === '') return fallback;

    const raw = String(value).trim();
    if (!raw) return fallback;

    const cleaned = raw.replace(/[^\d,.-]/g, '');
    if (!cleaned) return fallback;

    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    let normalized = cleaned;

    if (lastComma > lastDot) {
      normalized = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (lastDot > lastComma) {
      normalized = cleaned.replace(/,/g, '');
    } else {
      normalized = cleaned.replace(',', '.');
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function _safeRatio(value, fallback = 0) {
    const n = _safeNumber(value, fallback);
    return n > 1 ? n / 100 : n;
  }

  function _safeDiv(numerator, denominator) {
    const den = _safeNumber(denominator, 0);
    if (den <= 0) return 0;
    const num = _safeNumber(numerator, 0);
    return num / den;
  }

  function _buildFallbackAnalysis(g, error) {
    if (!_warnedAnalysisFallback && typeof console !== 'undefined' && console.warn) {
      console.warn(`HeuristicEngine fallback aplicado: ${error && error.message ? error.message : error}`);
      _warnedAnalysisFallback = true;
    }

    const metricas = {
      ativasMonitoradas: _safeNumber(g && g.qtdAtivasEmDia, 0),
      taxaInadimplencia: _safeRatio(g && g.taxaInadimplencia, 0),
      // Maturidade e uma razao operacional (assembleias/prazo), nao uma taxa.
      // Valores acima de 1 sao validos e nao devem ser divididos por 100.
      indiceMaturidade: _safeNumber(g && g.indiceMaturidade, 0),
      taxaQuitacao: 0,
      taxaCreditoPendente: 0,
      intensidadeExclusao: 0,
      taxaContemplacao: 0
    };

    const classificacoes = {
      porte: classificarPorte(metricas.ativasMonitoradas),
      maturidade: classificarMaturidade(metricas.indiceMaturidade),
      saude: classificarSaude(metricas.taxaInadimplencia),
      ticket: classificarTicket(g && g.valorCartaRef),
      ociosidade: classificarOciosidade(0),
      pressaoExclusao: classificarPressaoExclusao(0),
      dinamismo: classificarDinamismo(0),
      classificacaoFinal: { classe: 'C - Recuperação', cor: '#f59e0b', icon: 'C', nivel: 3, letra: 'C' }
    };

    const papel = {
      papel: 'Complemento',
      tag: 'CO',
      cor: '#2563eb',
      justificativa: 'Grupo mantido em análise neutra por indisponibilidade parcial de dados.'
    };

    return {
      metricas,
      classificacoes,
      papel,
      sinopse: [
        `${g && g.nomeAdministradora ? g.nomeAdministradora : 'Administradora não informada'} — Grupo ${g && g.codigoGrupo ? g.codigoGrupo : 'sem código'}`,
        'Análise gerada com fallback seguro. Revise os dados do grupo antes de uma recomendação executiva.',
        `Classificação: **${classificacoes.classificacaoFinal.classe}** → Papel: ${papel.tag} **${papel.papel}**`
      ]
    };
  }

  // ══════════════════════════════════════════
  // BLOCO B — MÉTRICAS DERIVADAS
  // ══════════════════════════════════════════

  /**
   * Calcula Ativas Monitoradas (estoque vivo).
   * Em_dia + Contempladas inadimplentes + Não contempladas inadimplentes.
   * Na base simplificada, usamos qtdAtivasEmDia como proxy.
   */
  function calcularAtivasMonitoradas(g) {
    return _safeNumber(g && g.qtdAtivasEmDia, 0) +
      _safeNumber(g && g.qtdContempladasInadimplentes, 0) +
      _safeNumber(g && g.qtdNaoContempladasInadimplentes, 0);
  }

  /**
   * Taxa de Inadimplência.
   * Já vem pré-calculada no JSON como `taxaInadimplencia`.
   * Se não existir, retorna 0.
   */
  function getTaxaInadimplencia(g) {
    const direct = _safeRatio(g && g.taxaInadimplencia, 0);
    if (direct > 0) return direct;

    const inadimplentes = _safeNumber(g && g.qtdContempladasInadimplentes, 0) +
      _safeNumber(g && g.qtdNaoContempladasInadimplentes, 0);
    return _safeDiv(inadimplentes, calcularAtivasMonitoradas(g));
  }

  /**
   * Índice de Maturidade = Assembleias / Prazo.
   * Já vem pré-calculado no JSON como `indiceMaturidade`.
   */
  function getIndiceMaturidade(g) {
    const normalized = _safeNumber(g && g.indiceMaturidade, 0);
    if (normalized > 0) return normalized;
    return _safeDiv(g && g.assembleias, g && g.prazoMeses);
  }

  /**
   * Taxa de Quitação = Quitadas / Ativas Monitoradas.
   */
  function calcularTaxaQuitacao(g) {
    const ativas = calcularAtivasMonitoradas(g);
    return _safeDiv(g && g.qtdQuitadas, ativas);
  }

  /**
   * Taxa de Crédito Pendente = Crédito Pendente / Ativas Monitoradas.
   */
  function calcularTaxaCreditoPendente(g) {
    const ativas = calcularAtivasMonitoradas(g);
    return _safeDiv(g && g.qtdCreditoPendente, ativas);
  }

  /**
   * Intensidade Histórica de Exclusão = Excluídas / Ativas Monitoradas.
   * ATENÇÃO: Pode ser > 100%. Não é taxa mensal, é pressão acumulada.
   */
  function calcularIntensidadeExclusao(g) {
    const ativas = calcularAtivasMonitoradas(g);
    return _safeDiv(g && g.qtdExcluidas, ativas);
  }

  /**
   * Taxa de Contemplação do Mês = Contempladas / Ativas Monitoradas.
   */
  function calcularTaxaContemplacao(g) {
    const ativas = calcularAtivasMonitoradas(g);
    return _safeDiv(g && g.qtdContempladasNoMes, ativas);
  }

  /**
   * Calcula todas as métricas derivadas de uma vez.
   */
  function calcularMetricas(g) {
    return {
      ativasMonitoradas: calcularAtivasMonitoradas(g),
      taxaInadimplencia: getTaxaInadimplencia(g),
      indiceMaturidade: getIndiceMaturidade(g),
      taxaQuitacao: calcularTaxaQuitacao(g),
      taxaCreditoPendente: calcularTaxaCreditoPendente(g),
      intensidadeExclusao: calcularIntensidadeExclusao(g),
      taxaContemplacao: calcularTaxaContemplacao(g)
    };
  }

  // ══════════════════════════════════════════
  // BLOCO C — CLASSIFICAÇÕES EXECUTIVAS
  // ══════════════════════════════════════════

  /**
   * Porte Operacional do Grupo.
   * @param {number} ativas - Ativas monitoradas
   */
  function classificarPorte(ativas) {
    if (ativas >= 1000) return { classe: 'Muito Grande', cor: '#059669', icon: 'MG', nivel: 4 };
    if (ativas >= 500)  return { classe: 'Grande',       cor: '#2563eb', icon: 'GR', nivel: 3 };
    if (ativas >= 200)  return { classe: 'Médio',        cor: '#f59e0b', icon: 'MD', nivel: 2 };
    return { classe: 'Pequeno', cor: '#94a3b8', icon: 'PQ', nivel: 1 };
  }

  /**
   * Maturidade do Grupo.
   * @param {number} indiceMaturidade - Assembleias / Prazo
   */
  function classificarMaturidade(indiceMaturidade) {
    if (indiceMaturidade > 0.90)  return { classe: 'Final',       cor: '#dc2626', icon: 'FI', nivel: 4 };
    if (indiceMaturidade > 0.60)  return { classe: 'Maturação',   cor: '#059669', icon: 'MA', nivel: 3 };
    if (indiceMaturidade >= 0.25) return { classe: 'Crescimento',  cor: '#2563eb', icon: 'CR', nivel: 2 };
    return { classe: 'Início', cor: '#f59e0b', icon: 'IN', nivel: 1 };
  }

  /**
   * Saúde da Carteira do Grupo.
   * @param {number} taxaInadimplencia
   */
  function classificarSaude(taxaInadimplencia) {
    if (taxaInadimplencia >= 0.15) return { classe: 'Crítica',     cor: '#dc2626', icon: 'CR', nivel: 4 };
    if (taxaInadimplencia >= 0.10) return { classe: 'Atenção',     cor: '#f59e0b', icon: 'AT', nivel: 3 };
    if (taxaInadimplencia >= 0.05) return { classe: 'Controlada',  cor: '#2563eb', icon: 'CO', nivel: 2 };
    return { classe: 'Baixa', cor: '#059669', icon: 'OK', nivel: 1 };
  }

  /**
   * Ticket do Grupo.
   * @param {number} valorCarta
   */
  function classificarTicket(valorCarta) {
    if (valorCarta >= 300000)  return { classe: 'Premium',      cor: '#7c3aed', icon: 'PR', nivel: 4 };
    if (valorCarta >= 150000)  return { classe: 'Ticket Alto',   cor: '#2563eb', icon: 'AL', nivel: 3 };
    if (valorCarta >= 50000)   return { classe: 'Ticket Médio',  cor: '#f59e0b', icon: 'MD', nivel: 2 };
    return { classe: 'Baixo Ticket', cor: '#94a3b8', icon: 'BX', nivel: 1 };
  }

  /**
   * Ociosidade do Crédito Contemplado.
   * @param {number} taxaCreditoPendente
   */
  function classificarOciosidade(taxaCreditoPendente) {
    if (taxaCreditoPendente >= 0.15) return { classe: 'Alta Ociosidade', cor: '#dc2626', icon: 'AL', nivel: 4 };
    if (taxaCreditoPendente >= 0.08) return { classe: 'Atenção',         cor: '#f59e0b', icon: 'AT', nivel: 3 };
    if (taxaCreditoPendente >= 0.03) return { classe: 'Normal',          cor: '#2563eb', icon: 'NO', nivel: 2 };
    return { classe: 'Baixa Ociosidade', cor: '#059669', icon: 'OK', nivel: 1 };
  }

  /**
   * Pressão Histórica de Exclusão.
   * @param {number} intensidadeExclusao
   */
  function classificarPressaoExclusao(intensidadeExclusao) {
    if (intensidadeExclusao >= 1.0)  return { classe: 'Crítica',   cor: '#dc2626', icon: 'CR', nivel: 4 };
    if (intensidadeExclusao >= 0.5)  return { classe: 'Alta',      cor: '#f59e0b', icon: 'AL', nivel: 3 };
    if (intensidadeExclusao >= 0.2)  return { classe: 'Moderada',  cor: '#2563eb', icon: 'MO', nivel: 2 };
    return { classe: 'Baixa', cor: '#059669', icon: 'OK', nivel: 1 };
  }

  /**
   * Dinamismo Recente de Contemplação.
   * @param {number} taxaContemplacao
   */
  function classificarDinamismo(taxaContemplacao) {
    if (taxaContemplacao >= 0.03) return { classe: 'Forte',   cor: '#059669', icon: 'FO', nivel: 4 };
    if (taxaContemplacao >= 0.015) return { classe: 'Bom',    cor: '#2563eb', icon: 'BO', nivel: 3 };
    if (taxaContemplacao >= 0.005) return { classe: 'Normal', cor: '#f59e0b', icon: 'NO', nivel: 2 };
    return { classe: 'Baixo Dinamismo', cor: '#94a3b8', icon: 'BD', nivel: 1 };
  }

  /**
   * Classificação Executiva Final.
   * Se já vem pré-calculada do JSON, usa. Senão, calcula.
   */
  function classificacaoFinal(g, metricas) {
    // Se já tem classificação do JSON, usar
    if (g.classificacaoExecutiva) {
      const map = {
        'A - Expansão':     { classe: 'A - Expansão',     cor: '#059669', icon: 'A', nivel: 1, letra: 'A' },
        'B - Sustentação':  { classe: 'B - Sustentação',  cor: '#2563eb', icon: 'B', nivel: 2, letra: 'B' },
        'C - Recuperação':  { classe: 'C - Recuperação',  cor: '#f59e0b', icon: 'C', nivel: 3, letra: 'C' },
        'D - Crítico':      { classe: 'D - Crítico',      cor: '#dc2626', icon: 'D', nivel: 4, letra: 'D' }
      };
      return map[g.classificacaoExecutiva] || map['C - Recuperação'];
    }

    // Cálculo dinâmico baseado em métricas
    const saude = classificarSaude(metricas.taxaInadimplencia);
    const pressao = classificarPressaoExclusao(metricas.intensidadeExclusao);
    const dinamismo = classificarDinamismo(metricas.taxaContemplacao);

    // Score de risco (quanto maior, mais problemático)
    let riskScore = 0;
    riskScore += saude.nivel >= 4 ? 3 : (saude.nivel >= 3 ? 1 : 0);
    riskScore += pressao.nivel >= 4 ? 3 : (pressao.nivel >= 3 ? 1 : 0);
    riskScore -= dinamismo.nivel >= 3 ? 1 : 0;

    if (riskScore >= 4) return { classe: 'D - Crítico',     cor: '#dc2626', icon: 'D', nivel: 4, letra: 'D' };
    if (riskScore >= 2) return { classe: 'C - Recuperação',  cor: '#f59e0b', icon: 'C', nivel: 3, letra: 'C' };
    if (riskScore >= 1) return { classe: 'B - Sustentação',  cor: '#2563eb', icon: 'B', nivel: 2, letra: 'B' };
    return { classe: 'A - Expansão', cor: '#059669', icon: 'A', nivel: 1, letra: 'A' };
  }

  // ══════════════════════════════════════════
  // TIPIFICAÇÃO DE PAPEL NA PROPOSTA
  // ══════════════════════════════════════════

  /**
   * Classifica o papel do grupo dentro de uma proposta estruturada.
   * Retorna: { papel, tag, cor, justificativa }
   */
  function tipificarPapel(g, classificacao, metricas, classificacoes) {
    const letra = classificacao.letra || classificacao.classe.charAt(0);
    const porte = classificacoes.porte;
    const saude = classificacoes.saude;
    const maturidade = classificacoes.maturidade;

    // Âncora: A ou B + porte grande+ + saúde boa + crescimento/maturação
    if ((letra === 'A' || letra === 'B') &&
        porte.nivel >= 3 &&
        saude.nivel <= 2 &&
        (maturidade.nivel === 2 || maturidade.nivel === 3)) {
      return {
        papel: 'Âncora', tag: 'AN', cor: '#059669',
        justificativa: `Grupo saudável (${saude.classe}), porte ${porte.classe.toLowerCase()}, fase ${maturidade.classe.toLowerCase()}. Base principal da proposta.`
      };
    }

    // Cautela: D ou saúde/exclusão crítica
    if (letra === 'D' || saude.nivel >= 4 || classificacoes.pressaoExclusao.nivel >= 4) {
      return {
        papel: 'Cautela', tag: 'CA', cor: '#dc2626',
        justificativa: `Grupo com sinais de risco: ${saude.classe === 'Crítica' ? 'saúde crítica' : 'pressão histórica elevada'}. Entrada somente com análise manual.`
      };
    }

    // ⚡ Oportunidade: C + ticket interessante ou fase final
    if (letra === 'C' && (maturidade.nivel >= 3 || classificacoes.ticket.nivel >= 3)) {
      return {
        papel: 'Oportunidade', tag: 'OP', cor: '#f59e0b',
        justificativa: `Grupo em recuperação com ${maturidade.nivel >= 3 ? 'maturidade avançada' : 'ticket atrativo'}. Potencial com análise técnica.`
      };
    }

    // Complemento: padrão
    return {
      papel: 'Complemento', tag: 'CO', cor: '#2563eb',
      justificativa: `Grupo equilibrado, adequado para complementar volume, prazo ou composição da proposta.`
    };
  }

  // ══════════════════════════════════════════
  // SINOPSE AUTOMÁTICA
  // ══════════════════════════════════════════

  /**
   * Gera array de bullets descritivos para o grupo.
   */
  function gerarSinopse(g, metricas, classificacoes, papel) {
    const bullets = [];
    const fmt = (v) => (v * 100).toFixed(1) + '%';
    const carta = _safeNumber(g && g.valorCartaRef, 0);
    const prazo = _safeNumber(g && g.prazoMeses, 0);
    const taxaAdm = _safeNumber(g && g.taxaAdmPct, 0);
    const contempladasMes = _safeNumber(g && g.qtdContempladasNoMes, 0);
    const excluidas = _safeNumber(g && g.qtdExcluidas, 0);
    const creditoPendente = _safeNumber(g && g.qtdCreditoPendente, 0);

    // 1. Identidade
    bullets.push(`**${g.nomeAdministradora || 'Administradora não informada'}** — Grupo ${g.codigoGrupo || 'sem código'} (${g.nomeSegmento || 'Segmento não informado'})`);

    // 2. Porte e escala
    bullets.push(`${classificacoes.porte.icon} Porte **${classificacoes.porte.classe}** com ${metricas.ativasMonitoradas.toLocaleString('pt-BR')} cotas ativas`);

    // 3. Ticket
    bullets.push(`${classificacoes.ticket.icon} Ticket **${classificacoes.ticket.classe}**: R$ ${carta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | Prazo ${prazo}m | Taxa ${taxaAdm.toFixed(2)}%`);

    // 4. Saúde
    const saudeBullet = classificacoes.saude.nivel >= 3
      ? `${classificacoes.saude.icon} Atenção: saúde **${classificacoes.saude.classe}** — inadimplência de ${fmt(metricas.taxaInadimplencia)}`
      : `${classificacoes.saude.icon} Saúde **${classificacoes.saude.classe}** — inadimplência de ${fmt(metricas.taxaInadimplencia)}`;
    bullets.push(saudeBullet);

    // 5. Maturidade
    bullets.push(`${classificacoes.maturidade.icon} Fase **${classificacoes.maturidade.classe}** — índice de maturidade: ${fmt(metricas.indiceMaturidade)}`);

    // 6. Dinamismo
    if (contempladasMes > 0) {
      bullets.push(`${classificacoes.dinamismo.icon} **${contempladasMes}** contemplações no mês — dinamismo: ${classificacoes.dinamismo.classe}`);
    } else {
      bullets.push(`${classificacoes.dinamismo.icon} Sem contemplações recentes — dinamismo: ${classificacoes.dinamismo.classe}`);
    }

    // 7. Pressão de exclusão (se relevante)
    if (classificacoes.pressaoExclusao.nivel >= 3) {
      bullets.push(`**Alerta:** Pressão de exclusão ${classificacoes.pressaoExclusao.classe.toLowerCase()} — ${excluidas} cotas excluídas (${fmt(metricas.intensidadeExclusao)} do ativo)`);
    }

    // 8. Ociosidade (se relevante)
    if (classificacoes.ociosidade.nivel >= 3) {
      bullets.push(`Atenção à ociosidade de crédito: ${classificacoes.ociosidade.classe} — ${creditoPendente} cotas com crédito pendente`);
    }

    // 9. Classificação e papel
    bullets.push(`Classificação: **${classificacoes.classificacaoFinal.classe}** → Papel: ${papel.tag} **${papel.papel}**`);
    bullets.push(`${papel.justificativa}`);

    return bullets;
  }

  // ══════════════════════════════════════════
  // ANÁLISE COMPLETA DE UM GRUPO
  // ══════════════════════════════════════════

  /**
   * Executa análise heurística completa em um grupo.
   * Retorna objeto com todas as métricas, classificações, papel e sinopse.
   */
  function analisar(g) {
    try {
      if (!g || typeof g !== 'object') {
        throw new Error('grupo inválido para análise heurística');
      }

      const metricas = calcularMetricas(g);

      const classificacoes = {
        porte: classificarPorte(metricas.ativasMonitoradas),
        maturidade: classificarMaturidade(metricas.indiceMaturidade),
        saude: classificarSaude(metricas.taxaInadimplencia),
        ticket: classificarTicket(_safeNumber(g.valorCartaRef, 0)),
        ociosidade: classificarOciosidade(metricas.taxaCreditoPendente),
        pressaoExclusao: classificarPressaoExclusao(metricas.intensidadeExclusao),
        dinamismo: classificarDinamismo(metricas.taxaContemplacao),
        classificacaoFinal: null // preenchido abaixo
      };

      classificacoes.classificacaoFinal = classificacaoFinal(g, metricas);

      const papel = tipificarPapel(g, classificacoes.classificacaoFinal, metricas, classificacoes);
      const sinopse = gerarSinopse(g, metricas, classificacoes, papel);

      return {
        metricas,
        classificacoes,
        papel,
        sinopse
      };
    } catch (error) {
      return _buildFallbackAnalysis(g || {}, error);
    }
  }

  /**
   * Enriquece um grupo in-place com os resultados da análise heurística.
   * Adiciona campos: _heuristica, _classificacao, _papel, _sinopse
   */
  function enriquecerGrupo(g, force = false) {
    if (!g || typeof g !== 'object') return g;
    if (!force && g._heuristica && g._classificacao && g._papel && g._sinopse) {
      return g;
    }

    const analise = analisar(g);
    g._heuristica = analise;
    g._classificacao = analise.classificacoes.classificacaoFinal;
    g._papel = analise.papel;
    g._sinopse = analise.sinopse;
    if (!g.classificacaoExecutiva) g.classificacaoExecutiva = g._classificacao.classe;
    if (!g.saudeCarteira) g.saudeCarteira = analise.classificacoes.saude.classe;
    return g;
  }

  /**
   * Enriquece todos os grupos de um catálogo.
   */
  function enriquecerCatalogo(catalog, options = {}) {
    if (!Array.isArray(catalog)) return [];
    const force = options === true || Boolean(options.force);
    catalog.forEach(g => enriquecerGrupo(g, force));
    return catalog;
  }

  // ─── API Pública ───
  return {
    // Métricas
    calcularMetricas,
    calcularAtivasMonitoradas,
    getTaxaInadimplencia,
    getIndiceMaturidade,
    calcularTaxaQuitacao,
    calcularTaxaCreditoPendente,
    calcularIntensidadeExclusao,
    calcularTaxaContemplacao,

    // Classificações
    classificarPorte,
    classificarMaturidade,
    classificarSaude,
    classificarTicket,
    classificarOciosidade,
    classificarPressaoExclusao,
    classificarDinamismo,
    classificacaoFinal,

    // Tipificação e sinopse
    tipificarPapel,
    gerarSinopse,

    // Análise completa
    analisar,
    enriquecerGrupo,
    enriquecerCatalogo
  };
})();
