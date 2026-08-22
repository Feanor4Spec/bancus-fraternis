/**
 * ============================================
 * ConsórcioPro - Módulo de Exportação
 * ============================================
 * Gera PDF e versão para impressão da
 * proposta comercial de consórcio.
 * ============================================
 */

const ExportManager = (() => {
  'use strict';

  /**
   * Formata valor monetário em pt-BR.
   */
  function formatMoney(value) {
    if (value == null || isNaN(value)) return 'R$ 0,00';
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2
    });
  }

  function sanitizeFilename(value) {
    return String(value || 'proposta_estruturada')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 80) || 'proposta_estruturada';
  }

  function escapeHTML(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getProposalFilename(source) {
    const id = source?.querySelector?.('.ps-eyebrow')?.textContent || 'proposta_estruturada';
    const date = new Date().toISOString().split('T')[0];
    return `${sanitizeFilename(id)}_${date}.pdf`;
  }

  function copyCanvasState(source, clone) {
    const sourceCanvases = source.querySelectorAll('canvas');
    const cloneCanvases = clone.querySelectorAll('canvas');
    sourceCanvases.forEach((canvas, index) => {
      const target = cloneCanvases[index];
      if (!target) return;
      target.width = canvas.width;
      target.height = canvas.height;
      target.style.width = canvas.style.width || `${canvas.clientWidth}px`;
      target.style.height = canvas.style.height || `${canvas.clientHeight}px`;
      const ctx = target.getContext('2d');
      if (ctx) ctx.drawImage(canvas, 0, 0);
    });
  }

  function resolveExportSource(selector) {
    if (!selector) {
      return document.querySelector('#proposal-export-root') || document.querySelector('#proposal-summary-print-root');
    }
    if (typeof selector !== 'string') return selector;

    const selectors = selector.split(',').map(item => item.trim()).filter(Boolean);
    if (selectors.length > 1) {
      for (const item of selectors) {
        const node = document.querySelector(item);
        if (node) return node;
      }
      return null;
    }
    return document.querySelector(selector);
  }

  function addPageNumbers(pdf, pageWidth, pageHeight, margin) {
    const pageCount = pdf.getNumberOfPages();
    pdf.setFontSize(8);
    pdf.setTextColor(100, 116, 139);
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.text(`Página ${i} de ${pageCount}`, pageWidth - margin, pageHeight - 4, { align: 'right' });
    }
  }

  function addCanvasToPDF(pdf, canvas, margin = 8) {
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const printableWidth = pageWidth - margin * 2;
    const printableHeight = pageHeight - margin * 2;
    const pageCanvasHeight = Math.floor((canvas.width / printableWidth) * printableHeight);
    let renderedHeight = 0;
    let page = 0;

    while (renderedHeight < canvas.height) {
      const sliceHeight = Math.min(pageCanvasHeight, canvas.height - renderedHeight);
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeight;
      const ctx = pageCanvas.getContext('2d');
      if (!ctx) break;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      ctx.drawImage(canvas, 0, renderedHeight, canvas.width, sliceHeight, 0, 0, pageCanvas.width, sliceHeight);

      if (page > 0) pdf.addPage();
      const imgData = pageCanvas.toDataURL('image/jpeg', 0.96);
      const imgHeight = (sliceHeight * printableWidth) / canvas.width;
      pdf.addImage(imgData, 'JPEG', margin, margin, printableWidth, imgHeight);

      renderedHeight += sliceHeight;
      page++;
    }

    addPageNumbers(pdf, pageWidth, pageHeight, margin);
  }

  async function renderCanvas(element) {
    return html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: 1120
    });
  }

  function createPDFState(pdf, margin) {
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    return {
      pageWidth,
      pageHeight,
      margin,
      printableWidth: pageWidth - margin * 2,
      printableHeight: pageHeight - margin * 2,
      cursorY: margin,
      hasContent: false
    };
  }

  function drawCanvasSlice(pdf, sourceCanvas, sourceY, sourceHeight, state) {
    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = sourceCanvas.width;
    pageCanvas.height = sourceHeight;
    const ctx = pageCanvas.getContext('2d');
    if (!ctx) return 0;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    ctx.drawImage(sourceCanvas, 0, sourceY, sourceCanvas.width, sourceHeight, 0, 0, pageCanvas.width, sourceHeight);

    const imgHeight = (sourceHeight * state.printableWidth) / sourceCanvas.width;
    pdf.addImage(pageCanvas.toDataURL('image/jpeg', 0.96), 'JPEG', state.margin, state.margin, state.printableWidth, imgHeight);
    return imgHeight;
  }

  function addCanvasBlockToPDF(pdf, canvas, state, gap = 5) {
    if (!canvas || !canvas.width || !canvas.height) return;

    const imgHeight = (canvas.height * state.printableWidth) / canvas.width;
    const fitsSinglePage = imgHeight <= state.printableHeight;

    if (fitsSinglePage) {
      if (state.hasContent && state.cursorY + imgHeight > state.pageHeight - state.margin) {
        pdf.addPage();
        state.cursorY = state.margin;
        state.hasContent = false;
      }
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.96), 'JPEG', state.margin, state.cursorY, state.printableWidth, imgHeight);
      state.cursorY += imgHeight + gap;
      state.hasContent = true;
      return;
    }

    if (state.hasContent) {
      pdf.addPage();
      state.cursorY = state.margin;
      state.hasContent = false;
    }

    const sourcePixelsPerMM = canvas.width / state.printableWidth;
    const maxSliceHeight = Math.max(1, Math.floor(state.printableHeight * sourcePixelsPerMM));
    let renderedHeight = 0;
    let sliceIndex = 0;

    while (renderedHeight < canvas.height) {
      if (sliceIndex > 0) pdf.addPage();
      const sliceHeight = Math.min(maxSliceHeight, canvas.height - renderedHeight);
      const drawnHeight = drawCanvasSlice(pdf, canvas, renderedHeight, sliceHeight, state);
      renderedHeight += sliceHeight;
      sliceIndex++;
      state.cursorY = state.margin + drawnHeight + gap;
      state.hasContent = true;
    }
  }

  async function addBlocksToPDF(pdf, root, margin = 8) {
    const state = createPDFState(pdf, margin);
    const directBlocks = Array.from(root.children || []).filter(child => child.classList && child.classList.contains('ps-print-page'));
    const blocks = directBlocks.length ? directBlocks : [root];

    for (const block of blocks) {
      const canvas = await renderCanvas(block);
      addCanvasBlockToPDF(pdf, canvas, state);
    }

    addPageNumbers(pdf, state.pageWidth, state.pageHeight, margin);
  }

  function prepareTextualPrintClone(source) {
    const clone = source.cloneNode(true);
    const sourceCanvases = source.querySelectorAll('canvas');
    const cloneCanvases = clone.querySelectorAll('canvas');
    sourceCanvases.forEach((canvas, index) => {
      const target = cloneCanvases[index];
      if (!target) return;
      try {
        const img = document.createElement('img');
        img.src = canvas.toDataURL('image/png');
        img.alt = canvas.getAttribute('aria-label') || 'Gráfico da simulação';
        img.style.cssText = `display:block;width:${canvas.clientWidth || canvas.width}px;max-width:100%;height:auto;`;
        target.replaceWith(img);
      } catch (error) {
        target.setAttribute('aria-label', 'Gráfico indisponível na impressão');
      }
    });
    clone.querySelectorAll('button, [data-screen-only="true"]').forEach((node) => node.remove());
    clone.querySelectorAll('details').forEach((node) => { node.open = true; });
    return clone;
  }

  function collectPrintStyles() {
    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .map((link) => `<link rel="stylesheet" href="${link.href}">`)
      .join('');
    const styles = Array.from(document.querySelectorAll('style'))
      .map((style) => `<style>${style.textContent || ''}</style>`)
      .join('');
    return links + styles;
  }

  /**
   * Abre a mesma proposta HTML em uma superficie de impressao nativa.
   * Ao salvar como PDF pelo navegador, textos e links permanecem pesquisaveis.
   */
  async function exportarPDFDaTela(selector = '#proposal-export-root, #proposal-summary-print-root') {
    const source = resolveExportSource(selector);
    if (!source) {
      alert('Resumo da proposta não encontrado. Calcule a simulação antes de imprimir.');
      return false;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('A janela de impressão foi bloqueada. Permita pop-ups para imprimir ou salvar em PDF.');
      return false;
    }
    printWindow.opener = null;

    const clone = prepareTextualPrintClone(source);
    const title = getProposalFilename(source).replace(/\.pdf$/i, '').replace(/[<>&"']/g, '');
    let printTriggered = false;
    const triggerPrint = () => {
      if (printTriggered || printWindow.closed) return;
      printTriggered = true;
      window.setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 350);
    };
    printWindow.addEventListener('load', triggerPrint, { once: true });
    printWindow.document.open();
    printWindow.document.write(`<!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width,initial-scale=1">
          <meta name="robots" content="noindex,nofollow,noarchive">
          <title>${title}</title>
          ${collectPrintStyles()}
          <style>
            @page { size: A4; margin: 0; }
            html, body { margin: 0; padding: 0; background: #fff; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            a { color: inherit; text-decoration: none; }
            .ps-print-page { break-after: page; page-break-after: always; }
            .ps-print-page:last-child { break-after: auto; page-break-after: auto; }
          </style>
        </head>
        <body class="proposal-native-print">${clone.outerHTML}</body>
      </html>`);
    printWindow.document.close();
    window.setTimeout(triggerPrint, 1000);
    return true;
  }

  /**
   * Gera o HTML da proposta comercial para exibição e exportação.
   */
  function gerarHTMLProposta(params, resultado) {
    if (!resultado || resultado.erro) return '<p>Erro ao gerar proposta.</p>';

    const r = resultado.resumo;
    const today = new Date().toLocaleDateString('pt-BR');
    const tipoBemLabel = {
      imovel: 'Imóvel', automovel: 'Automóvel', moto: 'Motocicleta',
      pesado: 'Veículo Pesado', servicos: 'Serviços'
    };

    // Tabela resumida (primeiros 24 meses ou até contemplação + 6)
    const mesesExibir = Math.min(r.cronograma.length, Math.max(24, params.mesContemplacao + 6));
    let tabelaRows = '';
    for (let i = 0; i < mesesExibir; i++) {
      const m = r.cronograma[i];
      tabelaRows += `<tr>
        <td style="text-align:center;padding:6px 8px;border-bottom:1px solid #e5e7eb;">${escapeHTML(m.mes)}</td>
        <td style="text-align:right;padding:6px 8px;border-bottom:1px solid #e5e7eb;">${escapeHTML(formatMoney(m.parcelaTotal))}</td>
        <td style="text-align:right;padding:6px 8px;border-bottom:1px solid #e5e7eb;">${escapeHTML(formatMoney(m.saldoFinal))}</td>
        <td style="text-align:center;padding:6px 8px;border-bottom:1px solid #e5e7eb;">
          <span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;
            background:${getEventColor(m.evento).bg};color:${getEventColor(m.evento).text};">${escapeHTML(m.evento)}</span>
        </td>
      </tr>`;
    }

    return `
      <div id="proposta-exportavel" style="font-family:'Inter',sans-serif;color:#1f2937;max-width:800px;margin:0 auto;">
        <!-- Cabeçalho -->
        <div style="background:linear-gradient(135deg,#0B2C52,#143B66);color:white;padding:40px;text-align:center;border-radius:12px 12px 0 0;">
          <div style="font-size:28px;font-weight:800;letter-spacing:-0.5px;">Bancus Fraternis</div>
          <div style="font-size:14px;color:#d8b75b;margin-top:4px;">Proposta Comercial de Consórcio</div>
          <div style="font-size:12px;color:#e9d79d;margin-top:8px;">Data: ${today}</div>
        </div>

        <div style="padding:32px;background:white;">
          <!-- Dados do Cliente -->
          <div style="margin-bottom:28px;">
            <h3 style="font-size:16px;font-weight:700;color:#1a4480;border-bottom:2px solid #dbeafe;padding-bottom:8px;margin-bottom:12px;">
              Dados do Cliente
            </h3>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
              ${infoItem('Cliente', params.nomeCliente || '—')}
              ${infoItem('Tipo de Bem', tipoBemLabel[params.tipoBem] || params.tipoBem)}
              ${infoItem('Administradora', params.administradora || '—')}
              ${infoItem('Grupo / Cota', `${params.grupo || '—'} / ${params.cota || '—'}`)}
              ${infoItem('Consultor', params.consultor || '—')}
              ${infoItem('Data', params.dataSimulacao || today)}
            </div>
          </div>

          <!-- Resumo Financeiro -->
          <div style="margin-bottom:28px;">
            <h3 style="font-size:16px;font-weight:700;color:#1a4480;border-bottom:2px solid #dbeafe;padding-bottom:8px;margin-bottom:12px;">
              Resumo Financeiro
            </h3>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
              ${kpiItem('Carta de Crédito', formatMoney(r.valorCarta), '#2563eb')}
              ${kpiItem('Valor Total do Plano', formatMoney(r.valorTotalPlano), '#1a4480')}
              ${kpiItem('Taxa de Administração', `${r.taxaAdmPercentual}% (${formatMoney(r.taxaAdmTotal)})`, '#f59e0b')}
              ${kpiItem('Fundo de Reserva', `${r.fundoReservaPercentual}% (${formatMoney(r.fundoReservaTotal)})`, '#10b981')}
              ${kpiItem('Seguro Total', formatMoney(r.seguroTotal), '#8b5cf6')}
              ${kpiItem('Saldo Devedor Inicial', formatMoney(r.saldoInicial), '#374151')}
              ${kpiItem('Parcela Inicial', formatMoney(r.parcelaTotalAtual), '#2563eb')}
              ${kpiItem('Prazo Total', `${r.prazoTotal} meses`, '#374151')}
              ${kpiItem('Mês de Contemplação', `Mês ${r.mesContemplacao}`, '#10b981')}
            </div>
          </div>

          <!-- Lance -->
          <div style="margin-bottom:28px;">
            <h3 style="font-size:16px;font-weight:700;color:#1a4480;border-bottom:2px solid #dbeafe;padding-bottom:8px;margin-bottom:12px;">
              Informações do Lance
            </h3>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
              ${kpiItem('Lance Próprio', formatMoney(r.lanceProprio), '#2563eb')}
              ${kpiItem('Lance Embutido', formatMoney(r.lanceEmbutido), '#f59e0b')}
              ${kpiItem('Lance Total', formatMoney(r.lanceTotal), '#10b981')}
              ${kpiItem('Carta Líquida', formatMoney(r.cartaLiquida), '#059669')}
              ${kpiItem('Prazo após a contemplação', `${r.prazoRestante} meses`, '#374151')}
              ${kpiItem('Custo Total Estimado', formatMoney(r.custoTotal), '#ef4444')}
            </div>
          </div>

          <!-- Tabela Resumida -->
          <div style="margin-bottom:28px;">
            <h3 style="font-size:16px;font-weight:700;color:#1a4480;border-bottom:2px solid #dbeafe;padding-bottom:8px;margin-bottom:12px;">
              Fluxo Mensal (Resumo)
            </h3>
            <table style="width:100%;border-collapse:collapse;font-size:12px;">
              <thead>
                <tr style="background:#1a2332;color:white;">
                  <th style="padding:8px;text-align:center;font-weight:600;">Mês</th>
                  <th style="padding:8px;text-align:right;font-weight:600;">Parcela Total</th>
                  <th style="padding:8px;text-align:right;font-weight:600;">Saldo Devedor</th>
                  <th style="padding:8px;text-align:center;font-weight:600;">Evento</th>
                </tr>
              </thead>
              <tbody>${tabelaRows}</tbody>
            </table>
            ${mesesExibir < r.cronograma.length ?
        `<p style="text-align:center;color:#6b7280;font-size:11px;margin-top:8px;">
                Exibindo ${mesesExibir} de ${r.cronograma.length} meses. Tabela completa disponível na versão digital.
              </p>` : ''}
          </div>

          <!-- Observações -->
          ${params.observacoes ? `
          <div style="margin-bottom:28px;">
            <h3 style="font-size:16px;font-weight:700;color:#1a4480;border-bottom:2px solid #dbeafe;padding-bottom:8px;margin-bottom:12px;">
              Observações
            </h3>
            <p style="font-size:13px;color:#4b5563;line-height:1.6;">${escapeHTML(params.observacoes)}</p>
          </div>` : ''}

          <!-- Disclaimer -->
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:28px;">
            <p style="font-size:11px;color:#6b7280;line-height:1.6;margin:0;">
              <strong>Aviso:</strong> Esta proposta é uma simulação e não constitui oferta vinculante.
              Os valores apresentados são estimativas baseadas nos parâmetros informados e podem variar
              conforme reajustes, alterações nas condições do grupo e políticas da administradora.
              Consulte as condições contratuais oficiais.
            </p>
          </div>
        </div>

        <!-- Rodapé com assinatura -->
        <div style="background:#f3f4f6;padding:24px 32px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:flex-end;border-radius:0 0 12px 12px;">
          <div style="text-align:center;">
            <div style="width:180px;height:1px;background:#9ca3af;margin-bottom:8px;"></div>
            <div style="font-size:13px;font-weight:600;color:#374151;">${escapeHTML(params.nomeCliente || 'Cliente')}</div>
            <div style="font-size:11px;color:#6b7280;">Cliente</div>
          </div>
          <div style="text-align:center;">
            <div style="width:180px;height:1px;background:#9ca3af;margin-bottom:8px;"></div>
            <div style="font-size:13px;font-weight:600;color:#374151;">${escapeHTML(params.consultor || 'Consultor')}</div>
            <div style="font-size:11px;color:#6b7280;">Consultor Responsável</div>
          </div>
        </div>
      </div>
    `;
  }

  /** Helper: item de informação */
  function infoItem(label, value) {
    return `<div style="padding:8px 12px;background:#f9fafb;border-radius:6px;">
      <div style="font-size:10px;font-weight:600;text-transform:uppercase;color:#6b7280;letter-spacing:0.5px;">${escapeHTML(label)}</div>
      <div style="font-size:14px;font-weight:600;color:#1f2937;margin-top:2px;">${escapeHTML(value)}</div>
    </div>`;
  }

  /** Helper: KPI item */
  function kpiItem(label, value, color) {
    const safeColor = /^#[0-9a-f]{3,8}$/i.test(String(color || '')) ? color : '#374151';
    return `<div style="padding:12px;background:#f9fafb;border-radius:8px;border-left:3px solid ${safeColor};">
      <div style="font-size:10px;font-weight:600;text-transform:uppercase;color:#6b7280;letter-spacing:0.5px;">${escapeHTML(label)}</div>
      <div style="font-size:16px;font-weight:700;color:#1f2937;margin-top:4px;">${escapeHTML(value)}</div>
    </div>`;
  }

  /** Helper: cor do evento */
  function getEventColor(evento) {
    const map = {
      'adesão': { bg: '#dbeafe', text: '#1e40af' },
      'normal': { bg: '#f3f4f6', text: '#4b5563' },
      'aniversário': { bg: '#fef3c7', text: '#92400e' },
      'contemplação': { bg: '#d1fae5', text: '#065f46' },
      'aniversário + contemplação': { bg: '#d1fae5', text: '#065f46' },
      'adiantamento': { bg: '#ede9fe', text: '#5b21b6' },
      'inadimplência': { bg: '#fee2e2', text: '#991b1b' },
      'regularização': { bg: '#dbeafe', text: '#1e40af' }
    };
    return map[evento] || map['normal'];
  }

  /**
   * Abre versão para impressão em nova janela.
   */
  function imprimirProposta(params, resultado) {
    const summaryRoot = document.querySelector('#proposal-export-root') || document.querySelector('#proposal-summary-print-root');
    if (summaryRoot && typeof ProposalSummary !== 'undefined' && ProposalSummary.print) {
      ProposalSummary.print(summaryRoot);
      return false;
    }

    const html = gerarHTMLProposta(params, resultado);
    const win = window.open('', '_blank');
    win.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Proposta - ${escapeHTML(params.nomeCliente || 'Bancus Fraternis')}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
        <style>
          body { margin: 0; padding: 20px; background: #f0f4f8; font-family: 'Inter', sans-serif; }
          @media print {
            body { padding: 0; background: white; }
            @page { margin: 15mm; }
          }
        </style>
      </head>
      <body>
        ${html}
        <script>setTimeout(() => window.print(), 500);<\/script>
      </body>
      </html>
    `);
    win.document.close();
  }

  /**
   * Exporta proposta como PDF usando html2canvas + jsPDF.
   */
  async function exportarPDF(params, resultado) {
    const summaryRoot = document.querySelector('#proposal-export-root') || document.querySelector('#proposal-summary-print-root');
    if (summaryRoot) {
      return exportarPDFDaTela(summaryRoot);
    }

    if (typeof html2canvas === 'undefined' || typeof jspdf === 'undefined') {
      alert('Bibliotecas de exportação não carregadas. Verifique sua conexão.');
      return false;
    }

    // Criar container temporário com a proposta
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '800px';
    container.style.background = 'white';
    container.innerHTML = gerarHTMLProposta(params, resultado);
    document.body.appendChild(container);

    try {
      // Capturar como canvas
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
      });

      // Criar PDF
      const { jsPDF } = jspdf;
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pageWidth - (margin * 2);

      const imgWidth = contentWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = margin;

      // Primeira página
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', margin, position, imgWidth, imgHeight);
      heightLeft -= (pageHeight - margin * 2);

      // Páginas adicionais se necessário
      while (heightLeft > 0) {
        position = margin - (imgHeight - heightLeft);
        pdf.addPage();
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', margin, position, imgWidth, imgHeight);
        heightLeft -= (pageHeight - margin * 2);
      }

      // Salvar
      const nomeArquivo = `proposta_${(params.nomeCliente || 'consorcio').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(nomeArquivo);
      return true;

    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      alert('Erro ao gerar PDF. Tente a versão para impressão.');
      return false;
    } finally {
      document.body.removeChild(container);
    }
  }

  return {
    gerarHTMLProposta,
    imprimirProposta,
    exportarPDF,
    exportarPDFDaTela
  };
})();
