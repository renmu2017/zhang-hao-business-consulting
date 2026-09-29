const header = document.querySelector("[data-header]");
const year = document.querySelector("[data-year]");
const toast = document.querySelector("[data-toast]");
const copyButtons = document.querySelectorAll("[data-copy]");
const revealItems = document.querySelectorAll(".reveal");
const parallax = document.querySelector("[data-parallax]");

if (year) year.textContent = new Date().getFullYear();

const syncHeader = () => {
  header?.classList.toggle("is-scrolled", window.scrollY > 16);
};

syncHeader();
window.addEventListener("scroll", syncHeader, { passive: true });

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.13 }
  );

  revealItems.forEach((item) => observer.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("is-visible"));
}

let toastTimer;
const showToast = (message) => {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 1800);
};

copyButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    const value = button.dataset.copy;
    const label = button.querySelector("[data-copy-label]");

    try {
      await navigator.clipboard.writeText(value);
      if (label) label.textContent = "已复制";
      showToast("微信号已复制");
      setTimeout(() => {
        if (label) label.textContent = "复制微信号";
      }, 1800);
    } catch {
      showToast(`请复制：${value}`);
    }
  });
});

const finePointer = window.matchMedia("(pointer: fine)");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

if (parallax && finePointer.matches && !reducedMotion.matches) {
  parallax.addEventListener("pointermove", (event) => {
    const rect = parallax.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    parallax.style.transform = `perspective(1000px) rotateX(${-y * 2.4}deg) rotateY(${x * 3.2}deg)`;
  });

  parallax.addEventListener("pointerleave", () => {
    parallax.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg)";
  });
}

