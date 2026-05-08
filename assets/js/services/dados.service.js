(function () {
  'use strict';

  const cache = {};
  const fallback = {
    produtos: [
      { id: 'consorcio', nome: 'Consorcio', categoria: 'Planejamento', objetivo: 'Compra planejada por carta de credito.', prazoMin: 36, prazoMax: 240, garantia: 'Bem apos contemplacao', urgencia: 'Baixa', riscos: ['Contemplacao nao imediata', 'Reajuste de parcelas'], criterios: ['Carta', 'Lance', 'Assembleia'] },
      { id: 'financiamento', nome: 'Financiamento', categoria: 'Credito parcelado', objetivo: 'Compra com posse imediata e juros.', prazoMin: 12, prazoMax: 420, garantia: 'Alienacao fiduciaria', urgencia: 'Alta', riscos: ['Juros compostos', 'CET'], criterios: ['Entrada', 'Taxa', 'Prazo'] },
      { id: 'cdc', nome: 'CDC', categoria: 'Credito direto', objetivo: 'Emprestimo com parcela fixa e custo total.', prazoMin: 3, prazoMax: 84, garantia: 'Variavel', urgencia: 'Alta', riscos: ['Taxa mensal elevada', 'Tarifas'], criterios: ['Taxa', 'Tarifas', 'CET'] }
    ],
    glossario: [
      { termo: 'Carta de credito', categoria: 'Consorcio', definicao: 'Valor contratado para aquisicao do bem ou servico.' },
      { termo: 'CET', categoria: 'Credito', definicao: 'Custo efetivo total com juros, tarifas e impostos.' },
      { termo: 'Tabela Price', categoria: 'Financiamento', definicao: 'Sistema de parcela fixa ao longo do contrato.' }
    ],
    indices: [],
    calculadoras: [],
    'calculadoras-premissas': {},
    'calculadoras-golden-tests': [],
    'modelos-comparador-padrao': [],
    instituicoes: [],
    formulas: [],
    'regras-negocio': {}
  };

  function root() {
    return location.pathname.includes('/pages/') ? '../' : '';
  }

  async function json(name) {
    const path = `${root()}assets/data/${name}.json`;
    if (cache[path]) return cache[path];
    try {
      const response = await fetch(path);
      if (!response.ok) throw new Error(`Nao foi possivel carregar ${path}`);
      cache[path] = await response.json();
    } catch (error) {
      cache[path] = fallback[name] || [];
      console.warn(`[BFDadosService] usando fallback para ${name}: ${error && error.message ? error.message : error}`);
    }
    return cache[path];
  }

  async function all() {
    const [produtos, glossario, indices, calculadoras, premissas, goldenTests, modelosComparadorPadrao, instituicoes, formulas, regras] = await Promise.all([
      json('produtos'),
      json('glossario'),
      json('indices'),
      json('calculadoras'),
      json('calculadoras-premissas'),
      json('calculadoras-golden-tests'),
      json('modelos-comparador-padrao'),
      json('instituicoes'),
      json('formulas'),
      json('regras-negocio')
    ]);
    return { produtos, glossario, indices, calculadoras, premissas, goldenTests, modelosComparadorPadrao, instituicoes, formulas, regras };
  }

  window.BFDadosService = { json, all };
})();
