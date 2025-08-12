let currentScreen = 1;
let selectedUpgrades = [];
let currentTestimonial = 0;

const appState = {
  annualUsageKWh: null,
  utility: 'DEC'
}

const CONFIG = {
  termYears: 25,
  baseFixedFeeUsd: 25,
  fixedEscalationPct: 0.02, // used only if the solar escalator toggle is ON
  offsetPct: 0.90,          // solar payment is ~90% of current bill by default
  NET_METERING_DEADLINE: new Date(new Date().getFullYear() + 1, 6, 1) // July=6 (0-indexed)
};

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
  const totalScreens = 7;
  const progress = (currentScreen / totalScreens) * 100;
  const bar = document.getElementById('progressBar');
  bar.style.width = progress + '%';
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
// ---- Savings Calculator with solar comparison and near‑term projection ----
// Duke Energy Carolinas (example schedule — add/adjust as needed)
const DUKE_RATE_SCHEDULE = {
  DEC: [
    { effective: '2025-01', pct: 0.083 },
    { effective: '2026-01', pct: 0.033 },
    { effective: '2027-01', pct: 0.031 },
  ],
  DEP: []
};

const POST_TREND = 0.03; // 3%/yr beyond last known hike
const HORIZON_YEARS = 20;

function ym(date) { return date.getFullYear() * 100 + date.getMonth(); }
function parseYM(s) { const [Y, M] = s.split('-').map(Number); return (Y * 100) + (M - 1); }

// ===== Monthly bill inference =====
// Accepts monthly dollars, annual dollars (>1000), or carried yearly kWh.
function inferMonthlyBill({ monthlyInput, carriedAnnualKWh }) {
  let bill = Number(monthlyInput);
  if (bill && bill > 1000) bill = bill / 12; // annual $ mistakenly entered

  if ((!bill || bill < 10) && carriedAnnualKWh && carriedAnnualKWh > 100) {
    const estRate = 0.14; // default $/kWh guess
    bill = (carriedAnnualKWh * estRate) / 12 + CONFIG.baseFixedFeeUsd;
  }
  return (bill && bill >= 10) ? bill : null;
}

// ===== Long-term (annual) series with optional solar flat/escalator =====
function buildSeriesWithSolar_dateBased(startMonthly, solarStartsAtMonthIndex, useSolarEscalator, utility = 'DEC') {
  const hikes = (DUKE_RATE_SCHEDULE[utility] || []).map(h => ({ ym: parseYM(h.effective), pct: h.pct }));
  hikes.sort((a, b) => a.ym - b.ym);

  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(start.getFullYear() + HORIZON_YEARS, start.getMonth(), 1);

  const months = [];
  let cur = new Date(start);
  let monthly = startMonthly;
  let lastHikeIndexApplied = -1;

  const flatMonthly = startMonthly;

  while (cur <= end) {
    const curYM = ym(cur);
    for (let i = lastHikeIndexApplied + 1; i < hikes.length; i++) {
      if (hikes[i].ym === curYM) {
        monthly *= (1 + hikes[i].pct);
        lastHikeIndexApplied = i;
      } else if (hikes[i].ym > curYM) { break; }
    }
    if (lastHikeIndexApplied === hikes.length - 1 && hikes.length > 0) {
      monthly = monthly * Math.pow(1 + POST_TREND, 1/12);
    }

    months.push({
      date: new Date(cur),
      utilityTrendMonthly: monthly,
      utilityFlatMonthly: flatMonthly
    });

    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }

  const years = []; const trend = []; const flat = []; const solar = [];
  const baseMonthlySolar = startMonthly * CONFIG.offsetPct + CONFIG.baseFixedFeeUsd;
  const solarStartYear = Math.floor(solarStartsAtMonthIndex / 12);

  for (let y = 0; y <= HORIZON_YEARS; y++) {
    years.push(y);
    const startIdx = y * 12;
    const endIdx = Math.min(startIdx + 12, months.length);
    const slice = months.slice(startIdx, endIdx);

    const yearTrend = slice.reduce((s, m) => s + m.utilityTrendMonthly, 0);
    const yearFlat = slice.reduce((s, m) => s + m.utilityFlatMonthly, 0);

    trend.push(yearTrend);
    flat.push(yearFlat);

    if (y < solarStartYear) {
      solar.push(null);
    } else {
      const yearsSince = y - solarStartYear;
      const monthlySolar = useSolarEscalator
        ? baseMonthlySolar * Math.pow(1 + CONFIG.fixedEscalationPct, Math.max(0, yearsSince))
        : baseMonthlySolar;
      solar.push(monthlySolar * 12);
    }
  }

  return { years, trend, flat, solar };
}

