/**
 * ============================================
 * Bancus Fraternis V7 - Modulo de Configuracoes
 * ============================================
 * Persiste preferencias do consultor e aplica
 * configuracoes globais nas paginas do portal.
 * ============================================
 */

const Settings = (() => {
  'use strict';

  const STORAGE_KEY = 'consorciopro_settings';

  const DEFAULTS = {
    defaultAdmin: '',
    defaultSegmento: '',
    maxLanceEmbutido: 30,
    showJourney: true,
    smoothScroll: true,
    darkMode: false,
    pageSize: 50,
    autoScore: true,
    defaultPoliticaSaldo: 'carta',
    defaultIndiceReajuste: 5,
    defaultMesContemplacao: 18
  };

  function getDefaults() {
    return { ...DEFAULTS };
  }

  function _getLocalStorage() {
    try {
      return (typeof localStorage !== 'undefined') ? localStorage : null;
    } catch (e) {
      return null;
    }
  }

  function clampNumber(value, min, max, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  function normalize(config) {
    const raw = (config && typeof config === 'object' && !Array.isArray(config)) ? config : {};
    const merged = { ...DEFAULTS, ...raw };

    merged.showJourney = merged.showJourney !== false;
    merged.smoothScroll = merged.smoothScroll !== false;
    merged.darkMode = merged.darkMode === true;
    merged.autoScore = merged.autoScore !== false;

    merged.maxLanceEmbutido = clampNumber(merged.maxLanceEmbutido, 0, 100, DEFAULTS.maxLanceEmbutido);
    merged.defaultIndiceReajuste = clampNumber(merged.defaultIndiceReajuste, 0, 50, DEFAULTS.defaultIndiceReajuste);
    merged.defaultMesContemplacao = Math.round(clampNumber(merged.defaultMesContemplacao, 1, 300, DEFAULTS.defaultMesContemplacao));
    merged.pageSize = Math.round(clampNumber(merged.pageSize, 10, 500, DEFAULTS.pageSize));
    merged.defaultPoliticaSaldo = merged.defaultPoliticaSaldo === 'carta_mais_custos' ? 'carta_mais_custos' : 'carta';
    merged.defaultAdmin = String(merged.defaultAdmin || '').trim();
    merged.defaultSegmento = String(merged.defaultSegmento || '').trim();

    return merged;
  }

  function load() {
    try {
      const storage = _getLocalStorage();
      if (!storage) return getDefaults();
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return getDefaults();
      const saved = JSON.parse(raw);
      if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return getDefaults();
      return normalize(saved);
    } catch (e) {
      console.warn('Settings: erro ao carregar', e);
      return getDefaults();
    }
  }

  function save(config) {
    try {
      const storage = _getLocalStorage();
      if (!storage) return false;
      const payload = (config && typeof config === 'object' && !Array.isArray(config))
        ? normalize(config)
        : load();
      storage.setItem(STORAGE_KEY, JSON.stringify(payload));
      applyGlobal(payload);
      return true;
    } catch (e) {
      console.error('Settings: erro ao salvar', e);
      return false;
    }
  }

  function get(key) {
    const all = load();
    return all[key] !== undefined ? all[key] : DEFAULTS[key];
  }

  function set(key, value) {
    const all = load();
    all[key] = value;
    return save(all);
  }

  function reset() {
    return save(getDefaults());
  }

  function describe(config) {
    const cfg = normalize(config || load());
    const parts = [];
    if (cfg.defaultAdmin) parts.push(`admin ${cfg.defaultAdmin}`);
    if (cfg.defaultSegmento) parts.push(`segmento ${cfg.defaultSegmento}`);
    parts.push(`${cfg.pageSize} grupos/pagina`);
    parts.push(`reajuste ${cfg.defaultIndiceReajuste}%`);
    parts.push(`MOB ${cfg.defaultMesContemplacao}`);
    parts.push(cfg.autoScore ? 'score automatico' : 'score manual');
    return parts.join(' | ');
  }

  function applyGlobal(config) {
    const cfg = normalize(config || load());

    const apply = () => {
      const root = document.documentElement;
      const body = document.body;
      if (!root || !body) return cfg;

      root.classList.toggle('bf-settings-no-smooth', !cfg.smoothScroll);
      body.classList.toggle('bf-settings-no-smooth', !cfg.smoothScroll);
      body.classList.toggle('bf-settings-dark', cfg.darkMode);
      body.classList.toggle('bf-settings-hide-journey', !cfg.showJourney);
      body.classList.toggle('bf-settings-autoscore-off', !cfg.autoScore);
      root.style.scrollBehavior = cfg.smoothScroll ? 'smooth' : 'auto';

      body.dataset.settingsApplied = 'true';
      body.dataset.settingsPageSize = String(cfg.pageSize);
      body.dataset.settingsAutoScore = cfg.autoScore ? 'on' : 'off';
      body.dataset.settingsSegmento = cfg.defaultSegmento || '';

      document.querySelectorAll('[data-settings-summary]').forEach((el) => {
        el.textContent = describe(cfg);
      });

      document.querySelectorAll('[data-settings-journey], #solucoes.hm-journey').forEach((el) => {
        el.hidden = !cfg.showJourney;
        el.setAttribute('aria-hidden', cfg.showJourney ? 'false' : 'true');
      });

      try {
        window.dispatchEvent(new CustomEvent('bankfratern:settings-applied', { detail: { config: cfg } }));
      } catch (e) {
        // CustomEvent can fail in very old embedded engines; global classes still apply.
      }

      return cfg;
    };

    if (typeof document !== 'undefined' && document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', apply, { once: true });
      return cfg;
    }

    return apply();
  }

  const api = { load, save, get, set, reset, getDefaults, normalize, describe, applyGlobal, DEFAULTS, STORAGE_KEY };

  if (typeof window !== 'undefined') {
    window.Settings = api;
    applyGlobal();
  }

  return api;
})();
