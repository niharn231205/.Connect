(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.InterviewReport = api;
})(typeof window === "undefined" ? globalThis : window, function () {
  function blocks(session) {
    const score = Math.round(
      session.questions.reduce(
        (sum, q) => sum + (q.evaluation?.score || 0),
        0,
      ) / session.questions.length,
    );
    const result = [
      [".Connect - Interview practice", 18],
      [session.role + " | " + session.level, 13],
      ["Started: " + new Date(session.createdAt).toLocaleString(), 10],
      [
        "Status: " +
          session.status.replace("_", " ") +
          (session.status === "completed"
            ? " | AI practice score: " + score + "/100"
            : ""),
        10,
      ],
      [
        "AI-generated learning guidance, not an employment assessment. Original answers are reproduced below.",
        10,
      ],
    ];
    session.questions.forEach((q, i) => {
      result.push(
        [`Question ${i + 1}: ${q.question}`, 13],
        ["Your answer", 11],
        [q.answer || "(Not answered)", 10],
      );
      if (q.evaluation)
        result.push(
          [`AI feedback - ${q.evaluation.score}/100`, 11],
          [q.evaluation.feedback, 10],
          ["Strengths: " + q.evaluation.strengths.join("; "), 10],
          ["Improve: " + q.evaluation.improvements.join("; "), 10],
        );
      result.push(["AI reference answer", 11], [q.referenceAnswer, 10]);
    });
    result.push([
      "Generated with Google Gemini. Model: " +
        session.model +
        ". JSON backups preserve the complete structured journal.",
      9,
    ]);
    return result;
  }
  function pdf(session, Pdf) {
    const content = blocks(session);
    const normalized = (value) =>
      value
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201c\u201d]/g, '"')
        .replace(/[\u2013\u2014]/g, "-")
        .replace(/\u2026/g, "...")
        .replace(/\u2022/g, "-")
        .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "");
    if (content.some(([value]) => /[^\u0000-\u00ff]/.test(normalized(value))))
      throw Object.assign(
        new Error("Use the browser print report for Unicode text."),
        { code: "UNICODE_REPORT" },
      );
    const doc = new Pdf({ unit: "mm", format: "a4" });
    let y = 20;
    doc.setProperties({
      title: ".Connect interview practice - " + session.role,
    });
    for (const [value, size] of content) {
      doc.setFont("helvetica", size >= 11 ? "bold" : "normal");
      doc.setFontSize(size);
      doc.setTextColor(25, 25, 22);
      const lines = doc.splitTextToSize(normalized(value), 174);
      for (const line of lines) {
        if (y > 275) {
          doc.addPage();
          y = 20;
        }
        doc.text(line, 18, y);
        y += size >= 13 ? 7 : 5;
      }
      y += 5;
    }
    return doc.output("blob");
  }
  function printable(session) {
    const esc = (s) =>
      String(s).replace(
        /[&<>"']/g,
        (c) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          })[c],
      );
    return (
      '<!doctype html><html lang="en"><meta charset="utf-8"><title>.Connect interview report</title><style>body{font:15px/1.7 system-ui;max-width:780px;margin:40px auto;padding:20px;color:#111}p{white-space:pre-wrap;overflow-wrap:anywhere}h2{margin-top:30px;font-size:20px}@media print{button{display:none}}</style><button onclick="window.print()">Print / Save as PDF</button>' +
      blocks(session)
        .map(([t, n]) =>
          n >= 11 ? "<h2>" + esc(t) + "</h2>" : "<p>" + esc(t) + "</p>",
        )
        .join("") +
      "</html>"
    );
  }
  return { pdf, printable, blocks };
});
