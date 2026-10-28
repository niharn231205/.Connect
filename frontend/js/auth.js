// Both forms share loading and error handling; keep a failed submission editable.
["login", "signup"].forEach((mode) => {
  const form = document.getElementById(`${mode}-form`);
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    if (button.disabled) return;
    const label = button.textContent;
    button.disabled = true;
    button.textContent =
      mode === "login" ? "Signing in…" : "Creating your account…";
    form.setAttribute("aria-busy", "true");
    document.getElementById("error-msg").style.display = "none";
    const body = {
      email: document.getElementById("email").value.trim(),
      password: document.getElementById("password").value,
    };
    if (mode === "signup")
      body.name = document.getElementById("name").value.trim();
    try {
      const response = await fetch(
        `${API_URL}/auth/${mode === "signup" ? "register" : "login"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.message || "Please check your details and try again.",
        );
      setToken(data.token);
      window.location.href =
        mode === "signup" ? "/questions.html" : "/dashboard.html";
    } catch (error) {
      showMessage(
        "error-msg",
        error.message === "Failed to fetch"
          ? "Could not connect. Check your connection and try again."
          : error.message,
        true,
      );
      button.disabled = false;
      button.textContent = label;
      form.removeAttribute("aria-busy");
    }
  });
});
