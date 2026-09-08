/* Audio package selection shared by the USB and BLE pickers. */
(() => {
  const backendOf = item => item.backend || 'chatterbox';
  const speakerOf = item => item.speakerId || item.id.replace(/^[^-]+-/, '').replace(/-omnivoice$/, '');
  function select(items, backend, previousId, language) {
    const available = items.filter(item => backendOf(item) === backend);
    const previous = items.find(item => item.id === previousId);
    const lang = previous?.language || language;
    const speaker = previous ? speakerOf(previous) : 'seraphina';
    return available.find(item => item.id === previousId)
      || available.find(item => item.language === lang && speakerOf(item) === speaker)
      || available.find(item => item.language === lang)
      || available[0] || null;
  }
  window.AudioCatalog = { backendOf, select };
})();
