const toggle = document.getElementById("nav-toggle");
const nav = document.getElementById("hovedmeny");
const label = toggle.querySelector(".nav-toggle__label");

function setMenu(open) {
  toggle.setAttribute("aria-expanded", String(open));
  nav.classList.toggle("is-open", open);
  label.textContent = open ? "Lukk" : "Meny";
}

toggle.addEventListener("click", () => {
  setMenu(toggle.getAttribute("aria-expanded") !== "true");
});

const navLinks = nav.querySelectorAll("a");
navLinks.forEach((link) => {
  link.addEventListener("click", () => setMenu(false));
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
    setMenu(false);
    toggle.focus();
  }
});

const sections = document.querySelectorAll("main section[id]");

function updateCurrentSection() {
  let current = "";
  sections.forEach((section) => {
    if (section.getBoundingClientRect().top <= innerHeight * 0.4) {
      current = `#${section.id}`;
    }
  });
  if (scrollY + innerHeight >= document.documentElement.scrollHeight - 2) {
    current = "#kontakt";
  }
  navLinks.forEach((link) => {
    if (link.getAttribute("href") === current) {
      link.setAttribute("aria-current", "true");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

window.addEventListener("scroll", updateCurrentSection, { passive: true });
window.addEventListener("resize", updateCurrentSection);
updateCurrentSection();
