let currentScreen = 1;
let selectedUpgrades = [];
let currentTestimonial = 0;

const appState = {
  annualUsageKWh: null,
  utility: 'DEC'
};

const STORAGE_KEYS = { usage: 'amp_usage_kwh_v2' };

function setUsageKWh(kwh) {
  appState.annualUsageKWh = kwh;
  try {
    if (kwh) localStorage.setItem(STORAGE_KEYS.usage, String(kwh));
    else localStorage.removeItem(STORAGE_KEYS.usage);
  } catch {}
}

function getUsageKWh() {
  try {
    const v = Number(localStorage.getItem(STORAGE_KEYS.usage));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch { return null; }
}

const CONFIG = {
  termYears: 25,
  baseFixedFeeUsd: 25,
  offsetPct: 0.90,          // solar payment is ~90% of current bill by default
  NET_METERING_DEADLINE: new Date(new Date().getFullYear() + 1, 6, 1) // July=6 (0-indexed)
};

function recalcMonthlyFromUsage() {
  const carried = Number(document.getElementById('annualUsageKWh')?.value);
  if (!Number.isFinite(carried) || carried <= 0) return;

  const inputBill = document.getElementById('monthlyBill');
  const estRate = 0.14;
  const monthlyFromUsage = Math.round((carried * estRate) / 12 + CONFIG.baseFixedFeeUsd);

  setUsageKWh(carried);
  inputBill.value = monthlyFromUsage;
  inputBill.readOnly = true;
  inputBill.setAttribute('aria-readonly', 'true');
  inputBill.classList.add('bg-gray-50');

  inputBill.parentElement.querySelectorAll('.seed-note').forEach(n => n.remove());
  const helper = document.createElement('p');
  helper.className = 'seed-note text-xs text-gray-500 mt-1';
  helper.textContent = `Calculated from your 12-month usage: ~$${monthlyFromUsage}/mo (at $${estRate.toFixed(2)}/kWh + $${CONFIG.baseFixedFeeUsd} fixed).`;
  inputBill.parentElement.appendChild(helper);
}

function showScreen(index) {
  document.querySelector(`#screen${currentScreen}`).classList.add('hidden');
  currentScreen = index;
  const screen = document.querySelector(`#screen${currentScreen}`);
  screen.classList.remove('hidden');
  screen.classList.add('fade-in');
  updateProgressBar();
  if (index === 5) recalcMonthlyFromUsage();
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

// ===== Long-term (annual) series comparing utility trend vs. flat rates =====
function buildSeries(startMonthly, utility = 'DEC') {
  const hikes = (DUKE_RATE_SCHEDULE[utility] || []).map(h => ({ ym: parseYM(h.effective), pct: h.pct }));
  hikes.sort((a, b) => a.ym - b.ym);

  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);

  const months = [];
  let cur = new Date(start);
  let monthly = startMonthly;
  let lastHikeIndexApplied = -1;

  const flatMonthly = startMonthly;

  for (let i = 0; i < HORIZON_YEARS * 12; i++) {
    const curYM = ym(cur);
    for (let j = lastHikeIndexApplied + 1; j < hikes.length; j++) {
      if (hikes[j].ym === curYM) {
        monthly *= (1 + hikes[j].pct);
        lastHikeIndexApplied = j;
      } else if (hikes[j].ym > curYM) { break; }
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

  const years = []; const trend = []; const flat = [];

  for (let y = 1; y <= HORIZON_YEARS; y++) {
    years.push(y);
    const startIdx = (y - 1) * 12;
    const slice = months.slice(startIdx, startIdx + 12);

    const yearTrend = slice.reduce((s, m) => s + m.utilityTrendMonthly, 0);
    const yearFlat = slice.reduce((s, m) => s + m.utilityFlatMonthly, 0);

    trend.push(yearTrend);
    flat.push(yearFlat);
  }

  return { years, trend, flat };
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

  recalcMonthlyFromUsage();

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
    const minY = Math.min(...series.util) * 0.9;
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
          y: { title: { display: true, text: 'Monthly Cost ($)' }, min: minY },
          x: { title: { display: true, text: 'Month' } }
        }
      }
    });

    deadlineNote.textContent = `Heads up: the program is set to end after ${deadline.toLocaleDateString()}.`;
  }

  function renderLongTermChart(series) {
    destroyChart(longChart);

    const { years, trend, flat } = series;

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
            pointRadius: ctx => ([4,9,14,19].includes(ctx.dataIndex) ? 4 : 0),
            pointBackgroundColor: '#2c5530'
          },
          {
            label: 'Utility (flat rates)',
            data: flat,
            fill: true,
            borderColor: '#ff914d',
            backgroundColor: 'rgba(255,145,77,0.15)',
            tension: 0.25,
            borderWidth: 2,
            pointRadius: ctx => ([4,9,14,19].includes(ctx.dataIndex) ? 3 : 0),
            pointBackgroundColor: '#ff914d'
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
    const carried = appState.annualUsageKWh ?? getUsageKWh();
    if (!carried) { showScreen(3); return; }
    const estRate = 0.14;
    const monthly = (carried * estRate) / 12 + CONFIG.baseFixedFeeUsd;

    const today = new Date();

    resultWrap.classList.remove('hidden');
    form.classList.add('hidden');

    const nearSeries = buildNearTermMonthlySeries(monthly, appState.utility, today);
    renderNearTermChart(nearSeries);

    const longSeries = buildSeries(monthly, appState.utility);
    renderLongTermChart(longSeries);

    const assumedMonthlySolar = Math.round(monthly * CONFIG.offsetPct + CONFIG.baseFixedFeeUsd);
    const totalTrend = longSeries.trend.reduce((a, b) => a + b, 0);
    const totalFlat = longSeries.flat.reduce((a, b) => a + b, 0);
    const delta = totalTrend - totalFlat;
    note.textContent = `Assuming flat solar payment ≈ ${formatCurrency(assumedMonthlySolar)} / month; 20‑yr exposure difference (utility trend vs. utility flat): ${formatCurrency(delta)}.`;
    note.classList.remove('hidden');
  }

  form.addEventListener('submit', (e) => { e.preventDefault(); handleSubmit(); });

  skipBtn.addEventListener('click', () => showScreen(7));

  recalcBtn.addEventListener('click', () => {
    resultWrap.classList.add('hidden');
    form.classList.remove('hidden');
  });

  continueBtn.addEventListener('click', () => showScreen(6));

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
  setUsageKWh(null);
  const bill = document.getElementById('monthlyBill');
  if (bill) {
    bill.readOnly = false;
    bill.removeAttribute('aria-readonly');
    bill.classList.remove('bg-gray-50');
    bill.value = '';
    bill.parentElement.querySelectorAll('.seed-note').forEach(n => n.remove());
  }
}

