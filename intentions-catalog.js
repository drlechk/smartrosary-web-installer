// Catalog published by the canonical smartrosary-intentions repository.
(function (global) {
  'use strict';
  const url = 'https://drlechk.github.io/smartrosary-intentions/intentions-data.json';

  function validateCatalog(catalog) {
    if (!catalog || !Array.isArray(catalog.items) || !catalog.items.length) {
      throw new Error('intentionsCatalogError');
    }
    const ids = new Set();
    for (const item of catalog.items) {
      if (!item || typeof item.id !== 'string' || !item.id || ids.has(item.id) ||
          typeof item.label !== 'string' || !Array.isArray(item.entries) ||
          !item.entries.length || item.count !== item.entries.length ||
          item.entries.some(entry => !entry || typeof entry.title !== 'string' ||
            typeof entry.desc !== 'string')) {
        throw new Error('intentionsCatalogError');
      }
      ids.add(item.id);
    }
    return catalog;
  }

  function buildSelection(catalog, selectedIds) {
    validateCatalog(catalog);
    const ids = new Set(selectedIds);
    if (!ids.size) return null;
    const items = catalog.items.filter(item => ids.has(item.id));
    if (items.length !== ids.size) throw new Error('intentionsCatalogError');
    // Preserve catalog order and each package's ordered entries.
    const entries = items.flatMap(item => item.entries);
    if (entries.length > 32) throw new Error('intentionsTooMany');
    const titles = entries.map(entry => entry.title);
    const model = {
      numIntentions: entries.length,
      iS: titles.join('\n'),
      titles,
      descs: entries.map(entry => entry.desc),
    };
    const data = global.IntentionsNVS.buildIntentionsBin(model);
    return { model, data, filename: 'nvs-intentions-selection.bin',
      label: items.map(item => item.label).join(' + ') };
  }

  global.IntentionsCatalog = { url, validateCatalog, buildSelection };
})(window);
