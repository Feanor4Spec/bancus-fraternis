/**
 * ============================================
 * ConsórcioPro - Dados de Exemplo & Conceitos
 * ============================================
 */

const DadosExemplo = {
  // ─── Cenário padrão de teste ───
  padrao: {
    // Dados do Consultor (V3)
    consultor: 'Consultor Demo',
    consultorEmail: 'consultor.demo@bankfratern.local',
    consultorTelefone: '(11) 0000-0000',
    consultorEmpresa: 'Bancus Fraternis Demo',
    consultorCodigo: 'Consultor 01',
    dataSimulacao: new Date().toISOString().split('T')[0],

    // Dados do Cliente (V3)
    nomeCliente: 'Cliente Demonstracao',
    clienteCpf: '00000000000',
    clienteEmail: 'cliente.demo@bankfratern.local',
    clienteTelefone: '(11) 90000-0000',
    clienteObjetivo: 'aquisicao',
    observacoes: 'Desejo ser contemplado em até 6 meses.',

    // Dados herdados / hidden
    tipoBem: 'imovel',
    administradora: 'ConsórcioPro Admin',
    grupo: 'G-2026-001',
    cota: '0042',

    // Parâmetros financeiros
    valorCarta: 100000,
    prazoTotal: 100,
    taxaAdm: 10,
    fundoReserva: 2,
    seguro: 0,
    seguroTipo: 'percentual',
    tipoIndice: 'fixo',
    indiceReajuste: 5,
    mesAdesao: 1,
    mesAniversario: 12,
    mesContemplacao: 6,

    // Lance
    lanceProprio: 20,
    lanceEmbutido: 30,
    lanceFixo: 0,
    usarFGTS: false,
    valorFGTS: 0,
    modalidadeLance: 'combinado',

    // Parcela reduzida
    parcelaReduzida: false,
    percentualReducao: 0,

    // Política de cálculo
    politicaSaldo: 'carta',
    formaReajuste: 'anual_aniversario',
    formaAbaterLance: 'saldo_devedor',
    formaAdiantamento: 'reduzir_saldo',
    formaInadimplencia: 'manter_saldo',

    // Adiantamento e inadimplência
    adiantamentos: [],
    inadimplencias: [],
    parcelasAdiantadas: 0,
    multaAtraso: 2,
    jurosAtraso: 1
  }
};

/**
 * Dados conceituais para a seção educativa.
 * Cada item contém: título, ícone, cor, descrição, fórmula, observação e exemplo.
 */
