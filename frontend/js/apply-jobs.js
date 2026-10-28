document.addEventListener("DOMContentLoaded", async () => {
  checkAuth();
  const $ = (id) => document.getElementById(id),
    session = getToken();
  let cache,
    saved = null,
    busy = false,
    timer,
    alive = true;
  const current = () => alive && getToken() === session;
  window.addEventListener("pagehide", () => {
    alive = false;
    clearTimeout(timer);
  });
  window.addEventListener("storage", (event) => {
    if (event.key === "token" && !current()) location.href = "/login.html";
  });
  function node(tag, text, className) {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (className) el.className = className;
    return el;
  }
  function error(message = "") {
    $("apply-error").textContent = message;
    $("apply-error").hidden = !message;
  }
  function setBusy(value, phase = "") {
    busy = value;
    $("refresh-jobs").disabled = value;
    $("job-location").disabled = value;
    $("apply-progress").hidden = !value;
    $("apply-phase").textContent = phase;
    $("job-results").setAttribute("aria-busy", String(value));
    $("refresh-jobs").textContent = value
      ? "Searching…"
      : saved
        ? "Refresh jobs ↻"
        : "Find three jobs ↗";
  }
  function render(value, browserOnly = false) {
    saved = value;
    $("job-results").replaceChildren();
    $("apply-empty").hidden = !!value;
    $("location-change-note").hidden = true;
    $("saved-summary").hidden = !value;
    $("search-attribution").replaceChildren();
    if (!value) return;
    const date = new Date(value.searchedAt).toLocaleString([], {
      dateStyle: "medium",
      timeStyle: "short",
    });
    $("saved-date").textContent =
      "Found " + date + " · " + value.searchLocation;
    $("saved-location-note").textContent = browserOnly
      ? "Showing your browser copy. These jobs stay here until you refresh."
      : "Saved for you. These jobs stay here until you refresh.";
    $("job-location").value = value.requestedLocation || "";
    value.jobs.forEach((job, index) => {
      const card = node("article", undefined, "application-card");
      card.append(
        node("span", String(index + 1).padStart(2, "0"), "application-number"),
      );
      const content = node("div", undefined, "application-content");
      content.append(
        node("p", job.company, "application-company"),
        node("h2", job.title),
        node("p", job.location, "application-location"),
      );
      const details = node("div", undefined, "application-details");
      for (const [label, text] of [
        ["WHY IT FITS", job.whyFit],
        ["BEFORE YOU APPLY", job.requirementsToCheck],
      ]) {
        const part = node("div");
        part.append(node("h3", label), node("p", text));
        details.append(part);
      }
      content.append(details);
      const footer = node("div", undefined, "application-footer"),
        link = node("a", "Apply at company ↗", "btn btn-primary");
      if (SavedJobs.safeLink(job.applyUrl)) link.href = job.applyUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.setAttribute(
        "aria-label",
        `Apply for ${job.title} at ${job.company} (opens a new tab)`,
      );
      footer.append(
        node("span", "Employer posting · " + (job.source || "ATS")),
        link,
      );
      content.append(footer);
      card.append(content);
      $("job-results").append(card);
    });
    // Search suggestions are isolated from the app: no scripts, forms or same-origin access.
    if (
      typeof value.searchSuggestions === "string" &&
      value.searchSuggestions.length <= 50000 &&
      value.searchSuggestions
    ) {
      const frame = document.createElement("iframe");
      frame.title = "Google Search suggestions";
      frame.className = "search-suggestions";
      frame.setAttribute(
        "sandbox",
        "allow-popups allow-popups-to-escape-sandbox",
      );
      frame.referrerPolicy = "no-referrer";
      frame.srcdoc =
        "<!doctype html><meta charset=\"utf-8\"><meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; style-src 'unsafe-inline'; img-src https: data:; base-uri 'none'; form-action 'none'\"><base target=\"_blank\">" +
        value.searchSuggestions;
      $("search-attribution").append(frame);
    }
    setBusy(busy);
  }
  function save(value) {
    if (!SavedJobs.valid(value))
      throw Error(
        "The server returned an incomplete job set. Your previous jobs are unchanged.",
      );
    try {
      cache?.save(value);
    } catch (_) {
      $("storage-note").textContent =
        "Browser saving is unavailable. Jobs are saved on the current server, but may be lost on redeploy. Enable site storage for a browser copy.";
    }
    render(value);
  }
  async function request(path, options = {}) {
    const response = await fetch(API_URL + "/jobs/applications" + path, {
      ...options,
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      signal: AbortSignal.timeout(18000),
    });
    if (!current())
      throw Error("Your sign-in changed. Reload this page to continue.");
    const data = await response.json();
    if (!current())
      throw Error("Your sign-in changed. Reload this page to continue.");
    if (!response.ok)
      throw Error(
        data.message ||
          "Job search could not be reached. Your saved jobs are unchanged.",
      );
    return data;
  }
  function consume(data) {
    if (
      data.saved &&
      (!saved ||
        (data.saved.id !== saved.id &&
          Date.parse(data.saved.searchedAt) >= Date.parse(saved.searchedAt)))
    )
      save(data.saved);
    if (data.saved?.id === saved?.id && saved)
      $("saved-location-note").textContent =
        "Saved for you. These jobs stay here until you refresh.";
    $("resume-change-note").hidden = !data.resumeChanged;
    if (data.status === "searching") {
      setBusy(true, data.phase || "Searching employer pages…");
      clearTimeout(timer);
      timer = setTimeout(poll, 2500);
    } else {
      setBusy(false);
      if (data.status === "failed")
        error(
          data.error?.message ||
            "Search failed. Your previous jobs are unchanged.",
        );
      else if (data.status === "complete")
        $("apply-status").textContent =
          "Three jobs saved. Open an employer page when you are ready.";
    }
  }
  async function poll() {
    if (!current()) return;
    try {
      consume(await request(""));
    } catch (e) {
      if (!current()) return;
      setBusy(false);
      error(
        e.message +
          " Reload to check the search status; this will not refresh your jobs.",
      );
    }
  }
  async function search(refresh) {
    if (busy || !current()) return;
    error();
    $("apply-status").textContent = "";
    setBusy(true, "Preparing your job search…");
    try {
      consume(
        await request("/search", {
          method: "POST",
          body: JSON.stringify({
            refresh,
            location: $("job-location").value.trim(),
          }),
        }),
      );
    } catch (e) {
      if (current()) {
        setBusy(false);
        error(e.message);
      }
    }
  }
  $("job-search-form").addEventListener("submit", (event) => {
    event.preventDefault();
    search(!!saved);
  });
  $("job-location").addEventListener("input", () => {
    $("location-change-note").hidden = !saved;
  });
  setBusy(true, "Loading your saved jobs…");
  try {
    const userId = JSON.parse(
      atob(session.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    ).id;
    let key;
    try {
      key = localStorage.getItem("connect.jobs.identity." + userId);
    } catch (_) {
      /* Server saving remains available. */
    }
    try {
      const response = await fetch(API_URL + "/users/dashboard", {
        headers: getAuthHeaders(),
        signal: AbortSignal.timeout(10000),
      });
      if (!current()) return;
      if (response.ok) {
        const user = await response.json(),
          hash = await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(user.email.trim().toLowerCase()),
          );
        key =
          "connect.jobs.v1." +
          [...new Uint8Array(hash)]
            .map((x) => x.toString(16).padStart(2, "0"))
            .join("");
        try {
          localStorage.setItem("connect.jobs.identity." + userId, key);
        } catch (_) {
          /* Inform below if the copy fails. */
        }
      }
    } catch (_) {
      /* Read this signed-in account's existing browser backup during outages. */
    }
    if (!current()) return;
    cache = SavedJobs.create(
      localStorage,
      key || "connect.jobs.v1.user." + userId,
    );
    try {
      const value = cache.read();
      if (value) render(value, true);
    } catch (e) {
      error(e.message);
    }
    const data = await request("");
    consume(data);
    if (!saved && data.status === "idle") {
      setBusy(false);
      await search(false);
    }
  } catch (e) {
    if (current()) {
      setBusy(false);
      error(e.message);
    }
  }
});