// Event bindings

document.addEventListener('DOMContentLoaded', () => {
  updateProgressBar();
  const usage3 = document.getElementById('annualUsageKWh');
  const savedUsage = getUsageKWh();
  if (usage3) {
    if (savedUsage && !usage3.value) usage3.value = savedUsage;
    if (savedUsage) appState.annualUsageKWh = savedUsage;
    usage3.addEventListener('input', () => {
      const v = Number(usage3.value);
      setUsageKWh(Number.isFinite(v) && v > 0 ? v : null);
    });
  }

  document.getElementById('startBtn').addEventListener('click', nextScreen);
  document.querySelectorAll('.back-btn').forEach(btn => btn.addEventListener('click', prevScreen));
  document.getElementById('restartBtn').addEventListener('click', restartQualifier);

  document.getElementById('homeownerForm').addEventListener('submit', e => {
    e.preventDefault();
    const f = e.currentTarget;
    if (f.reportValidity()) nextScreen();
  });
  document.getElementById('qualificationForm').addEventListener('submit', e => {
    e.preventDefault();
    const f = e.currentTarget;
    if (!f.reportValidity()) return;
    const v = Number(document.getElementById('annualUsageKWh').value);
    setUsageKWh(Number.isFinite(v) && v > 0 ? v : null);
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
