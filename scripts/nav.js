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
      // The nav lists practice hubs, not every page, so a sub-page must light
      // up its parent hub. Without this map nothing highlights on Services,
      // Diagnostic or Playbook, which reads as "you are nowhere".
      const PRACTICE_HUB = {
        'services.html': 'agile.html',
        'diagnostic.html': 'agile.html',
        'playbook.html': 'agile.html',
        'ai-services.html': 'ai-transformation.html',
        'ai-playbook.html': 'ai-transformation.html',
      };

      const currentPath = window.location.pathname.split('/').pop() || 'index.html';
      const activeHref = PRACTICE_HUB[currentPath] || currentPath;

      nav.querySelectorAll('a').forEach(link => {
        const linkPath = link.getAttribute('href');
        const isActive = linkPath === activeHref
          || (currentPath === '' && linkPath === 'index.html');
        if (isActive && !link.classList.contains('cta')) {
          link.classList.add('active');
          link.setAttribute('aria-current', currentPath === linkPath ? 'page' : 'true');
        }
      });
    })
    .catch(err => console.error("Nav load failed:", err));
});
