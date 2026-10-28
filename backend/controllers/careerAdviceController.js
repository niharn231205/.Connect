const { createHash } = require("node:crypto");
const db = require("../data/database");
const { generateCareerAdvice } = require("../services/careerAdviceService");
const digest = (value) => createHash("sha256").update(value).digest("hex");
function verified(resume) {
  const v = resume?.verification;
  return (
    resume?.verifiedByAI === true &&
    v?.provider === "gemini" &&
    v.isResume === true &&
    ["resume", "cv"].includes(v.documentType) &&
    Number.isFinite(v.confidence) &&
    v.confidence >= 0.8 && v.confidence <= 1
  );
}

function createCareerAdvice({
  database = db,
  recommend = generateCareerAdvice,
  now = Date.now,
} = {}) {
  const pending = new Set(),
    cache = new Map();
  return async (req, res) => {
    const jdText = req.body?.jdText ?? "";
    if (typeof jdText !== "string" || jdText.length > 15000)
      return res
        .status(400)
        .json({
          code: "INVALID_JOB_DESCRIPTION",
          message:
            "Use a job description of 15,000 characters or fewer, or leave it blank for resume-based roles.",
        });
    const user = database.findUserById(req.user.id);
    if (!user)
      return res
        .status(404)
        .json({
          code: "PROFILE_NOT_FOUND",
          message:
            "Your profile could not be found. Sign in again or create your profile.",
        });
    const resume = user.resume;
    if (!verified(resume))
      return res
        .status(422)
        .json({
          code: "VERIFIED_RESUME_REQUIRED",
          message:
            "Upload and verify your personal resume before requesting AI career recommendations.",
        });
    if (
      typeof resume.extractedText !== "string" ||
      resume.extractedText.trim().length < 40 ||
      resume.extractedText.length > 50000
    )
      return res
        .status(422)
        .json({
          code: "READABLE_RESUME_REQUIRED",
          message:
            "Please upload your readable resume again so AI can review its content.",
        });
    const revision = digest(
      resume.extractedText + "\n" + (resume.verifiedAt || ""),
    );
    const key = digest(revision + "\n" + jdText.trim());
    const cached = cache.get(user.id);
    if (cached?.key === key && now() - cached.at < 30 * 60 * 1000)
      return res.json({ ...cached.value, cached: true });
    if (pending.has(user.id))
      return res
        .status(409)
        .json({
          code: "CAREER_REQUEST_PENDING",
          message:
            "Your AI recommendations are still being prepared. Please wait.",
        });
    pending.add(user.id);
    try {
      const advice = await recommend({
        resumeText: resume.extractedText,
        jdText: jdText.trim(),
      });
      const current = database.findUserById(user.id)?.resume;
      if (
        !verified(current) ||
        digest(current.extractedText + "\n" + (current.verifiedAt || "")) !==
          revision
      )
        return res
          .status(409)
          .json({
            code: "RESUME_CHANGED",
            message:
              "Your resume changed during the review. Request fresh recommendations for the new resume.",
          });
      const value = {
        ...advice,
        context: jdText.trim() ? "resume_and_job_description" : "resume_only",
        generatedAt: new Date(now()).toISOString(),
        resumeVerifiedAt: resume.verifiedAt || null,
      };
      if (cache.size >= 100) cache.delete(cache.keys().next().value);
      cache.set(user.id, { key, at: now(), value });
      return res.json({ ...value, cached: false });
    } catch (_) {
      return res
        .status(503)
        .json({
          code: "CAREER_AI_UNAVAILABLE",
          message:
            "AI recommendations are temporarily unavailable. Your skill comparison is unaffected. Please retry shortly.",
        });
    } finally {
      pending.delete(user.id);
    }
  };
}
module.exports = { createCareerAdvice, careerAdvice: createCareerAdvice() };
