/**
 * ============================================
 * ConsórcioPro - Gerenciador de Gráficos
 * ============================================
 * Integração com Chart.js para visualização
 * de dados financeiros do consórcio.
 * ============================================
 */

const ChartManager = (() => {
  'use strict';

  // Armazena instâncias de charts para destruir antes de recriar
  const instances = {};

  // Cores do design system
  const COLORS = {
    primary: '#2563eb',
    primaryLight: '#93c5fd',
    primaryBg: 'rgba(37,99,235,0.1)',
    accent: '#f59e0b',
    accentLight: '#fde68a',
    success: '#10b981',
    successBg: 'rgba(16,185,129,0.1)',
    danger: '#ef4444',
    dangerBg: 'rgba(239,68,68,0.1)',
    purple: '#8b5cf6',
    purpleBg: 'rgba(139,92,246,0.1)',
    gray: '#6b7280',
    grayLight: '#d1d5db',
    white: '#ffffff'
  };

  // Configuração padrão para todos os charts
  const defaultOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          padding: 16,
          font: { family: "'Inter', sans-serif", size: 12, weight: '500' }
        }
      },
      tooltip: {
        backgroundColor: '#1f2937',
        titleFont: { family: "'Inter', sans-serif", size: 13, weight: '600' },
        bodyFont: { family: "'Inter', sans-serif", size: 12 },
        padding: 12,
        cornerRadius: 8,
        displayColors: true,
        callbacks: {
          label: function (ctx) {
            let value = ctx.parsed.y ?? ctx.parsed ?? ctx.raw;
            if (typeof value === 'number') {
              return ` ${ctx.dataset.label || ctx.label}: R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
            }
            return ` ${ctx.dataset.label || ctx.label}: ${value}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(0,0,0,0.04)' },
        ticks: {
          font: { family: "'Inter', sans-serif", size: 11 },
          color: '#6b7280'
        }
      },
      y: {
        grid: { color: 'rgba(0,0,0,0.06)' },
        ticks: {
          font: { family: "'Inter', sans-serif", size: 11 },
          color: '#6b7280',
          callback: function (value) {
            return 'R$ ' + value.toLocaleString('pt-BR', { minimumFractionDigits: 0 });
          }
        }
      }
    }
  };

  /**
   * Destroi um chart existente antes de recriar.
   */
  function destroyChart(id) {
    if (instances[id]) {
      instances[id].destroy();
      delete instances[id];
    }
  }

  /**
   * 1. Composição do Plano (Doughnut)
   */
  function renderComposicaoPlano(canvasId, resumo) {
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    instances[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Carta de Crédito', 'Taxa de Administração', 'Fundo de Reserva', 'Seguro'],
        datasets: [{
          data: [
            resumo.valorCarta,
            resumo.taxaAdmTotal,
            resumo.fundoReservaTotal,
            resumo.seguroTotal
          ],
          backgroundColor: [COLORS.primary, COLORS.accent, COLORS.success, COLORS.purple],
          borderColor: COLORS.white,
          borderWidth: 3,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              usePointStyle: true,
              padding: 16,
              font: { family: "'Inter', sans-serif", size: 12, weight: '500' }
            }
          },
          tooltip: {
            ...defaultOptions.plugins.tooltip,
            callbacks: {
              label: function (ctx) {
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const pct = ((ctx.raw / total) * 100).toFixed(1);
                return ` ${ctx.label}: R$ ${ctx.raw.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${pct}%)`;
              }
            }
          }
        }
      }
    });
  }

  /**
   * 2. Evolução Mensal das Parcelas (Line)
   */
  function renderEvolucaoParcelas(canvasId, cronograma) {
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const labels = cronograma.map(m => `M${m.mes}`);
    const parcelas = cronograma.map(m => m.parcelaTotal);

    instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Parcela Total',
          data: parcelas,
          borderColor: COLORS.primary,
          backgroundColor: COLORS.primaryBg,
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 5,
          borderWidth: 2.5
        }]
      },
      options: {
        ...defaultOptions,
        plugins: {
          ...defaultOptions.plugins,
          annotation: undefined
        }
      }
    });
  }

  /**
   * 3. Evolução do Saldo Devedor (Line)
   */
  function renderEvolucaoSaldo(canvasId, cronograma) {
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const labels = cronograma.map(m => `M${m.mes}`);
    const saldos = cronograma.map(m => m.saldoFinal);

    instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Saldo Devedor',
          data: saldos,
          borderColor: COLORS.danger,
          backgroundColor: COLORS.dangerBg,
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 5,
          borderWidth: 2.5
        }]
      },
      options: defaultOptions
    });
  }

  /**
   * 4. Impacto do Lance sobre o Saldo (Bar)
   */
  function renderImpactoLance(canvasId, resumo) {
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const saldoAntesLance = resumo.saldoInicial;
    const saldoAposLance = Math.max(0, saldoAntesLance - resumo.lanceTotal);

    instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Saldo antes do lance', 'Valor do lance', 'Saldo após o lance'],
        datasets: [{
          label: 'Valores (R$)',
          data: [saldoAntesLance, resumo.lanceTotal, saldoAposLance],
          backgroundColor: [COLORS.primary, COLORS.accent, COLORS.success],
          borderColor: [COLORS.primary, COLORS.accent, COLORS.success],
          borderWidth: 1,
          borderRadius: 8,
          barPercentage: 0.6
        }]
      },
      options: {
        ...defaultOptions,
        plugins: {
          ...defaultOptions.plugins,
          legend: { display: false }
        }
      }
    });
  }

  /**
   * 5. Comparação com/sem Contemplação (Grouped Bar)
   */
  function renderComparativoCenarios(canvasId, cenarios) {
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const com = cenarios.comContemplacao;
    const sem = cenarios.semContemplacao;

    if (com.erro || sem.erro) return;

    instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Total Pago', 'Custo Total', 'Parcela Inicial'],
        datasets: [
          {
            label: 'Com Contemplação + Lance',
            data: [com.resumo.totalPago, com.resumo.custoTotal, com.resumo.parcelaTotalAtual],
            backgroundColor: COLORS.success,
            borderRadius: 6,
            barPercentage: 0.7
          },
          {
            label: 'Sem Contemplação Antecipada',
            data: [sem.resumo.totalPago, sem.resumo.custoTotal, sem.resumo.parcelaTotalAtual],
            backgroundColor: COLORS.gray,
            borderRadius: 6,
            barPercentage: 0.7
          }
        ]
      },
      options: defaultOptions
    });
  }

  /**
   * 6. Parcela Cheia vs Parcela Reduzida (Grouped Bar)
   */
  function renderComparativoParcela(canvasId, cenarios) {
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const comReducao = cenarios.comContemplacao;
    const semReducao = cenarios.parcelaCheia;

    if (comReducao.erro || semReducao.erro) return;

    // Pegar parcelas dos primeiros 12 meses para comparação
    const meses = Math.min(12, comReducao.cronograma.length, semReducao.cronograma.length);
    const labels = [];
    const dataReduzida = [];
    const dataCheia = [];

    for (let i = 0; i < meses; i++) {
      labels.push(`M${i + 1}`);
      dataReduzida.push(comReducao.cronograma[i].parcelaTotal);
      dataCheia.push(semReducao.cronograma[i].parcelaTotal);
    }

    instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Parcela Atual',
            data: dataReduzida,
            backgroundColor: COLORS.primary,
            borderRadius: 4,
            barPercentage: 0.7
          },
          {
            label: 'Parcela Cheia',
            data: dataCheia,
            backgroundColor: COLORS.grayLight,
            borderRadius: 4,
            barPercentage: 0.7
          }
        ]
      },
      options: defaultOptions
    });
  }

  /**
   * Renderiza todos os gráficos de uma vez.
   */
  function renderAll(resultado, cenarios) {
    if (resultado.erro) return;

    renderComposicaoPlano('chartComposicao', resultado.resumo);
    renderEvolucaoParcelas('chartParcelas', resultado.cronograma);
    renderEvolucaoSaldo('chartSaldo', resultado.cronograma);
    renderImpactoLance('chartLance', resultado.resumo);

    if (cenarios) {
      renderComparativoCenarios('chartCenarios', cenarios);
      renderComparativoParcela('chartParcelaComp', cenarios);
    }
  }

  /**
   * Destroi todos os charts.
   */
  function destroyAll() {
    Object.keys(instances).forEach(id => destroyChart(id));
  }

  // ═══════════════════════════════════════════
  // V2 — Gráficos de Comparação de Grupos
  // ═══════════════════════════════════════════

  /**
   * Gráfico 1 — Barras agrupadas de KPIs principais.
   */
  function renderCompBarrasKPI(canvasId, chartData, nomeA, nomeB) {
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: chartData.labels,
        datasets: [
          {
            label: nomeA || 'Grupo A',
            data: chartData.dataA,
            backgroundColor: COLORS.primary,
            borderRadius: 6,
            barPercentage: 0.7
          },
          {
            label: nomeB || 'Grupo B',
            data: chartData.dataB,
            backgroundColor: COLORS.accent,
            borderRadius: 6,
            barPercentage: 0.7
          }
        ]
      },
      options: defaultOptions
    });
  }

  /**
   * Gráfico 2 — Linhas de parcela mensal comparada.
   */
  function renderCompLinhasParcelas(canvasId, monthlyData, nomeA, nomeB) {
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: monthlyData.labels,
        datasets: [
          {
            label: nomeA || 'Grupo A',
            data: monthlyData.parcelasA,
            borderColor: COLORS.primary,
            backgroundColor: COLORS.primaryBg,
            fill: false,
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 5,
            borderWidth: 2.5
          },
          {
            label: nomeB || 'Grupo B',
            data: monthlyData.parcelasB,
            borderColor: COLORS.accent,
            backgroundColor: 'rgba(245,158,11,0.1)',
            fill: false,
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 5,
            borderWidth: 2.5
          }
        ]
      },
      options: defaultOptions
    });
  }

  /**
   * Gráfico 3 — Linhas de saldo devedor comparado.
   */
  function renderCompLinhasSaldo(canvasId, monthlyData, nomeA, nomeB) {
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: monthlyData.labels,
        datasets: [
          {
            label: nomeA || 'Grupo A',
            data: monthlyData.saldosA,
            borderColor: COLORS.danger,
            backgroundColor: COLORS.dangerBg,
            fill: false,
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 5,
            borderWidth: 2.5
          },
          {
            label: nomeB || 'Grupo B',
            data: monthlyData.saldosB,
            borderColor: COLORS.purple,
            backgroundColor: COLORS.purpleBg,
            fill: false,
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 5,
            borderWidth: 2.5
          }
        ]
      },
      options: defaultOptions
    });
  }

  /**
   * Gráfico 4 — Composição empilhada (Stacked Bar).
   */
  function renderCompComposicao(canvasId, compData) {
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: compData.labels,
        datasets: [
          {
            label: 'Carta de Crédito',
            data: compData.carta,
            backgroundColor: COLORS.primary,
            borderRadius: 0
          },
          {
            label: 'Taxa de Administração',
            data: compData.taxaAdm,
            backgroundColor: COLORS.accent,
            borderRadius: 0
          },
          {
            label: 'Fundo de Reserva',
            data: compData.fundoReserva,
            backgroundColor: COLORS.success,
            borderRadius: 0
          },
          {
            label: 'Seguro',
            data: compData.seguro,
            backgroundColor: COLORS.purple,
            borderRadius: 4
          }
        ]
      },
      options: {
        ...defaultOptions,
        scales: {
          ...defaultOptions.scales,
          x: { ...defaultOptions.scales.x, stacked: true },
          y: { ...defaultOptions.scales.y, stacked: true }
        }
      }
    });
  }

  /**
   * Gráfico 5 — Total pago até contemplação (barras simples).
   */
  function renderCompContemplacao(canvasId, contData, nomeA, nomeB) {
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: [nomeA || 'Grupo A', nomeB || 'Grupo B'],
        datasets: [{
          label: 'Total pago até contemplação',
          data: contData.data,
          backgroundColor: [COLORS.primary, COLORS.accent],
          borderRadius: 8,
          barPercentage: 0.5
        }]
      },
      options: {
        ...defaultOptions,
        plugins: {
          ...defaultOptions.plugins,
          legend: { display: false }
        }
      }
    });
  }

  /**
   * Renderiza todos os gráficos de comparação.
   */
  function renderAllComparison(compResult) {
    if (!compResult || compResult.erro) return;

    const nomeA = compResult.groupA.group.plano || 'Grupo A';
    const nomeB = compResult.groupB.group.plano || 'Grupo B';

    renderCompBarrasKPI('compChartBarras', compResult.charts.mainBars, nomeA, nomeB);
    renderCompLinhasParcelas('compChartParcelas', compResult.charts.monthly, nomeA, nomeB);
    renderCompLinhasSaldo('compChartSaldo', compResult.charts.monthly, nomeA, nomeB);
    renderCompComposicao('compChartComposicao', compResult.charts.composition);
    renderCompContemplacao('compChartContemplacao', compResult.charts.contemplation, nomeA, nomeB);
  }

  return {
    renderComposicaoPlano,
    renderEvolucaoParcelas,
    renderEvolucaoSaldo,
    renderImpactoLance,
    renderComparativoCenarios,
    renderComparativoParcela,
    renderAll,
    destroyAll,
    // V2 — Comparação
    renderCompBarrasKPI,
    renderCompLinhasParcelas,
    renderCompLinhasSaldo,
    renderCompComposicao,
    renderCompContemplacao,
    renderAllComparison
  };
})();

