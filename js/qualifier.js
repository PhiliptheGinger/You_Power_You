let currentScreen = 1;
let selectedUpgrades = [];
let currentTestimonial = 0;

const CONFIG = {
  termYears: 25,
  baseFixedFeeUsd: 25,
  fixedEscalationPct: 0.02,
  offsetPct: 0.90,
  rateHikeSchedule: null
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
// ---- Savings Calculator (NC rate path, no user-entered % needed) ----
const NC_RATE_STEPS = [
  { year: 1, pct: 0.083 },
  { year: 2, pct: 0.033 },
  { year: 3, pct: 0.031 }
];
const POST_TREND = 0.03;
const HORIZON_YEARS = 20;

function buildSeries(startMonthly) {
  const years = [];
  const trend = [];
  const flat = [];
  let monthly = startMonthly;

  for (let y = 0; y <= HORIZON_YEARS; y++) {
    years.push(y);
    flat.push(startMonthly * 12);
    if (y > 0) {
      const step = NC_RATE_STEPS.find(s => s.year === y);
      if (step) {
        monthly = monthly * (1 + step.pct);
      } else if (y > 3) {
        monthly = monthly * (1 + POST_TREND);
      }
    }
    trend.push(monthly * 12);
  }

  return { years, trend, flat };
}

function formatCurrency(v) {
  return '$' + Math.round(v).toLocaleString();
}

(function initSavings() {
  const form = document.getElementById('savingsForm');
  const inputBill = document.getElementById('monthlyBill');
  const usageInput = document.getElementById('annualUsageKWh');
  const resultWrap = document.getElementById('savingsResult');
  const note = document.getElementById('savingsNote');
  const recalcBtn = document.getElementById('recalc');
  const continueBtn = document.getElementById('calcContinue');
  const skipBtn = document.getElementById('skipCalc');
  const ctx = document.getElementById('savingsChart').getContext('2d');

  let chart;

  function buildAnnotations() {
    const ann = {};

    [1, 2, 3].forEach((yr, i) => {
      ann['inflect_' + yr] = {
        type: 'line',
        xMin: yr,
        xMax: yr,
        borderColor: 'rgba(44,85,48,0.25)',
        borderWidth: 2,
        borderDash: i === 0 ? [] : [4, 4],
        label: {
          enabled: true,
          content: `Y${yr} step`,
          position: 'start',
          backgroundColor: 'rgba(44,85,48,0.08)',
          color: '#2c5530',
          font: { weight: '600' }
        }
      };
    });

    [5, 10, 15, 20].forEach(yr => {
      ann['mark_' + yr] = {
        type: 'label',
        xValue: yr,
        yValue: 0,
        backgroundColor: 'rgba(0,0,0,0)',
        content: [`${yr}y`],
        color: '#6b7280',
        font: { size: 11 }
      };
    });

    return ann;
  }

  function renderChart(series) {
    const dataYears = series.years;
    const dataTrend = series.trend;
    const dataFlat = series.flat;

    const totalTrend = dataTrend.reduce((a, b) => a + b, 0);
    const totalFlat = dataFlat.reduce((a, b) => a + b, 0);
    const delta = totalTrend - totalFlat;
    note.textContent = `20‑year exposure difference: ${formatCurrency(delta)} (trend vs. flat).`;

    if (chart) {
      chart.destroy();
      const parent = ctx.canvas.parentNode;
      if (parent && parent.style) parent.style.height = '';
    }

    // show result container before rendering so Chart.js can size correctly
    resultWrap.classList.remove('hidden');
    // hide the form while displaying the chart
    form.classList.add('hidden');

    chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: dataYears,
        datasets: [
          {
            label: 'Current trend',
            data: dataTrend,
            fill: 'origin',
            borderColor: '#2c5530',
            backgroundColor: 'rgba(44,85,48,0.18)',
            tension: 0.25,
            borderWidth: 2,
            pointRadius: ctx => {
              const x = ctx.dataIndex;
              return (x === 5 || x === 10 || x === 15 || x === 20) ? 4 : 0;
            },
            pointBackgroundColor: '#2c5530'
          },
          {
            label: 'Assuming Duke never raises rates again',
            data: dataFlat,
            fill: true,
            borderColor: '#ff914d',
            backgroundColor: 'rgba(255,145,77,0.15)',
            tension: 0.25,
            borderWidth: 2,
            pointRadius: ctx => {
              const x = ctx.dataIndex;
              return (x === 5 || x === 10 || x === 15 || x === 20) ? 3 : 0;
            },
            pointBackgroundColor: '#ff914d'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          tooltip: {
            callbacks: {
              label: tt => `${tt.dataset.label}: ${formatCurrency(tt.parsed.y)} / yr`
            }
          },
          annotation: {
            annotations: buildAnnotations()
          }
        },
        scales: {
          x: {
            title: { display: true, text: 'Years' },
            ticks: { callback: v => v }
          },
          y: {
            title: { display: true, text: 'Annual Cost ($)' },
            beginAtZero: true
          }
        }
      }
    });
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    let bill = Number(inputBill.value);

    // Infer monthly bill if only yearly usage is provided
    if ((!bill || bill < 10) && usageInput && usageInput.value) {
      const kwhYear = Number(usageInput.value);
      if (kwhYear && kwhYear > 100) {
        const estRate = 0.14;
        const monthlyFromKwh = (kwhYear * estRate) / 12 + CONFIG.baseFixedFeeUsd;
        bill = monthlyFromKwh;
      }
    }

    // Normalize annual dollar totals to monthly
    if (bill > 1000) bill = bill / 12;

    if (!bill || bill < 10) return;

    const series = buildSeries(bill);
    renderChart(series);
  });

  if (usageInput) {
    usageInput.addEventListener('blur', () => {
      if (!inputBill.value && usageInput.value) {
        const kwhYear = Number(usageInput.value);
        if (kwhYear > 100) {
          const estRate = 0.14;
          const monthlyFromKwh = (kwhYear * estRate) / 12 + CONFIG.baseFixedFeeUsd;
          inputBill.value = Math.round(monthlyFromKwh);
        }
      }
    });
  }

  skipBtn.addEventListener('click', () => {
    const series = buildSeries(150);
    renderChart(series);
  });

  recalcBtn.addEventListener('click', () => {
    resultWrap.classList.add('hidden');
    form.classList.remove('hidden');
  });

  continueBtn.addEventListener('click', () => {
    nextScreen();
  });
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

  document.getElementById('startBtn').addEventListener('click', nextScreen);
  document.querySelectorAll('.back-btn').forEach(btn => btn.addEventListener('click', prevScreen));
  document.getElementById('restartBtn').addEventListener('click', restartQualifier);

  document.getElementById('homeownerForm').addEventListener('submit', e => { e.preventDefault(); nextScreen(); });
  document.getElementById('qualificationForm').addEventListener('submit', e => { e.preventDefault(); nextScreen(); });
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
