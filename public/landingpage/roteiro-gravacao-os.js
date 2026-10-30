// Roteiro temporário para colar no console do Chrome na tela real de detalhes de uma OS de teste.
// A demonstração apenas altera visualmente os campos; não salva, não aciona o microfone e não grava áudio.
(() => {
  if (!/^\/os\/detalhes\//.test(location.pathname)) {
    console.error('Abra primeiro os detalhes de uma OS de teste com veículo.');
    return;
  }
  const main = document.querySelector('main.overflow-y-auto');
  const heading = [...document.querySelectorAll('h3')].find((el) => el.textContent.includes('Laudo Técnico'));
  const card = heading?.parentElement;
  const fields = card?.querySelectorAll('textarea');
  if (!main || !card || !fields || fields.length < 2) {
    console.error('Não encontrei o laudo. Abra uma OS de teste com veículo e aguarde a tela carregar.');
    return;
  }
  if ([...fields].some((field) => field.value.trim())) {
    console.error('Para evitar cobrir informações existentes, use uma OS de teste com os dois campos do laudo vazios.');
    return;
  }
  if (window.__pararGravacaoOs) window.__pararGravacaoOs();
  let stopped = false;
  const original = [...fields].map((field) => field.value);
  const nativeValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const animateScroll = (start, end, duration) => new Promise((resolve) => {
    const began = performance.now();
    const tick = (now) => {
      if (stopped) return resolve();
      const t = Math.min(1, (now - began) / duration);
      const eased = t * t * (3 - 2 * t);
      main.scrollTop = start + (end - start) * eased;
      if (t < 1) requestAnimationFrame(tick); else resolve();
    };
    requestAnimationFrame(tick);
  });
  const type = async (field, text) => {
    field.focus({ preventScroll: true });
    for (let i = 1; i <= text.length && !stopped; i++) {
      nativeValue.call(field, text.slice(0, i));
      await sleep(34);
    }
    field.blur();
  };
  window.__pararGravacaoOs = () => {
    stopped = true;
    fields.forEach((field, index) => nativeValue.call(field, original[index]));
    delete window.__pararGravacaoOs;
    console.info('Demonstração encerrada. Os campos visuais foram restaurados.');
  };
  main.scrollTop = 0;
  console.info('Demonstração começa em 5 segundos. Feche o console e inicie a gravação. Para cancelar: window.__pararGravacaoOs()');
  (async () => {
    await sleep(5000);
    if (stopped) return;
    const top = main.scrollTop + card.getBoundingClientRect().top - main.getBoundingClientRect().top;
    const destination = Math.max(0, Math.min(main.scrollHeight - main.clientHeight, top - Math.max(24, (main.clientHeight - card.offsetHeight) / 2)));
    await animateScroll(main.scrollTop, destination, 4500);
    await sleep(1200);
    if (!stopped) await type(fields[0], 'Bateria descarregada e terminais oxidados.');
    await sleep(1000);
    if (!stopped) await type(fields[1], 'Substituir a bateria e limpar os terminais.');
    if (!stopped) console.info('Demonstração concluída. Os textos são apenas visuais e não foram salvos. Recarregue a página para descartá-los.');
  })();
})();