// ===== Near-term (month-by-month) projection up to deadline (or ~18 months) =====
function buildNearTermMonthlySeries(startMonthly, utility = 'DEC', today = new Date()) {
  const hikes = (DUKE_RATE_SCHEDULE[utility] || []).map(h => ({ ym: parseYM(h.effective), pct: h.pct }));
  hikes.sort((a, b) => a.ym - b.ym);

  const labels = [];
  const months = [];
  const util = [];

  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const deadline = CONFIG.NET_METERING_DEADLINE;
  const end = new Date(Math.max(deadline, new Date(start.getFullYear(), start.getMonth() + 18, 1)));

  let cur = new Date(start);
  let monthly = startMonthly;
  let lastHikeIndexApplied = -1;

  while (cur <= end) {
    const curYM = ym(cur);

    for (let i = lastHikeIndexApplied + 1; i < hikes.length; i++) {
      if (hikes[i].ym === curYM) {
        monthly *= (1 + hikes[i].pct);
        lastHikeIndexApplied = i;
      } else if (hikes[i].ym > curYM) {
        break;
      }
    }

    if (lastHikeIndexApplied === hikes.length - 1 && hikes.length > 0) {
      monthly = monthly * Math.pow(1 + POST_TREND, 1/12);
    }

    months.push(new Date(cur));
    util.push(monthly);
    labels.push(cur.toLocaleString(undefined, { month: 'short', year: '2-digit' }));

    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }

  return { months, labels, util, deadline };
}

function formatCurrency(v) {
  return '$' + Math.round(v).toLocaleString();
}

