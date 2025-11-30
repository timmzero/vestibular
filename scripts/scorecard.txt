const formEl = document.getElementById('scorecard-form');
const resultEl = document.getElementById('scorecard-result');
const ctaEl = document.getElementById('contact-cta');

if (formEl) {
  formEl.addEventListener('submit', function(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const scores = Array.from(formData.values()).map(Number);
    const total = scores.reduce((a, b) => a + b, 0);

    let stage = 'Foundational';

    if (total >= 27) {
      stage = 'Optimizing'; // Stage 5 — rare, only near-perfect scores
    } else if (total >= 22) {
      stage = 'Scaling';    // Stage 4
    } else if (total >= 17) {
      stage = 'Enabled';    // Stage 3
    } else if (total >= 12) {
      stage = 'Emerging';   // Stage 2
    } else {
      stage = 'Foundational'; // Stage 1
    }

    const resultText = `Total Score: ${total} → Maturity Stage: ${stage}`;
    if (resultEl) resultEl.innerText = resultText;

    if (ctaEl) ctaEl.style.display = 'block';

    // Pre-fill if contact page is loaded in same DOM (optional, keeps localStorage as primary handoff)
    const hiddenField = document.getElementById('scorecard-hidden');
    if (hiddenField) hiddenField.value = resultText;

    localStorage.setItem('scorecardResult', resultText);
  });
}

if (ctaEl) {
  ctaEl.addEventListener('click', () => {
    window.location.href = 'contact.html';
  });
}
