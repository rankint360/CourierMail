const notice = document.querySelector('#ds-toast');
let timeout;
function show(message) {
  clearTimeout(timeout);
  notice.textContent = message;
  notice.classList.add('is-visible');
  timeout = setTimeout(() => notice.classList.remove('is-visible'), 3500);
}
document.addEventListener('click', async event => {
  const swatch = event.target.closest('[data-copy]');
  if (swatch) {
    try { await navigator.clipboard.writeText(swatch.dataset.copy); show(`${swatch.dataset.copy} copied.`); }
    catch { show(`Color value: ${swatch.dataset.copy}`); }
  }
  const demo = event.target.closest('[data-demo]');
  if (demo) show(demo.dataset.demo);
});
document.querySelector('#ds-form').addEventListener('submit', event => {
  event.preventDefault();
  show('Component preview only. Your information was not submitted.');
});