(function initSavings() {
  const form = document.getElementById('savingsForm');
  const inputBill = document.getElementById('monthlyBill');
  const installMonthInput = document.getElementById('installMonth');
  const useEscalatorInput = document.getElementById('solarEscalator');

  const resultWrap = document.getElementById('savingsResult');
  const note = document.getElementById('savingsNote');
  const deadlineNote = document.getElementById('deadlineNote');

  const recalcBtn = document.getElementById('recalc');
  const continueBtn = document.getElementById('calcContinue');
  const skipBtn = document.getElementById('skipCalc');

  const nearCtx = document.getElementById('nearTermChart').getContext('2d');
  const longCtx = document.getElementById('savingsChart').getContext('2d');

  let nearChart, longChart;

  function destroyChart(chart) { if (chart) chart.destroy(); }

  function renderNearTermChart(series) {
    destroyChart(nearChart);

    const deadline = CONFIG.NET_METERING_DEADLINE;
    const deadlineIndex = series.months.findIndex(d =>
      d.getFullYear() === deadline.getFullYear() && d.getMonth() === deadline.getMonth()
    );

    nearChart = new Chart(nearCtx, {
      type: 'line',
      data: {
        labels: series.labels,
        datasets: [{
          label: 'Projected utility bill (per month)',
          data: series.util,
          fill: 'origin',
          borderColor: '#2c5530',
          backgroundColor: 'rgba(44,85,48,0.18)',
          tension: 0.25,
          borderWidth: 2,
          pointRadius: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          tooltip: { callbacks: { label: tt => `${tt.dataset.label}: ${formatCurrency(tt.parsed.y)}` } },
          annotation: {
            annotations: deadlineIndex >= 0 ? {
              deadline_line: {
                type: 'line',
                xMin: deadlineIndex,
                xMax: deadlineIndex,
                borderColor: 'rgba(255,145,77,0.8)',
                borderWidth: 2,
                label: {
                  enabled: true,
                  content: `Net‑metering ends ${deadline.toLocaleDateString()}`,
                  position: 'start',
                  backgroundColor: 'rgba(255,145,77,0.12)',
                  color: '#ff914d',
                  font: { weight: '600' }
                }
              }
            } : {}
          }
        },
        scales: {
          y: { title: { display: true, text: 'Monthly Cost ($)' }, beginAtZero: true },
          x: { title: { display: true, text: 'Month' } }
        }
      }
    });

    deadlineNote.textContent = `Heads up: the program is set to end after ${deadline.toLocaleDateString()}.`;
  }

  function renderLongTermChart(series) {
    destroyChart(longChart);

    const { years, trend, flat, solar } = series;

    const totalTrend = trend.reduce((a, b) => a + b, 0);
    const totalFlat = flat.reduce((a, b) => a + b, 0);
    const delta = totalTrend - totalFlat;
    note.textContent = `20‑year exposure difference (trend vs. flat utility): ${formatCurrency(delta)}.`;

    longChart = new Chart(longCtx, {
      type: 'line',
      data: {
        labels: years,
        datasets: [
          {
            label: 'Utility (current trend)',
            data: trend,
            fill: 'origin',
            borderColor: '#2c5530',
            backgroundColor: 'rgba(44,85,48,0.18)',
            tension: 0.25,
            borderWidth: 2,
            pointRadius: ctx => ([5,10,15,20].includes(ctx.dataIndex) ? 4 : 0),
            pointBackgroundColor: '#2c5530'
          },
          {
            label: 'Utility (never raises rates again)',
            data: flat,
            fill: true,
            borderColor: '#ff914d',
            backgroundColor: 'rgba(255,145,77,0.15)',
            tension: 0.25,
            borderWidth: 2,
            pointRadius: ctx => ([5,10,15,20].includes(ctx.dataIndex) ? 3 : 0),
            pointBackgroundColor: '#ff914d'
          },
          {
            label: 'Solar payment',
            data: solar,
            fill: false,
            borderColor: '#1d4ed8',
            backgroundColor: 'rgba(29,78,216,0.12)',
            tension: 0.15,
            borderWidth: 2,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          tooltip: { callbacks: { label: tt => `${tt.dataset.label}: ${formatCurrency(tt.parsed.y)} / yr` } },
          annotation: {
            annotations: {
              inflect_1: { type: 'line', xMin: 1, xMax: 1, borderColor: 'rgba(44,85,48,0.25)', borderWidth: 2 },
              inflect_2: { type: 'line', xMin: 2, xMax: 2, borderColor: 'rgba(44,85,48,0.25)', borderWidth: 2, borderDash: [4,4] },
              inflect_3: { type: 'line', xMin: 3, xMax: 3, borderColor: 'rgba(44,85,48,0.25)', borderWidth: 2, borderDash: [4,4] }
            }
          }
        },
        scales: {
          x: { title: { display: true, text: 'Years' } },
          y: { title: { display: true, text: 'Annual Cost ($)' }, beginAtZero: true }
        }
      }
    });
  }

  function handleSubmit() {
    const monthlyInput = Number(inputBill.value);
    const monthly = inferMonthlyBill({
      monthlyInput,
      carriedAnnualKWh: appState.annualUsageKWh
    });
    if (!monthly) return;

    const today = new Date();
    let solarStartIndex = 0;
    if (installMonthInput.value) {
      const [y, m] = installMonthInput.value.split('-').map(Number);
      const when = new Date(y, m - 1, 1);
      const diffMonths = (when.getFullYear() - today.getFullYear()) * 12 + (when.getMonth() - today.getMonth());
      solarStartIndex = Math.max(0, diffMonths);
    }

    const useEscalator = !!useEscalatorInput.checked;

    resultWrap.classList.remove('hidden');
    form.classList.add('hidden');

    const nearSeries = buildNearTermMonthlySeries(monthly, appState.utility, today);
    renderNearTermChart(nearSeries);

    const longSeries = buildSeriesWithSolar_dateBased(monthly, solarStartIndex, useEscalator, appState.utility);
    renderLongTermChart(longSeries);

    const assumedMonthlySolar = Math.round(monthly * CONFIG.offsetPct + CONFIG.baseFixedFeeUsd);
    const totalTrend = longSeries.trend.reduce((a, b) => a + b, 0);
    const totalFlat = longSeries.flat.reduce((a, b) => a + b, 0);
    const delta = totalTrend - totalFlat;
    note.textContent = `Assuming flat solar payment ≈ ${formatCurrency(assumedMonthlySolar)} / month; 20‑yr exposure difference (utility trend vs. utility flat): ${formatCurrency(delta)}.`;
    note.classList.remove('hidden');
  }

  form.addEventListener('submit', (e) => { e.preventDefault(); handleSubmit(); });

  skipBtn.addEventListener('click', () => {
    inputBill.value = inputBill.value || 150;
    handleSubmit();
  });

  recalcBtn.addEventListener('click', () => {
    resultWrap.classList.add('hidden');
    form.classList.remove('hidden');
  });

  continueBtn.addEventListener('click', () => nextScreen());

})();

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
}

// Event bindings

document.addEventListener('DOMContentLoaded', () => {
  updateProgressBar();
  const usage3 = document.getElementById('annualUsageKWh');
  if (usage3) {
    usage3.addEventListener('input', () => {
      const v = Number(usage3.value);
      appState.annualUsageKWh = Number.isFinite(v) && v > 0 ? v : null;
    });
  }

  document.getElementById('startBtn').addEventListener('click', nextScreen);
  document.querySelectorAll('.back-btn').forEach(btn => btn.addEventListener('click', prevScreen));
  document.getElementById('restartBtn').addEventListener('click', restartQualifier);

  document.getElementById('homeownerForm').addEventListener('submit', e => { e.preventDefault(); nextScreen(); });
  document.getElementById('qualificationForm').addEventListener('submit', e => {
    e.preventDefault();
    if (usage3) {
      const v = Number(usage3.value);
      appState.annualUsageKWh = Number.isFinite(v) && v > 0 ? v : null;
    }
    nextScreen();
  });
  document.getElementById('upgradesForm').addEventListener('submit', e => { e.preventDefault(); nextScreen(); });
  document.getElementById('schedulingForm').addEventListener('submit', e => { e.preventDefault(); nextScreen(); });

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
