document.addEventListener('DOMContentLoaded', () => {
  fetch("/nav.html")
    .then(res => res.text())
    .then(html => {
      document.getElementById("nav-placeholder").innerHTML = html;

      const toggle = document.querySelector('.nav-toggle');
      const nav = document.querySelector('.main-nav');
      const backdrop = document.querySelector('.nav-backdrop');

      if (!toggle || !nav || !backdrop) return;

      function closeMenu() {
        nav.classList.remove('open');
        backdrop.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }

      toggle.addEventListener('click', () => {
        const isOpen = nav.classList.toggle('open');
        backdrop.classList.toggle('open');
        toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });

      backdrop.addEventListener('click', closeMenu);
    })
    .catch(err => console.error("Nav load failed:", err));
});
