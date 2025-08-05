document.addEventListener("DOMContentLoaded", () => {
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
      if (!isNaN(bill)) {
        const yearly = bill * 12 * 0.25;
        const result = document.getElementById("savings-result");
        if (result) {
          result.textContent = `Estimated first-year savings: $${yearly.toFixed(0)}`;
        }
      }
    });
  }

  const qualify = document.querySelector(".qualify-form");
  if (qualify) {
    qualify.addEventListener("submit", (e) => {
      e.preventDefault();
      alert("Thanks! We'll review your info and follow up soon.");
      qualify.reset();
    });
  }
});
