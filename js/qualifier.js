let currentScreen = 1;
let selectedUpgrades = [];
let currentTestimonial = 0;
let progressSun;

const CONFIG = {
  termYears: 25,
  baseFixedFeeUsd: 25,
  fixedEscalationPct: 0.02,
  offsetPct: 0.90,
  rateHikeSchedule: null,
  avgRatePerKWh: 0.12
};

function showScreen(index) {
  document.querySelector(`#screen${currentScreen}`).classList.add('hidden');
  currentScreen = index;
  const screen = document.querySelector(`#screen${currentScreen}`);
  screen.classList.remove('hidden');
  screen.classList.add('fade-in');
  updateProgressBar();
  if (currentScreen === 5) prefillMonthlyFromUsage();
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
  const totalScreens = 7;
  const progress = (currentScreen / totalScreens) * 100;
  const bar = document.getElementById('progressBar');
  bar.style.width = progress + '%';
  document.getElementById('currentStep').textContent = currentScreen;

  if (progressSun) {
    const container = bar.parentElement;
    const maxLeft = container.offsetWidth - progressSun.offsetWidth;
    const ratio = (currentScreen - 1) / (totalScreens - 1);
    progressSun.style.left = maxLeft * ratio + 'px';
  }
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
// ---- Savings Calculator with rate hikes and usage markdown ----

function prefillMonthlyFromUsage() {
  const usage = Number(document.getElementById('annualUsageKWh')?.value || 0);
  const billInput = document.getElementById('monthlyBill');
  if (usage && billInput && !billInput.value) {
    const est = inferMonthlyBill(usage);
    if (est) billInput.value = Math.round(est);
  }
}

function inferMonthlyBill(annualUsageKWh) {
  if (!annualUsageKWh) return null;
  return (annualUsageKWh / 12) * CONFIG.avgRatePerKWh + CONFIG.baseFixedFeeUsd;
}

function projectNoSolarAnnuals(monthlyBill, rateIncreasePct, rateHikeSchedule, termYears) {
  const annuals = [];
  let cumulative = 1;
  for (let y = 0; y < termYears; y++) {
    const r = (rateHikeSchedule && rateHikeSchedule[y] != null)
      ? rateHikeSchedule[y] / 100
      : rateIncreasePct / 100;
    cumulative *= (1 + r);
    annuals.push(monthlyBill * 12 * cumulative);
  }
  return annuals;
}

function projectWithSolarAnnuals(opts) {
  const {
    monthlyBill,
    annualUsageKWh,
    rateIncreasePct,
    rateHikeSchedule,
    termYears,
    baseFixedFeeUsd,
    fixedEscalationPct,
    offsetPct
  } = opts;

  const withSolar = [];
  const hasUsage = !!annualUsageKWh && annualUsageKWh > 0;
  const energyPortion = hasUsage ? Math.max(monthlyBill - baseFixedFeeUsd, 0) : monthlyBill;
  let fixedYearly = hasUsage ? baseFixedFeeUsd * 12 : 0;
  let cumulativeEnergyEscalation = 1;

  for (let y = 0; y < termYears; y++) {
    const r = (rateHikeSchedule && rateHikeSchedule[y] != null)
      ? rateHikeSchedule[y] / 100
      : rateIncreasePct / 100;

    cumulativeEnergyEscalation *= (1 + r);
    const energyY = energyPortion * 12 * cumulativeEnergyEscalation;
    if (y > 0 && hasUsage) fixedYearly *= (1 + fixedEscalationPct);
    const avoidedY = energyY * offsetPct;
    const withSolarY = (energyY - avoidedY) + fixedYearly;
    withSolar.push(withSolarY);
  }

  return withSolar;
}

function computeSavingsNote(noSolarAnnuals, withSolarAnnuals, hasUsage) {
  const reduce = arr => arr.reduce((a, b) => a + b, 0);
  const totalNoSolar = reduce(noSolarAnnuals);
  const totalWith = reduce(withSolarAnnuals);
  const markdownTotal = Math.max(totalNoSolar - totalWith, 0);
  return {
    totalNoSolar,
    totalWith,
    markdownTotal,
    text: hasUsage
      ? `Projected ${CONFIG.termYears}-year markdown (avoided utility hikes): $${markdownTotal.toLocaleString()}`
      : `Projected ${CONFIG.termYears}-year markdown (avoided utility hikes): N/A (usage not provided)`
  };
}

let savingsChartInstance = null;
function renderSavingsChart(noSolar, withSolar) {
  const ctx = document.getElementById('savingsChart').getContext('2d');
  const labels = Array.from({ length: CONFIG.termYears }, (_, i) => `Year ${i + 1}`);

  if (savingsChartInstance) savingsChartInstance.destroy();

  savingsChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'No Solar', data: noSolar },
        { label: 'With Solar', data: withSolar }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        y: { ticks: { callback: v => `$${Number(v).toLocaleString()}` } }
      }
    }
  });
}

