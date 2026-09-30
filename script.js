const header = document.querySelector("[data-header]");
const pages = [...document.querySelectorAll("main > .page")];
const pageLinks = [...document.querySelectorAll(".page-nav a")];
const toast = document.querySelector("[data-toast]");
document.querySelectorAll("[data-year]").forEach((year) => { year.textContent = new Date().getFullYear(); });

const syncNavigation = () => {
  const middle = window.innerHeight * .5;
  const active = pages.find((page) => {
    const box = page.getBoundingClientRect();
    return box.top <= middle && box.bottom > middle;
  }) || pages[0];
  const onCity = active === pages[0];
  document.body.classList.toggle("at-city", onCity);
  if (header) header.inert = onCity;
  pageLinks.forEach((link) => {
    if (link.hash === "#" + active.id) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  });
};
let navFrame;
window.addEventListener("scroll", () => {
  if (navFrame) return;
  navFrame = requestAnimationFrame(() => { navFrame = null; syncNavigation(); });
}, { passive: true });
window.addEventListener("resize", syncNavigation);
window.addEventListener("pageshow", syncNavigation);
window.addEventListener("hashchange", syncNavigation);
syncNavigation();

let toastTimer;
document.querySelectorAll("[data-copy]").forEach((button) => {
  button.addEventListener("click", async () => {
    const label = button.querySelector("[data-copy-label]");
    try {
      await navigator.clipboard.writeText(button.dataset.copy);
      if (label) label.textContent = "已复制";
      toast.textContent = "微信号已复制";
    } catch {
      toast.textContent = "请复制微信号：" + button.dataset.copy;
    }
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove("is-visible");
      if (label) label.textContent = "复制微信号 ↗";
    }, 1800);
  });
});