const ConceitosConsorcio = [
  {
    id: 'carta-credito',
    titulo: 'Carta de Crédito',
    icone: '💳',
    cor: 'blue',
    descricao: 'É o valor que o consorciado terá direito a receber quando for contemplado. Funciona como o "poder de compra" do consórcio para adquirir o bem desejado.',
    formula: 'Carta de Crédito = Valor do bem desejado',
    observacao: 'A carta pode ser utilizada para comprar imóveis, veículos, ou contratar serviços, dependendo do tipo de consórcio.',
    exemplo: 'Se você deseja comprar um imóvel de R$ 100.000,00, sua carta de crédito será de R$ 100.000,00.'
  },
  {
    id: 'saldo-devedor',
    titulo: 'Saldo Devedor Inicial',
    icone: '📊',
    cor: 'blue',
    descricao: 'É o montante que o consorciado deve pagar ao longo do plano. Pode ser igual à carta de crédito ou incluir os custos totais, dependendo da política da administradora.',
    formula: 'Política A: Saldo = Carta\nPolítica B: Saldo = Carta + Taxa Adm + Fundo Reserva + Seguro',
    observacao: 'A política escolhida impacta diretamente o valor das parcelas.',
    exemplo: 'Carta R$ 100.000 | Política A: Saldo = R$ 100.000 | Política B: Saldo = R$ 100.000 + R$ 16.000 + R$ 2.000 = R$ 118.000'
  },
  {
    id: 'prazo-total',
    titulo: 'Prazo Total',
    icone: '📅',
    cor: 'blue',
    descricao: 'É a quantidade total de meses (N) do grupo de consórcio. Define por quanto tempo as parcelas serão pagas.',
    formula: 'N = número total de meses do grupo',
    observacao: 'Prazos comuns: 60, 80, 100, 120, 180 ou 200 meses.',
    exemplo: 'Um grupo de 100 meses terá 100 parcelas mensais.'
  },
  {
    id: 'prazo-restante',
    titulo: 'Prazo Restante',
    icone: '⏳',
    cor: 'blue',
    descricao: 'Quantidade de parcelas que ainda faltam para encerrar o plano. Diminui a cada mês.',
    formula: 'Prazo_Restante = Prazo_Anterior − 1',
    observacao: 'O prazo restante é usado como divisor para recalcular a parcela a cada mês.',
    exemplo: 'No mês 18 de um plano de 100 meses: Prazo Restante = 100 − 17 = 83 meses.'
  },
  {
    id: 'parcela-base',
    titulo: 'Parcela Base',
    icone: '💰',
    cor: 'gold',
    descricao: 'Valor que corresponde à fração do saldo devedor pelo prazo restante. É o componente principal da parcela.',
    formula: 'Parcela Base = Saldo Devedor ÷ Prazo Restante',
    observacao: 'A parcela base muda quando há reajuste (aniversário), lance (contemplação) ou adiantamento.',
    exemplo: 'Saldo R$ 100.000, Prazo 100 meses → Parcela Base = R$ 1.000,00'
  },
  {
    id: 'parcela-total',
    titulo: 'Parcela Total',
    icone: '🧾',
    cor: 'gold',
    descricao: 'É a soma da parcela base com os componentes de taxa de administração, fundo de reserva e seguro (diluídos mensalmente).',
    formula: 'Parcela Total = Parcela Base + (Taxa Adm ÷ N) + (Fundo Reserva ÷ N) + Seguro mensal',
    observacao: 'A parcela total é o valor efetivamente cobrado do consorciado a cada mês.',
    exemplo: 'Parcela Base R$ 1.000 + Taxa Adm R$ 160 + FR R$ 20 = Parcela Total R$ 1.180'
  },
  {
    id: 'taxa-adm',
    titulo: 'Taxa de Administração',
    icone: '🏦',
    cor: 'gold',
    descricao: 'Remuneração da administradora pela gestão do grupo. É um percentual sobre a carta de crédito, diluído ao longo do prazo.',
    formula: 'Taxa Adm Total = Carta × %Taxa\nTaxa Adm Mensal = Taxa Adm Total ÷ N',
    observacao: 'Taxas típicas variam de 10% a 20%, dependendo do tipo de bem e da administradora.',
    exemplo: 'Carta R$ 100.000, Taxa 16% → Total: R$ 16.000 → Mensal: R$ 160,00 (em 100 meses)'
  },
  {
    id: 'fundo-reserva',
    titulo: 'Fundo de Reserva',
    icone: '🛡️',
    cor: 'green',
    descricao: 'Valor destinado a proteger o grupo contra inadimplência e riscos. Pode ser devolvido ao final do grupo se não utilizado.',
    formula: 'FR Total = Carta × %FR\nFR Mensal = FR Total ÷ N',
    observacao: 'Geralmente varia de 1% a 5% do valor da carta.',
    exemplo: 'Carta R$ 100.000, FR 2% → Total: R$ 2.000 → Mensal: R$ 20,00'
  },
  {
    id: 'seguro',
    titulo: 'Seguro Opcional',
    icone: '🔒',
    cor: 'green',
    descricao: 'Proteção adicional que pode cobrir morte, invalidez ou outros riscos. Pode ser percentual ou valor fixo mensal.',
    formula: 'Seguro Total = Carta × %Seguro (ou Valor Fixo × N)',
    observacao: 'O seguro é opcional em muitas administradoras.',
    exemplo: 'Carta R$ 100.000, Seguro 0% → Sem custo adicional de seguro.'
  },
  {
    id: 'indice-reajuste',
    titulo: 'Índice de Reajuste',
    icone: '📈',
    cor: 'gold',
    descricao: 'Índice econômico usado para corrigir o saldo devedor anualmente. Mantém o poder de compra da carta de crédito.',
    formula: 'Saldo Ajustado = Saldo × (1 + Índice)',
    observacao: 'Índices comuns: IPCA (geral), INCC (imóveis), FIPE (veículos).',
    exemplo: 'Saldo R$ 80.000, IPCA 5% → Saldo Ajustado = R$ 80.000 × 1,05 = R$ 84.000'
  },
  {
    id: 'aniversario',
    titulo: 'Mês Aniversário do Grupo',
    icone: '🎂',
    cor: 'gold',
    descricao: 'Data anual em que o saldo devedor é reajustado pelo índice escolhido. Impacta diretamente no valor das parcelas futuras.',
    formula: 'No mês aniversário:\nSaldo = Saldo_Anterior × (1 + Índice)\nParcela = Saldo ÷ Prazo_Restante',
    observacao: 'O reajuste é aplicado uma vez por ano, no mês-aniversário definido pelo grupo.',
    exemplo: 'Mês 12: Saldo R$ 83.000 × 1,05 = R$ 87.150 → Nova parcela = R$ 87.150 ÷ 88 = R$ 990,34'
  },
  {
    id: 'contemplacao',
    titulo: 'Contemplação',
    icone: '🏆',
    cor: 'green',
    descricao: 'Momento em que o consorciado recebe a carta de crédito, por sorteio ou lance. A partir deste ponto pode adquirir o bem.',
    formula: 'Se houver lance:\nNovo_Saldo = Saldo − Lance_Total\nParcela = Novo_Saldo ÷ Prazo_Restante',
    observacao: 'Após a contemplação, o consorciado continua pagando as parcelas restantes.',
    exemplo: 'Contemplação no mês 18: Saldo R$ 82.000, Lance R$ 50.000 → Novo Saldo = R$ 32.000'
  },
  {
    id: 'lance-livre',
    titulo: 'Lance Livre',
    icone: '🎯',
    cor: 'purple',
    descricao: 'Oferta feita com recursos próprios do consorciado para antecipar a contemplação. O valor é abatido do saldo devedor.',
    formula: 'Lance Livre = Carta × %Lance_Próprio',
    observacao: 'Quanto maior o lance, maior a chance de contemplação e menor o saldo restante.',
    exemplo: 'Carta R$ 100.000, Lance 20% → Lance = R$ 20.000'
  },
  {
    id: 'lance-fixo',
    titulo: 'Lance Fixo',
    icone: '📌',
    cor: 'purple',
    descricao: 'Lance com valor pré-definido pela administradora. Todos os participantes oferecem o mesmo percentual.',
    formula: 'Lance Fixo = Carta × %Lance_Fixo',
    observacao: 'No lance fixo, a contemplação ocorre por sorteio entre os que ofertaram.',
    exemplo: 'Carta R$ 100.000, Lance Fixo 25% → Lance = R$ 25.000'
  },
  {
    id: 'lance-embutido',
    titulo: 'Lance Embutido',
    icone: '🔄',
    cor: 'purple',
    descricao: 'Parte da própria carta de crédito é usada como lance. Reduz o valor líquido recebido, mas não exige desembolso extra.',
    formula: 'Lance Embutido = Carta × %Lance_Embutido\nCarta Líquida = Carta − Lance Embutido',
    observacao: 'O lance embutido facilita a contemplação mas reduz o poder de compra.',
    exemplo: 'Carta R$ 100.000, Embutido 30% → Lance = R$ 30.000, Carta Líquida = R$ 70.000'
  },
  {
    id: 'lance-fgts',
    titulo: 'Lance com FGTS',
    icone: '🏠',
    cor: 'green',
    descricao: 'Para consórcios de imóveis, o FGTS pode ser utilizado como lance ou para amortizar parcelas.',
    formula: 'Lance FGTS = Saldo do FGTS disponível',
    observacao: 'O uso do FGTS é restrito a consórcios imobiliários e segue regras do governo.',
    exemplo: 'FGTS disponível: R$ 15.000 → Usado como lance para antecipar contemplação.'
  },
  {
    id: 'adiantamento',
    titulo: 'Adiantamento de Parcelas',
    icone: '⏩',
    cor: 'purple',
    descricao: 'Pagamento antecipado de parcelas futuras. Pode ser usado para reduzir o saldo devedor ou encurtar o prazo.',
    formula: 'Estratégia 1 (Redução de saldo):\nNovo_Saldo = Saldo − Valor_Adiantado\nParcela = Novo_Saldo ÷ Prazo_Restante\n\nEstratégia 2 (Redução de prazo):\nPrazo_Restante = Prazo − Parcelas_Abatidas',
    observacao: 'A escolha da estratégia impacta de formas diferentes o fluxo futuro.',
    exemplo: 'Saldo R$ 50.000, Adiantamento R$ 10.000 → Novo Saldo = R$ 40.000'
  },
  {
    id: 'inadimplencia',
    titulo: 'Inadimplência',
    icone: '⚠️',
    cor: 'red',
    descricao: 'Quando o consorciado deixa de pagar parcelas no prazo. Gera multa e juros sobre os valores em aberto.',
    formula: 'Multa = Parcela × %Multa\nJuros = Parcela × %Juros × Meses_Atraso\nTotal em Aberto = Parcela + Multa + Juros',
    observacao: 'A inadimplência pode levar à exclusão do grupo. Regularize o quanto antes.',
    exemplo: 'Parcela R$ 1.180, Multa 2%, Juros 1% a.m., 3 meses → Multa: R$ 23,60, Juros: R$ 35,40'
  },
  {
    id: 'carta-liquida',
    titulo: 'Carta Líquida',
    icone: '💵',
    cor: 'green',
    descricao: 'É o valor efetivo que o consorciado recebe após descontar o lance embutido. Representa o poder de compra real.',
    formula: 'Carta Líquida = Carta − Lance Embutido',
    observacao: 'Se não houver lance embutido, a carta líquida é igual à carta de crédito.',
    exemplo: 'Carta R$ 100.000, Lance Embutido R$ 30.000 → Carta Líquida = R$ 70.000'
  },
  {
    id: 'valor-total-plano',
    titulo: 'Valor Total do Plano',
    icone: '📋',
    cor: 'blue',
    descricao: 'Soma de todos os custos do consórcio: carta de crédito + taxa de administração + fundo de reserva + seguro.',
    formula: 'Valor Total = Carta + Taxa Adm Total + FR Total + Seguro Total',
    observacao: 'Este valor representa o custo total teórico do consórcio sem considerar reajustes.',
    exemplo: 'Carta R$ 100.000 + Taxa R$ 16.000 + FR R$ 2.000 + Seguro R$ 0 = R$ 118.000'
  },
  {
    id: 'evento-mensal',
    titulo: 'Evento Mensal',
    icone: '📌',
    cor: 'blue',
    descricao: 'Cada mês do consórcio tem um "evento" que identifica o tipo de cálculo aplicado naquele período.',
    formula: 'Eventos possíveis:\n• Adesão (mês 1)\n• Normal\n• Aniversário (reajuste)\n• Contemplação\n• Adiantamento\n• Inadimplência\n• Regularização',
    observacao: 'O evento determina qual regra de cálculo é aplicada em cada mês.',
    exemplo: 'Mês 1 = Adesão | Mês 12 = Aniversário | Mês 18 = Contemplação'
  }
];

