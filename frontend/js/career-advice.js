document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id),
    panel = $("career-advice-panel");
  if (!panel) return;
  const error = $("career-error"),
    status = $("career-status"),
    results = $("career-advice-results"),
    button = $("btn-career-advice"),
    jd = $("jd-text");
  let aiBusy = false,
    comparisonBusy = false,
    requestedJd = "";
  function node(tag, text, className) {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (className) el.className = className;
    return el;
  }
  function sync() {
    button.disabled = aiBusy || comparisonBusy;
    $("btn-match").disabled = aiBusy || comparisonBusy;
    panel.setAttribute("aria-busy", String(aiBusy));
  }
  window.setCareerComparisonBusy = (value) => {
    comparisonBusy = !!value;
    sync();
  };
  function stale() {
    $("career-stale").hidden =
      results.hidden || jd.value.trim() === requestedJd;
  }
  jd.addEventListener("input", stale);
  function render(data) {
    $("career-summary-text").textContent = data.summary;
    $("career-context").textContent =
      (data.context === "resume_only"
        ? "Based on your verified resume"
        : "Based on your verified resume and this job description") +
      " · " +
      new Date(data.generatedAt).toLocaleString();
    const roles = $("career-roles");
    roles.replaceChildren();
    data.roles.forEach((role) => {
      const card = node("article", undefined, "career-role");
      card.append(
        node(
          "span",
          role.fit === "closer_fit"
            ? "Closer to current skills"
            : "Skills to build",
          "tag",
        ),
        node("h4", role.title),
        node("p", role.why),
        node("h5", "Evidence in your resume"),
      );
      role.evidence.forEach((e) => card.append(node("blockquote", e)));
      card.append(node("h5", "Skills to build"));
      const gaps = node("div");
      if (role.skillsToBuild.length)
        role.skillsToBuild.forEach((skill) =>
          gaps.append(node("span", skill, "career-skill")),
        );
      else
        gaps.append(
          node(
            "p",
            "No specific gap highlighted; explore the role requirements in more detail.",
          ),
        );
      card.append(
        gaps,
        node("h5", "A practical next move"),
        node("p", role.nextStep),
      );
      roles.append(card);
    });
    for (const [id, items] of [
      ["career-next-steps", data.nextSteps],
      ["career-resume-edits", data.resumeImprovements],
    ]) {
      const list = $(id);
      list.replaceChildren();
      items.forEach((item) => list.append(node("li", item)));
    }
    $("career-job-notes").hidden = !data.jobFitNotes;
    $("career-job-notes-text").textContent = data.jobFitNotes || "";
    results.hidden = false;
    stale();
  }
  window.requestCareerAdvice = async (jdText = jd.value) => {
    if (aiBusy) return false;
    if (typeof jdText !== "string" || jdText.length > 15000) {
      error.hidden = false;
      error.textContent =
        "Use 15,000 characters or fewer in the job description.";
      return false;
    }
    aiBusy = true;
    sync();
    error.hidden = true;
    error.textContent = "";
    $("career-upload-link").hidden = true;
    results.hidden = true;
    status.textContent =
      "Gemini is reviewing your resume and preparing roles and next steps. This may take up to a minute.";
    button.textContent = "Preparing AI suggestions…";
    try {
      const response = await fetch("/api/jobs/career-advice", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ jdText }),
        signal: AbortSignal.timeout(80000),
      });
      const data = await response.json();
      if (!response.ok) {
        $("career-upload-link").hidden = ![
          "VERIFIED_RESUME_REQUIRED",
          "READABLE_RESUME_REQUIRED",
        ].includes(data.code);
        throw new Error(
          data.message || "Could not prepare AI recommendations. Please retry.",
        );
      }
      requestedJd = jdText.trim();
      render(data);
      status.textContent =
        "AI suggestions are ready. Explore the evidence, skills to build and next steps below.";
      $("career-heading").tabIndex = -1;
      $("career-heading").focus();
      return true;
    } catch (e) {
      status.textContent = $('matching-results-box').style.display === 'none'
        ? 'You can retry without changing your resume or job description.'
        : 'Your existing text-similarity results are unchanged.';
      error.hidden = false;
      error.textContent =
        e.name === "TimeoutError"
          ? "The AI request timed out. Please retry; your resume and job description are unchanged."
          : e.message;
      error.tabIndex = -1;
      error.focus();
      return false;
    } finally {
      aiBusy = false;
      button.textContent = "Get AI role suggestions";
      sync();
    }
  };
  button.addEventListener("click", () => window.requestCareerAdvice(jd.value));
});