function calculateAndRender(monthlyBill, rateIncrease, annualUsageKWh) {
  const ns = projectNoSolarAnnuals(
    monthlyBill,
    rateIncrease,
    CONFIG.rateHikeSchedule,
    CONFIG.termYears
  );

  const ws = projectWithSolarAnnuals({
    monthlyBill,
    annualUsageKWh,
    rateIncreasePct: rateIncrease,
    rateHikeSchedule: CONFIG.rateHikeSchedule,
    termYears: CONFIG.termYears,
    baseFixedFeeUsd: CONFIG.baseFixedFeeUsd,
    fixedEscalationPct: CONFIG.fixedEscalationPct,
    offsetPct: CONFIG.offsetPct
  });

  renderSavingsChart(ns, ws);
  const { text } = computeSavingsNote(ns, ws, !!annualUsageKWh);
  const noteEl = document.getElementById('savingsNote');
  noteEl.textContent = text;
  noteEl.classList.remove('hidden');
  const hintEl = document.getElementById('usageHint');
  if (annualUsageKWh) hintEl.classList.add('hidden'); else hintEl.classList.remove('hidden');
  document.getElementById('savingsResult').classList.remove('hidden');
  document.getElementById('savingsForm').classList.add('hidden');
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
    b.classList.toggle('bg-brandOrange', i === index);
    b.classList.toggle('bg-gray-300', i !== index);
  });
  currentTestimonial = index;
}

function restartQualifier() {
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
  document.getElementById('savingsNote').classList.add('hidden');
  document.getElementById('usageHint').classList.add('hidden');
}

// Event bindings

document.addEventListener('DOMContentLoaded', () => {
  progressSun = document.getElementById('progressSun');
  updateProgressBar();

  document.getElementById('startBtn').addEventListener('click', nextScreen);
  document.querySelectorAll('.back-btn').forEach(btn => btn.addEventListener('click', prevScreen));
  document.getElementById('restartBtn').addEventListener('click', restartQualifier);

  document.getElementById('homeownerForm').addEventListener('submit', e => { e.preventDefault(); nextScreen(); });
  document.getElementById('qualificationForm').addEventListener('submit', e => { e.preventDefault(); nextScreen(); });
  document.getElementById('upgradesForm').addEventListener('submit', e => { e.preventDefault(); nextScreen(); });
  document.getElementById('schedulingForm').addEventListener('submit', e => { e.preventDefault(); nextScreen(); });

  const savingsForm = document.getElementById('savingsForm');
  const skipBtn = document.getElementById('skipCalc');
  const recalcBtn = document.getElementById('recalc');
  const continueBtn = document.getElementById('calcContinue');
  const noteEl = document.getElementById('savingsNote');

  savingsForm.addEventListener('submit', e => {
    e.preventDefault();
    let usage = Number(document.getElementById('annualUsageKWh')?.value || 0) || null;
    let bill = Number(document.getElementById('monthlyBill').value || 0);
    if (!bill) bill = inferMonthlyBill(usage) || 150;
    const rateIncrease = Number(document.getElementById('rateIncrease').value || 0);
    calculateAndRender(bill, rateIncrease, usage);
  });

  skipBtn.addEventListener('click', () => {
    let usage = Number(document.getElementById('annualUsageKWh')?.value || 0) || null;
    let bill = Number(document.getElementById('monthlyBill').value || 0);
    if (!bill) bill = inferMonthlyBill(usage) || 150;
    const rateIncrease = Number(document.getElementById('rateIncrease').value || 0);
    calculateAndRender(bill, rateIncrease, usage);
  });

  recalcBtn.addEventListener('click', () => {
    document.getElementById('savingsResult').classList.add('hidden');
    document.getElementById('savingsForm').classList.remove('hidden');
    noteEl.classList.add('hidden');
  });

  continueBtn.addEventListener('click', () => {
    nextScreen();
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
