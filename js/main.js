"use strict";
document.documentElement.classList.add("js");
const toggle = document.querySelector(".menu-toggle");
const navigation = document.querySelector("#navegacao");
if (toggle && navigation) {
  const setMenu = (open, restoreFocus = false) => {
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
    navigation.classList.toggle("is-open", open);
    if (restoreFocus) toggle.focus();
  };
  toggle.addEventListener("click", () => setMenu(toggle.getAttribute("aria-expanded") !== "true"));
  navigation.addEventListener("click", (event) => {
    const link = event.target.closest("a");
    if (!link) return;
    setMenu(false);
    const destination = link.hash ? document.querySelector(link.hash) : null;
    if (destination) {
      destination.setAttribute("tabindex", "-1");
      destination.focus({ preventScroll: true });
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") setMenu(false, true);
  });
  document.addEventListener("click", (event) => {
    if (!navigation.contains(event.target) && !toggle.contains(event.target)) setMenu(false);
  });
  window.matchMedia("(min-width: 1101px)").addEventListener("change", () => setMenu(false));
}
