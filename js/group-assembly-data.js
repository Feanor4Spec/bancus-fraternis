/**
 * Contrato governado para o histórico de assembleias disponível no protótipo.
 * A série abaixo é demonstrativa e só pode ser associada ao groupKey exato.
 */
(function (global) {
  'use strict';

  const EXACT_GROUP_KEY = '00000776|202512|1|79';
  const SOURCE = Object.freeze({
    sourceId: 'bf-demo-assemblies-group-79-v1',
    sourceType: 'demonstrative',
    associationStatus: 'unverified-demonstrative-mapping',
    label: 'Série demonstrativa de assembleias',
    periodStart: '2024-02-06',
    periodEnd: '2025-02-04',
    periodLabel: 'fev/2024 a fev/2025',
    groupKey: EXACT_GROUP_KEY,
    groupCodeLabel: '000079',
    contractual: false,
    proposalEvidenceEligible: false
  });

  const EVENTS = Object.freeze([
    { id: 10524, assembly: 150, date: '2024-02-06', lottery: 1, bid: 2, bidMin: 25.0000, bidMax: 25.0000 },
    { id: 10525, assembly: 151, date: '2024-03-05', lottery: 1, bid: 2, bidMin: 24.5000, bidMax: 24.5000 },
    { id: 10526, assembly: 152, date: '2024-04-05', lottery: 1, bid: 3, bidMin: 24.0000, bidMax: 24.0000 },
    { id: 10527, assembly: 153, date: '2024-05-03', lottery: 1, bid: 2, bidMin: 23.5000, bidMax: 23.5000 },
    { id: 10528, assembly: 154, date: '2024-06-04', lottery: 1, bid: 2, bidMin: 23.0000, bidMax: 23.0000 },
    { id: 10529, assembly: 155, date: '2024-07-05', lottery: 1, bid: 5, bidMin: 22.5000, bidMax: 22.5000 },
    { id: 10530, assembly: 156, date: '2024-08-06', lottery: 1, bid: 3, bidMin: 22.0000, bidMax: 22.0000 },
    { id: 10531, assembly: 157, date: '2024-09-03', lottery: 1, bid: 3, bidMin: 21.5000, bidMax: 21.5000 },
    { id: 10532, assembly: 158, date: '2024-10-08', lottery: 1, bid: 3, bidMin: 21.0000, bidMax: 21.0000 },
    { id: 10533, assembly: 159, date: '2024-11-05', lottery: 1, bid: 2, bidMin: 32.7999, bidMax: 36.9125 },
    { id: 10534, assembly: 160, date: '2024-12-03', lottery: 1, bid: 2, bidMin: 39.6516, bidMax: 41.9999 },
    { id: 10535, assembly: 161, date: '2025-01-07', lottery: 1, bid: 3, bidMin: 40.7815, bidMax: 43.5500 },
    { id: 10536, assembly: 162, date: '2025-02-04', lottery: 1, bid: 2, bidMin: 32.9130, bidMax: 37.8410 }
  ]);

  function metrics(events = EVENTS) {
    const rows = Array.isArray(events) ? events : [];
    if (!rows.length) return null;
    const lottery = rows.reduce((sum, row) => sum + Number(row.lottery || 0), 0);
    const bid = rows.reduce((sum, row) => sum + Number(row.bid || 0), 0);
    const total = lottery + bid;
    const peak = rows.reduce((best, row) => {
      const currentTotal = Number(row.lottery || 0) + Number(row.bid || 0);
      const bestTotal = Number(best.lottery || 0) + Number(best.bid || 0);
      return currentTotal > bestTotal ? row : best;
    }, rows[0]);
    return {
      assemblies: rows.length,
      lottery,
      bid,
      total,
      bidShare: total > 0 ? (bid / total) * 100 : null,
      minimumBid: Math.min(...rows.map((row) => Number(row.bidMin))),
      maximumBid: Math.max(...rows.map((row) => Number(row.bidMax))),
      peakAssembly: peak.assembly,
      peakTotal: Number(peak.lottery || 0) + Number(peak.bid || 0),
      latest: rows[rows.length - 1]
    };
  }

  function forGroup(groupKey) {
    if (String(groupKey || '') !== EXACT_GROUP_KEY) {
      return { available: false, source: null, events: [], metrics: null };
    }
    return { available: true, source: SOURCE, events: EVENTS.map((row) => ({ ...row })), metrics: metrics(EVENTS) };
  }

  global.BFGroupAssemblyData = Object.freeze({ EXACT_GROUP_KEY, SOURCE, EVENTS, metrics, forGroup });
})(window);
