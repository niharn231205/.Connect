(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.InterviewArchive = api;
})(typeof window === "undefined" ? globalThis : window, function () {
  const text = (v, max, empty = false) =>
    typeof v === "string" && v.length <= max && (empty || !!v.trim());
  function validate(session) {
    if (
      !session ||
      !text(session.id, 100) ||
      !text(session.role, 120) ||
      !["Beginner", "Intermediate", "Advanced"].includes(session.level) ||
      !text(session.focus || "", 500, true) ||
      !Number.isFinite(Date.parse(session.createdAt)) ||
      !["in_progress", "completed"].includes(session.status) ||
      !Array.isArray(session.questions) ||
      session.questions.length < 1 ||
      session.questions.length > 5
    )
      throw new Error("This backup contains an invalid interview session.");
    const questions = session.questions.map((q) => {
      if (
        !q ||
        !text(q.question, 2000) ||
        !text(q.referenceAnswer, 6000) ||
        !text(q.answer || "", 8000, true)
      )
        throw new Error("This backup contains an invalid question or answer.");
      let evaluation;
      if (q.evaluation) {
        const e = q.evaluation;
        if (
          !Number.isInteger(e.score) ||
          e.score < 0 ||
          e.score > 100 ||
          !text(e.feedback, 2000) ||
          !["strengths", "improvements"].every(
            (key) =>
              Array.isArray(e[key]) &&
              e[key].length <= 4 &&
              e[key].every((v) => text(v, 700)),
          ) ||
          !q.answer?.trim()
        )
          throw new Error("This backup contains invalid feedback.");
        evaluation = {
          score: e.score,
          feedback: e.feedback,
          strengths: e.strengths.slice(),
          improvements: e.improvements.slice(),
          provider: "gemini",
          model: text(e.model, 100) ? e.model : "not recorded",
        };
      }
      return {
        question: q.question,
        referenceAnswer: q.referenceAnswer,
        answer: q.answer || "",
        ...(evaluation ? { evaluation } : {}),
      };
    });
    if (
      session.status === "completed" &&
      (!questions.every((q) => q.evaluation) ||
        !Number.isFinite(Date.parse(session.completedAt)))
    )
      throw new Error("This completed session is missing answers.");
    return {
      id: session.id,
      role: session.role,
      level: session.level,
      focus: session.focus || "",
      createdAt: session.createdAt,
      ...(session.status === "completed"
        ? { completedAt: session.completedAt }
        : {}),
      status: session.status,
      provider: "gemini",
      model: text(session.model, 100) ? session.model : "not recorded",
      questions,
    };
  }
  function score(session) {
    return Math.round(
      session.questions.reduce(
        (sum, q) => sum + (q.evaluation?.score || 0),
        0,
      ) / session.questions.length,
    );
  }
  function create(storage, key) {
    function list() {
      const raw = storage.getItem(key);
      if (!raw) return [];
      const data = JSON.parse(raw);
      if (data.version !== 1 || !Array.isArray(data.sessions))
        throw new Error(
          "Saved history could not be read. Keep your JSON backup.",
        );
      return data.sessions
        .map(validate)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    }
    function write(sessions) {
      // One atomic storage write; never silently discard an older session.
      storage.setItem(key, JSON.stringify({ version: 1, sessions }));
    }
    return {
      list,
      save(session) {
        const clean = validate(session),
          all = list(),
          index = all.findIndex((s) => s.id === clean.id);
        if (index < 0) all.push(clean);
        else all[index] = clean;
        write(all);
        return clean;
      },
      export() {
        return {
          version: 1,
          exportedAt: new Date().toISOString(),
          sessions: list(),
        };
      },
      import(data) {
        if (
          data?.version !== 1 ||
          !Array.isArray(data.sessions) ||
          data.sessions.length > 500
        )
          throw new Error(
            "Choose a .Connect JSON backup containing at most 500 sessions.",
          );
        const incoming = data.sessions.map(validate),
          all = list();
        let added = 0;
        for (const s of incoming) {
          const index = all.findIndex((item) => item.id === s.id);
          if (index < 0) {
            all.push(s);
            added++;
          } else if (
            all[index].status !== "completed" &&
            s.status === "completed"
          ) {
            all[index] = s;
            added++;
          }
        }
        write(all);
        return added;
      },
    };
  }
  return { create, validate, score };
});