/**
 * ============================================
 * V2 — Grupos para Comparação
 * ============================================
 * Base de grupos de exemplo para o módulo
 * de comparação de grupos.
 */
const GruposComparacao = [
  {
    idGrupo: 'GRP-001',
    administradora: 'ConsórcioPro Admin',
    plano: 'Imóvel Essencial 100',
    codigoGrupo: 'G-2026-001',
    tipoBem: 'imovel',
    valorCarta: 100000,
    prazoMeses: 100,
    taxaAdmTotalPct: 16,
    fundoReservaPct: 2,
    seguroPct: 0,
    indiceReajuste: 'INCC',
    mesAniversario: 12,
    lanceEmbutidoMaxPct: 30,
    lanceFixoPct: 0,
    parcelaReduzidaDisponivel: true,
    reducaoMaxParcelaPct: 30,
    statusGrupo: 'Em andamento',
    observacao: 'Grupo com taxa competitiva e flexibilidade de lance embutido de até 30%.'
  },
  {
    idGrupo: 'GRP-002',
    administradora: 'ConsórcioPro Admin',
    plano: 'Imóvel Premium 120',
    codigoGrupo: 'G-2026-002',
    tipoBem: 'imovel',
    valorCarta: 120000,
    prazoMeses: 120,
    taxaAdmTotalPct: 13.99,
    fundoReservaPct: 1,
    seguroPct: 0,
    indiceReajuste: 'INCC',
    mesAniversario: 12,
    lanceEmbutidoMaxPct: 20,
    lanceFixoPct: 0,
    parcelaReduzidaDisponivel: true,
    reducaoMaxParcelaPct: 25,
    statusGrupo: 'Em andamento',
    observacao: 'Grupo com carta maior, prazo estendido e taxa reduzida. Lance embutido até 20%.'
  },
  {
    idGrupo: 'GRP-003',
    administradora: 'ConsórcioPro Admin',
    plano: 'Auto Flex 60',
    codigoGrupo: 'G-2026-010',
    tipoBem: 'automovel',
    valorCarta: 80000,
    prazoMeses: 60,
    taxaAdmTotalPct: 18,
    fundoReservaPct: 3,
    seguroPct: 0.5,
    indiceReajuste: 'FIPE',
    mesAniversario: 6,
    lanceEmbutidoMaxPct: 25,
    lanceFixoPct: 0,
    parcelaReduzidaDisponivel: false,
    reducaoMaxParcelaPct: 0,
    statusGrupo: 'Em andamento',
    observacao: 'Grupo automotivo com prazo curto e taxa padrão de mercado.'
  },
  {
    idGrupo: 'GRP-004',
    administradora: 'ConsórcioPro Admin',
    plano: 'Auto Plus 80',
    codigoGrupo: 'G-2026-011',
    tipoBem: 'automovel',
    valorCarta: 95000,
    prazoMeses: 80,
    taxaAdmTotalPct: 15.5,
    fundoReservaPct: 2,
    seguroPct: 0.3,
    indiceReajuste: 'FIPE',
    mesAniversario: 6,
    lanceEmbutidoMaxPct: 30,
    lanceFixoPct: 10,
    parcelaReduzidaDisponivel: true,
    reducaoMaxParcelaPct: 20,
    statusGrupo: 'Em andamento',
    observacao: 'Grupo automotivo com carta e prazo maiores, taxa mais competitiva.'
  }
];

/**
 * Cenário padrão de comparação.
 */
const CenarioPadraoComparacao = {
  saldoInicialMode: 'carta',
  indiceReajustePct: 5,
  mesContemplacao: 18,
  lanceProprioPct: 20,
  lanceEmbutidoPct: 20,
  usarFgts: false,
  valorFgts: 0,
  parcelaReduzida: false,
  percentualReducao: 0,
  adiantamentoMes: 0,
  adiantamentoValor: 0,
  adiantamentoModo: 'reduzir_saldo',
  inadimplenciaMes: 0,
  mesesAtraso: 0,
  multaPct: 2,
  jurosPct: 1
};
