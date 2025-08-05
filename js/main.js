const form = document.querySelector(".contact-form");
if (form) {
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    alert("Thanks for reaching out! We will contact you soon.");
    form.reset();
  });
}

  const hamburger = document.querySelector(".hamburger");
  const navLinks = document.querySelector(".nav-links");
  if (hamburger && navLinks) {
    hamburger.addEventListener("click", () => {
      const expanded = hamburger.getAttribute("aria-expanded") === "true";
      hamburger.setAttribute("aria-expanded", String(!expanded));
      navLinks.classList.toggle("active");
    });
  }

  const estimator = document.querySelector(".estimator-form");
  if (estimator) {
    estimator.addEventListener("submit", (e) => {
      e.preventDefault();
      const bill = parseFloat(document.getElementById("bill").value);
      const zip = document.getElementById("zip").value.trim();
      if (!isNaN(bill) && zip) {
        const monthly = bill * 0.25;
        const yearly = monthly * 12;
        const result = document.getElementById("savings-result");
        if (result) {
          result.textContent = `Homes in ${zip} could save about $${monthly.toFixed(0)} per month (~$${yearly.toFixed(0)} per year).`;
        }
      }
    });
  }

  const quiz = document.getElementById("quiz-form");
  if (quiz) {
    const steps = quiz.querySelectorAll(".step");
    let current = 0;

    const showStep = (index) => {
      steps[current].classList.remove("active");
      current = index;
      steps[current].classList.add("active");
    };

    quiz.querySelectorAll(".next").forEach((btn) => {
      btn.addEventListener("click", () => {
        const input = steps[current].querySelector("input, select");
        if (!input || input.reportValidity()) {
          showStep(Math.min(current + 1, steps.length - 1));
        }
      });
    });

    quiz.addEventListener("submit", (e) => {
      e.preventDefault();
      window.location.href = "thankyou.html";
    });
  }
});
