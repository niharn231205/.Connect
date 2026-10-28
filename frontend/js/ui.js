// Native selects retain keyboard, screen-reader and mobile support.
window.initCustomSelects = function () {};

document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.querySelector(".menu-toggle");
  const sidebar = document.querySelector(".studio-sidebar");
  const backdrop = document.querySelector(".nav-backdrop");
  const mobile = window.matchMedia("(max-width: 800px)");
  const main = document.getElementById("app-main");
  if (sidebar) {
    const closeNav = document.createElement("button");
    closeNav.type = "button";
    closeNav.className = "nav-close";
    closeNav.setAttribute("aria-label", "Close navigation");
    closeNav.textContent = "×";
    closeNav.addEventListener("click", () => {
      setMenu(false);
      toggle.focus();
    });
    sidebar.prepend(closeNav);
  }
  function setMenu(open) {
    document.body.classList.toggle("menu-open", open);
    if (!toggle) return;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute(
      "aria-label",
      open ? "Close navigation" : "Open navigation",
    );
    sidebar.inert = mobile.matches && !open;
    if (main) main.inert = open;
    backdrop.hidden = !open;
    if (open) sidebar.querySelector("a").focus();
  }
  if (toggle) {
    toggle.addEventListener("click", () =>
      setMenu(!document.body.classList.contains("menu-open")),
    );
    backdrop.addEventListener("click", () => {
      setMenu(false);
      toggle.focus();
    });
    document.addEventListener("keydown", (e) => {
      if (!document.body.classList.contains("menu-open")) return;
      if (e.key === "Escape") {
        setMenu(false);
        toggle.focus();
      }
      if (e.key === "Tab") {
        const items = [...sidebar.querySelectorAll("a,button")];
        const first = items[0],
          last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });
    mobile.addEventListener("change", () => setMenu(false));
    setMenu(false);
  }
  document.querySelectorAll("i.toggle-password").forEach((icon) => {
    const input = icon.previousElementSibling;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "password-toggle";
    button.setAttribute("aria-label", "Show password");
    button.setAttribute("aria-pressed", "false");
    button.innerHTML = '<i class="fas fa-eye" aria-hidden="true"></i>';
    icon.replaceWith(button);
    button.addEventListener("click", () => {
      const shown = input.type === "password";
      input.type = shown ? "text" : "password";
      button.setAttribute(
        "aria-label",
        shown ? "Hide password" : "Show password",
      );
      button.setAttribute("aria-pressed", String(shown));
      button.innerHTML = `<i class="fas fa-eye${shown ? "-slash" : ""}" aria-hidden="true"></i>`;
    });
  });
  const file = document.getElementById("resume-file");
  if (file) {
    const zone = file.closest(".upload-zone");
    file.addEventListener("change", () => {
      const selected = file.files[0];
      document.getElementById("selected-file").textContent = selected
        ? `${selected.name} · ${(selected.size / 1024).toFixed(0)} KB`
        : "No file selected";
    });
    file.addEventListener("dragenter", () => zone.classList.add("dragging"));
    ["dragleave", "drop", "change"].forEach((event) =>
      file.addEventListener(event, () => zone.classList.remove("dragging")),
    );
  }
  document
    .querySelectorAll("#projectModal,#personalizationModal,#reportModal")
    .forEach((modal) => {
      document.body.appendChild(modal);
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      const heading = modal.querySelector("h2,h3");
      if (heading) {
        heading.id ||= `${modal.id}-title`;
        modal.setAttribute("aria-labelledby", heading.id);
      }
      let previousFocus,
        wasOpen = false,
        siblings = [];
      const close = document.createElement("button");
      close.className = "modal-close";
      close.type = "button";
      close.textContent = "×";
      close.setAttribute("aria-label", "Close dialog");
      const hide = () => {
        modal.style.display = "none";
      };
      close.addEventListener("click", hide);
      modal.firstElementChild.prepend(close);
      new MutationObserver(() => {
        const open = modal.style.display !== "none";
        if (open === wasOpen) return;
        wasOpen = open;
        if (open) {
          previousFocus = document.activeElement;
          siblings = [...document.body.children]
            .filter((el) => el !== modal)
            .map((el) => [el, el.inert]);
          siblings.forEach(([el]) => {
            el.inert = true;
          });
          close.focus();
        } else {
          siblings.forEach(([el, inert]) => {
            el.inert = inert;
          });
          if (previousFocus?.isConnected) previousFocus.focus();
        }
      }).observe(modal, { attributes: true, attributeFilter: ["style"] });
      modal.addEventListener("keydown", (e) => {
        if (e.key === "Escape") hide();
        if (e.key === "Tab") {
          const items = [
            ...modal.querySelectorAll("button,a,input,select,textarea"),
          ].filter((el) => !el.disabled && el.getClientRects().length);
          const first = items[0],
            last = items[items.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      });
    });
});
