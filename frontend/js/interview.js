checkAuth();
document.addEventListener("DOMContentLoaded", async () => {
  const $ = (id) => document.getElementById(id);
  const setup = $("interview-setup"),
    practice = $("interview-session"),
    review = $("interview-review");
  const error = $("interview-error"),
    status = $("interview-status");
  let archive,
    active,
    index = 0,
    busy = false,
    saveTimer;
  function notice(message, failed = false) {
    error.hidden = !failed;
    error.textContent = failed ? message : "";
    status.textContent = failed ? "" : message;
  }
  function node(tag, text, className) {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (className) el.className = className;
    return el;
  }
  function button(label, fn, className = "btn btn-secondary") {
    const el = node("button", label, className);
    el.type = "button";
    el.addEventListener("click", () => {
      if (busy) return notice("Please wait for the current AI request before changing sessions.", true);
      fn();
    });
    return el;
  }
  function download(blob, name) {
    const url = URL.createObjectURL(blob),
      a = node("a");
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  const jsonBlob = (value) =>
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  function save() {
    if (!archive || !active) return false;
    try {
      archive.save(active);
      $("answer-save-state").textContent = "Saved on this browser.";
      return true;
    } catch (_) {
      $("answer-save-state").textContent =
        "Browser storage is unavailable or full. Download a backup before leaving.";
      notice(
        "This session could not be saved on this browser. Keep this page open and download its JSON backup before leaving.",
        true,
      );
      return false;
    }
  }
  async function api(path, body) {
    const response = await fetch("/api/interview/" + path, {
      method: "POST",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(80000),
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(
        response.status === 401
          ? "Sign in again to use AI practice. Your local journal is still available."
          : data.message || "The AI request failed. Please retry.",
      );
    return data;
  }
  function showFeedback(target, evaluation) {
    target.replaceChildren(
      node("h3", `AI practice score · ${evaluation.score}/100`),
      node("p", evaluation.feedback),
    );
    for (const [key, label] of [
      ["strengths", "What worked"],
      ["improvements", "What to improve"],
    ]) {
      target.append(node("h4", label));
      const list = node("ul");
      evaluation[key].forEach((text) => list.append(node("li", text)));
      target.append(list);
    }
    target.append(
      node(
        "p",
        "AI feedback is a learning aid. Check technical claims against reliable references.",
        "journal-source",
      ),
    );
  }
  function renderQuestion() {
    const q = active.questions[index];
    setup.hidden = true;
    review.hidden = true;
    practice.hidden = false;
    $("session-role").textContent = active.role + " · " + active.level;
    $("question-progress").textContent =
      `Question ${index + 1} of ${active.questions.length}`;
    $("current-question").textContent = q.question;
    $("reference-answer").textContent = q.referenceAnswer;
    $("interview-answer").value = q.answer || "";
    $("interview-answer").disabled = !!q.evaluation;
    $("evaluate-answer").hidden = !!q.evaluation;
    $("evaluate-answer").disabled = false;
    $("answer-feedback").hidden = !q.evaluation;
    $("next-question").hidden = !q.evaluation;
    $("next-question").textContent =
      index === active.questions.length - 1
        ? "Finish & save interview →"
        : "Next question →";
    if (q.evaluation) showFeedback($("answer-feedback"), q.evaluation);
    practice.querySelector("details").open = false;
    $("current-question").focus();
  }
  function exportSession(session) {
    download(
      jsonBlob({ version: 1, sessions: [session] }),
      `.Connect-interview-${session.id}.json`,
    );
  }
  function exportPdf(session) {
    try {
      download(
        InterviewReport.pdf(session, window.jspdf.jsPDF),
        `.Connect-interview-${session.id}.pdf`,
      );
    } catch (e) {
      if (e.code === "UNICODE_REPORT") {
        const url = URL.createObjectURL(
          new Blob([InterviewReport.printable(session)], {
            type: "text/html;charset=utf-8",
          }),
        );
        const report = window.open(url, "_blank", "noopener");
        notice(
          "The report uses Unicode text. In the printable report, choose Print / Save as PDF. JSON backup preserves every character.",
        );
        // Also provide the file when the browser blocks a new report tab.
        if (!report)
          download(
            new Blob([InterviewReport.printable(session)], {
              type: "text/html;charset=utf-8",
            }),
            `.Connect-printable-${session.id}.html`,
          );
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } else
        notice(
          "PDF export is unavailable. Download the JSON backup to keep all questions and answers.",
          true,
        );
    }
  }
  function reviewSession(session) {
    setup.hidden = true;
    practice.hidden = true;
    review.hidden = false;
    const summary = $("review-summary");
    summary.replaceChildren();
    const head = node("div", undefined, "review-head"),
      intro = node("div");
    intro.append(
      node("span", "A SESSION TO LEARN FROM", "eyebrow"),
      node("h2", session.role),
      node(
        "p",
        session.level + " · " + new Date(session.createdAt).toLocaleString(),
      ),
    );
    head.append(
      intro,
      node(
        "div",
        session.status === "completed"
          ? InterviewArchive.score(session) + "/100"
          : "In progress",
        "review-score",
      ),
    );
    summary.append(head);
    summary.append(
      node(
        "p",
        session.status === "completed"
          ? "Your questions, original answers, AI feedback and reference answers are below."
          : "This draft is saved locally. Resume it to finish your practice.",
      ),
    );
    const actions = node("div", undefined, "review-actions");
    actions.append(
      button("Download PDF", () => exportPdf(session), "btn btn-primary"),
      button("Download JSON backup", () => exportSession(session)),
      button("Start a new interview", newInterview),
    );
    if (session.status !== "completed")
      actions.append(button("Resume this interview", () => resume(session)));
    summary.append(
      actions,
      node(
        "p",
        "History is saved on this browser. Download a backup before clearing browser data or changing devices.",
        "interview-disclosure",
      ),
    );
    $("review-questions").replaceChildren();
    session.questions.forEach((q, i) => {
      const card = node("article", undefined, "glass-card review-question");
      card.append(
        node("span", `QUESTION ${i + 1}`, "eyebrow"),
        node("h3", q.question),
        node("h4", "Your original answer"),
        node("p", q.answer || "Not answered yet.", "preserve-text"),
      );
      if (q.evaluation) {
        const feedback = node("div", undefined, "feedback-panel");
        showFeedback(feedback, q.evaluation);
        card.append(feedback);
      }
      card.append(
        node("h4", "AI reference answer"),
        node("p", q.referenceAnswer, "preserve-text"),
      );
      $("review-questions").append(card);
    });
    summary.tabIndex = -1;
    summary.focus();
  }
  function newInterview() {
    active = null;
    setup.hidden = false;
    practice.hidden = true;
    review.hidden = true;
    $("interview-role").focus();
  }
  function resume(session) {
    active = structuredClone(session);
    index = active.questions.findIndex((q) => !q.evaluation);
    if (index < 0) index = active.questions.length - 1;
    renderQuestion();
  }
  function renderHistory() {
    const list = $("interview-history-list");
    list.replaceChildren();
    if (!archive) return;
    let sessions;
    try {
      sessions = archive.list();
    } catch (_) {
      notice(
        "Saved history could not be read. Restore your JSON backup to recover it.",
        true,
      );
      return;
    }
    const query = $("history-search").value.toLowerCase();
    sessions = sessions.filter((s) =>
      `${s.role} ${s.level} ${s.focus}`.toLowerCase().includes(query),
    );
    if (!sessions.length) {
      list.append(
        node(
          "div",
          query
            ? "No sessions match your search."
            : "Your practice journal is ready. Complete an interview to add your first session.",
          "history-empty",
        ),
      );
      return;
    }
    sessions.forEach((s) => {
      const card = node("article", undefined, "history-card"),
        info = node("div"),
        actions = node("div", undefined, "history-actions");
      info.append(
        node(
          "span",
          s.status === "completed"
            ? `Completed · ${InterviewArchive.score(s)}/100`
            : "Saved draft",
          "tag",
        ),
        node("h3", s.role),
        node(
          "p",
          `${s.level} · ${s.questions.length} questions · ${new Date(s.createdAt).toLocaleString()}`,
        ),
      );
      if (s.focus) info.append(node("p", s.focus));
      actions.append(
        button(
          s.status === "completed" ? "Review Q & A" : "Resume practice",
          () => (s.status === "completed" ? reviewSession(s) : resume(s)),
          "btn btn-primary",
        ),
        button("PDF", () => exportPdf(s)),
        button("JSON", () => exportSession(s)),
      );
      card.append(info, actions);
      list.append(card);
    });
  }
  $("ai-interview-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;
    busy = true;
    const btn = $("generate-interview");
    btn.disabled = true;
    btn.textContent = "Generating your questions…";
    notice(
      "Gemini is preparing your questions and reference answers. This can take up to a minute.",
    );
    try {
      const role = $("interview-role").value.trim(),
        level = $("interview-level").value,
        focus = $("interview-focus").value.trim();
      const data = await api("generate", {
        role,
        level,
        focus,
        count: Number($("interview-count").value),
      });
      active = InterviewArchive.validate({
        id: crypto.randomUUID(),
        role,
        level,
        focus,
        createdAt: new Date().toISOString(),
        status: "in_progress",
        questions: data.questions,
        provider: data.provider,
        model: data.model,
      });
      const saved = save();
      index = 0;
      renderQuestion();
      renderHistory();
      if (saved)
        notice(
          "Your new session is saved on this browser. Take your time with each answer.",
        );
    } catch (e) {
      notice(
        e.name === "TimeoutError"
          ? "The AI request timed out. Your previous history is safe; please try again."
          : e.message,
        true,
      );
    } finally {
      busy = false;
      btn.disabled = false;
      btn.textContent = "Generate my interview →";
    }
  });
  $("interview-answer").addEventListener("input", () => {
    if (!active || busy) return;
    active.questions[index].answer = $("interview-answer").value;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 300);
  });
  window.addEventListener("pagehide", () => {
    clearTimeout(saveTimer);
    if (active) save();
  });
  $("interview-answer-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy || !active) return;
    const q = active.questions[index];
    if (q.evaluation) return;
    q.answer = $("interview-answer").value;
    save();
    busy = true;
    const btn = $("evaluate-answer");
    btn.disabled = true;
    btn.textContent = "Reviewing your answer…";
    $("interview-answer").disabled = true;
    notice(
      "Gemini is reviewing correctness, relevance and clarity. Your answer is saved and will remain available if the request fails.",
    );
    try {
      q.evaluation = await api("evaluate-ai", {
        role: active.role,
        level: active.level,
        question: q.question,
        referenceAnswer: q.referenceAnswer,
        answer: q.answer,
      });
      const saved = save();
      renderQuestion();
      $("answer-feedback").focus();
      if (saved)
        notice("Feedback saved. Review it, then continue when you are ready.");
    } catch (e) {
      notice(
        e.name === "TimeoutError"
          ? "The AI review timed out. Your answer is still here. Please retry."
          : e.message,
        true,
      );
      $("interview-answer").disabled = false;
    } finally {
      busy = false;
      btn.disabled = false;
      btn.textContent = "Get AI feedback";
    }
  });
  $("next-question").addEventListener("click", async () => {
    if (busy || !active?.questions[index].evaluation) return;
    if (index < active.questions.length - 1) {
      index++;
      renderQuestion();
      return;
    }
    active.status = "completed";
    active.completedAt = new Date().toISOString();
    const saved = save();
    renderHistory();
    reviewSession(active);
    if (saved)
      notice(
        "Interview complete. Saved to your browser history — download a PDF or JSON backup below.",
      );
    // The dashboard stores only a summary; the full transcript stays on this device.
    fetch("/api/users/interview-score", {
      method: "POST",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        company: active.role,
        score: InterviewArchive.score(active),
        sessionId: active.id,
      }),
    }).catch(() => {});
  });
  $("leave-practice").addEventListener("click", () => {
    if (busy) {
      notice("Please wait for the current AI request before leaving.", true);
      return;
    }
    save();
    renderHistory();
    newInterview();
  });
  $("history-search").addEventListener("input", renderHistory);
  $("export-interviews").addEventListener("click", () => {
    try {
      download(jsonBlob(archive.export()), ".Connect-interview-journal.json");
    } catch (e) {
      notice(e.message, true);
    }
  });
  $("import-interviews").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      if (busy) throw new Error("Please wait for the current AI request before restoring a backup.");
      if (file.size > 5 * 1024 * 1024)
        throw new Error("Choose a JSON backup smaller than 5 MB.");
      const count = archive.import(JSON.parse(await file.text()));
      renderHistory();
      if (active) {
        const restored = archive.list().find(session => session.id === active.id);
        if (restored?.status === "completed") { active = restored; reviewSession(restored); }
      }
      notice(`Restored ${count} session(s) to this browser.`);
    } catch (e) {
      notice(
        e instanceof SyntaxError
          ? "This file is not valid JSON. Choose a .Connect journal backup."
          : e.message,
        true,
      );
    } finally {
      event.target.value = "";
    }
  });
  $("generate-interview").disabled = true;
  try {
    let userId;
    try {
      userId = JSON.parse(
        atob(getToken().split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
      ).id;
    } catch (_) {
      throw new Error("Sign in to start AI practice.");
    }
    let key = localStorage.getItem("connect.interview.identity." + userId);
    try {
      const response = await fetch("/api/users/dashboard", {
        headers: getAuthHeaders(),
        signal: AbortSignal.timeout(10000),
      });
      if (response.ok) {
        const data = await response.json();
        const hash = await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(data.email.trim().toLowerCase()),
        );
        key =
          "connect.interviews.v1." +
          [...new Uint8Array(hash)]
            .map((x) => x.toString(16).padStart(2, "0"))
            .join("");
        localStorage.setItem("connect.interview.identity." + userId, key);
      }
    } catch (_) {
      /* A cached journal remains usable without the server. */
    }
    archive = InterviewArchive.create(
      localStorage,
      key || "connect.interviews.v1.user." + userId,
    );
    renderHistory();
  } catch (e) {
    notice(
      "Browser history is unavailable. Enable site storage and reload to keep a practice journal. " +
        e.message,
      true,
    );
  } finally {
    $("generate-interview").disabled = false;
  }
});
