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

      // Close mobile nav on Escape
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && nav.classList.contains('open')) {
          closeMenu();
          toggle.focus();
        }
      });

      // Highlight active nav link
      const currentPath = window.location.pathname.split('/').pop() || 'index.html';
      nav.querySelectorAll('a').forEach(link => {
        const linkPath = link.getAttribute('href');
        if (linkPath === currentPath || (currentPath === '' && linkPath === 'index.html')) {
          link.classList.add('active');
          link.setAttribute('aria-current', 'page');
        }
      });
    })
    .catch(err => console.error("Nav load failed:", err));
});
