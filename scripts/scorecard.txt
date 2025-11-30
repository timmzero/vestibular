const formEl = document.getElementById('scorecard-form');
const resultEl = document.getElementById('scorecard-result');
const ctaEl = document.getElementById('contact-cta');

if (formEl) {
  formEl.addEventListener('submit', function(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const scores = Array.from(formData.values()).map(Number);
    const overall = scores.reduce((a, b) => a + b, 0) / scores.length;

    let stage = 'Emerging';
    if (overall >= 4) stage = 'Mature';
    else if (overall >= 3) stage = 'Developing';

    const resultText = `Overall Score: ${overall.toFixed(1)} → Maturity Stage: ${stage}`;
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
