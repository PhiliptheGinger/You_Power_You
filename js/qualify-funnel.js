let currentScreen = 1;
let selectedUpgrades = [];
let currentTestimonial = 0;
let savingsChart;

function showScreen(index) {
  document.querySelector(`#screen${currentScreen}`).classList.add('hidden');
  currentScreen = index;
  const screen = document.querySelector(`#screen${currentScreen}`);
  screen.classList.remove('hidden');
  screen.classList.add('fade-in');
  updateProgressBar();
}

function nextScreen() {
  showScreen(currentScreen + 1);
}

function prevScreen() {
  if (currentScreen > 1) {
    showScreen(currentScreen - 1);
  }
}

function updateProgressBar() {
  const progress = (currentScreen / 7) * 100;
  document.getElementById('progressBar').style.width = progress + '%';
  document.getElementById('currentStep').textContent = currentScreen;
}

function showTooltip(id) {
  const tooltip = document.getElementById(id);
  tooltip.classList.toggle('show');
  document.querySelectorAll('.tooltip').forEach(t => {
    if (t.id !== id) t.classList.remove('show');
  });
}

function updateProgress() {
  document.querySelectorAll('.qualification-question').forEach((question, index) => {
    const inputs = question.querySelectorAll('input[type="radio"]');
    const isAnswered = Array.from(inputs).some(input => input.checked);
    const checkmark = document.getElementById(`check${index + 1}`);
    if (isAnswered) {
      checkmark.classList.remove('bg-gray-300');
      checkmark.classList.add('bg-brandGreen', 'slide-in');
    }
  });
}

function toggleUpgrade(element, upgrade) {
  element.classList.toggle('selected');
  const pressed = element.classList.contains('selected');
  element.setAttribute('aria-pressed', pressed);
  if (selectedUpgrades.includes(upgrade)) {
    selectedUpgrades = selectedUpgrades.filter(u => u !== upgrade);
  } else {
    selectedUpgrades.push(upgrade);
  }
  if (upgrade === 'other') {
    const otherInput = document.getElementById('otherUpgradeInput');
    pressed ? otherInput.classList.remove('hidden') : otherInput.classList.add('hidden');
  }
}

function calculateSavings() {
  const bill = parseFloat(document.getElementById('monthlyBill').value);
  const rate = parseFloat(document.getElementById('rateIncrease').value) / 100 || 0;
  const years = Array.from({ length: 20 }, (_, i) => i + 1);
  let duke = [];
  let solar = [];
  let dukeTotal = 0;
  let solarTotal = 0;
  years.forEach((year, i) => {
    const annualBill = bill * 12 * Math.pow(1 + rate, i);
    dukeTotal += annualBill;
    duke.push(Math.round(dukeTotal));
    const solarAnnual = bill * 12 * 0.2;
    solarTotal += solarAnnual;
    solar.push(Math.round(solarTotal));
  });
  const savings = duke[duke.length - 1] - solar[solar.length - 1];
  const ctx = document.getElementById('savingsChart').getContext('2d');
  if (savingsChart) savingsChart.destroy();
  savingsChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: years,
      datasets: [
        { label: 'Duke Energy', data: duke, borderColor: '#EF4444', fill: false },
        { label: 'Solar', data: solar, borderColor: '#2c5530', fill: false }
      ]
    },
    options: {
      responsive: true,
      scales: {
        x: { title: { display: true, text: 'Years' } },
        y: { title: { display: true, text: 'Cumulative Cost ($)' } }
      }
    }
  });
  document.getElementById('savingsNote').textContent = `Estimated 20-year savings: $${savings.toLocaleString()}`;
  document.getElementById('savingsForm').classList.add('hidden');
  document.getElementById('savingsResult').classList.remove('hidden');
}

function showTestimonial(index) {
  const testimonials = document.querySelectorAll('.testimonial');
  const buttons = document.querySelectorAll('.testimonial-btn');
  testimonials.forEach((t, i) => {
    if (i === index) {
      t.classList.remove('hidden');
    } else {
      t.classList.add('hidden');
    }
  });
  buttons.forEach((b, i) => {
    b.classList.toggle('bg-brandBlue', i === index);
    b.classList.toggle('bg-gray-300', i !== index);
  });
  currentTestimonial = index;
}

function restartFunnel() {
  currentScreen = 1;
  document.querySelectorAll('.screen').forEach(screen => screen.classList.add('hidden'));
  document.getElementById('screen1').classList.remove('hidden');
  updateProgressBar();
  document.querySelectorAll('form').forEach(form => form.reset());
  selectedUpgrades = [];
  document.querySelectorAll('.upgrade-icon').forEach(icon => {
    icon.classList.remove('selected');
    icon.setAttribute('aria-pressed', 'false');
  });
  document.querySelectorAll('.tooltip').forEach(t => t.classList.remove('show'));
  document.getElementById('savingsResult').classList.add('hidden');
  document.getElementById('savingsForm').classList.remove('hidden');
  if (savingsChart) savingsChart.destroy();
}

// Event bindings

document.addEventListener('DOMContentLoaded', () => {
  updateProgressBar();

  document.getElementById('startBtn').addEventListener('click', nextScreen);
  document.querySelectorAll('.back-btn').forEach(btn => btn.addEventListener('click', prevScreen));
  document.getElementById('restartBtn').addEventListener('click', restartFunnel);

  document.getElementById('homeownerForm').addEventListener('submit', e => { e.preventDefault(); nextScreen(); });
  document.getElementById('qualificationForm').addEventListener('submit', e => { e.preventDefault(); nextScreen(); });
  document.getElementById('upgradesForm').addEventListener('submit', e => { e.preventDefault(); nextScreen(); });
  document.getElementById('schedulingForm').addEventListener('submit', e => { e.preventDefault(); nextScreen(); });
  document.getElementById('savingsForm').addEventListener('submit', e => { e.preventDefault(); calculateSavings(); });
  document.getElementById('skipCalc').addEventListener('click', nextScreen);
  document.getElementById('calcContinue').addEventListener('click', nextScreen);
  document.getElementById('recalc').addEventListener('click', () => {
    document.getElementById('savingsResult').classList.add('hidden');
    document.getElementById('savingsForm').classList.remove('hidden');
  });

  document.querySelectorAll('#qualificationForm input[type="radio"]').forEach(input => {
    input.addEventListener('change', updateProgress);
  });

  document.querySelectorAll('.tooltip-btn').forEach(btn => {
    btn.addEventListener('click', () => showTooltip(btn.dataset.target));
  });

  document.querySelectorAll('.upgrade-icon').forEach(icon => {
    icon.addEventListener('click', () => toggleUpgrade(icon, icon.dataset.upgrade));
  });

  document.querySelectorAll('.testimonial-btn').forEach(btn => {
    btn.addEventListener('click', () => showTestimonial(parseInt(btn.dataset.index, 10)));
  });

  setInterval(() => {
    const nextIndex = (currentTestimonial + 1) % 3;
    showTestimonial(nextIndex);
  }, 5000);
});
