const ai = require("../services/interviewAiService");
const validText = (value, max, required = true) =>
  typeof value === "string" &&
  value.length <= max &&
  (!required || !!value.trim());
const levels = ["Beginner", "Intermediate", "Advanced"];

function createInterviewHandlers(service = ai) {
  const pending = new Set();
  const recent = new Map();
  function handler(operation, valid) {
    return async (req, res) => {
      if (!valid(req.body || {}))
        return res
          .status(400)
          .json({
            message:
              "Check the interview fields. Answers must contain 1–8,000 characters.",
            code: "INVALID_INTERVIEW_INPUT",
          });
      const userId = req.user.id;
      if (pending.has(userId))
        return res
          .status(409)
          .json({
            message: "Your previous AI request is still running. Please wait.",
            code: "INTERVIEW_IN_PROGRESS",
          });
      const now = Date.now();
      if (now - (recent.get(userId) || 0) < 1500)
        return res
          .status(429)
          .json({
            message: "Please wait a moment before retrying.",
            code: "INTERVIEW_RATE_LIMITED",
          });
      if (recent.size > 1000)
        for (const [id, time] of recent)
          if (now - time > 60000) recent.delete(id);
      pending.add(userId);
      recent.set(userId, now);
      try {
        res.json(await operation(req.body));
      } catch (error) {
        res
          .status(503)
          .json({
            message:
              error.status === 503
                ? error.message
                : "AI interview practice is unavailable. Your answer is still editable; please retry.",
            code: "INTERVIEW_AI_UNAVAILABLE",
          });
      } finally {
        pending.delete(userId);
      }
    };
  }
  return {
    generate: handler(
      (body) =>
        service.generateInterview({
          role: body.role.trim(),
          level: body.level,
          focus: (body.focus || "").trim(),
          count: body.count,
        }),
      (b) =>
        validText(b.role, 120) &&
        levels.includes(b.level) &&
        validText(b.focus || "", 500, false) &&
        [3, 5].includes(b.count),
    ),
    evaluate: handler(
      (body) =>
        service.evaluateInterviewAnswer({
          role: body.role.trim(),
          level: body.level,
          question: body.question.trim(),
          referenceAnswer: body.referenceAnswer.trim(),
          answer: body.answer,
        }),
      (b) =>
        validText(b.role, 120) &&
        levels.includes(b.level) &&
        validText(b.question, 2000) &&
        validText(b.referenceAnswer, 6000) &&
        validText(b.answer, 8000),
    ),
  };
}
module.exports = { createInterviewHandlers, ...createInterviewHandlers() };
