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

      // Highlight the active nav link.
      //
      // Derived from the rendered nav rather than a hand-maintained page->hub
      // map. That map listed five sub-pages and had already drifted: ai-proof
      // and ai-readiness highlighted nothing, which reads as "you are nowhere".
      const currentPath = window.location.pathname.split('/').pop() || 'index.html';
      const currentBase = currentPath.replace(/\.html$/, '');

      let matched = null;
      nav.querySelectorAll('a').forEach(link => {
        if (link.classList.contains('cta')) return;
        const href = (link.getAttribute('href') || '').replace(/\.html$/, '');
        if (href !== currentBase) return;
        link.classList.add('active');
        link.setAttribute('aria-current', 'page');
        matched = matched || link;
      });

      // A sub-page also lights its parent, so the practice it belongs to is
      // visible at the top level.
      if (matched) {
        const parentItem = matched.closest('.has-submenu');
        const parentLink = parentItem && parentItem.querySelector(':scope > a');
        if (parentLink && parentLink !== matched) {
          parentLink.classList.add('active');
          parentLink.setAttribute('aria-current', 'true');
        }
      }
    })
    .catch(err => console.error("Nav load failed:", err));
});
