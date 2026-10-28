const { randomUUID, createHash } = require("node:crypto");
const db = require("../data/database");
const { searchJobs } = require("../services/jobSearchService");
const { createJobStore } = require("../services/applicationJobsStore");
function resumeKey(resume) {
  return createHash("sha256")
    .update((resume?.extractedText || "") + "\n" + (resume?.verifiedAt || ""))
    .digest("hex");
}
function accepted(resume) {
  const v = resume?.verification;
  return (
    resume?.verifiedByAI === true &&
    v?.provider === "gemini" &&
    v.isResume === true &&
    ["resume", "cv"].includes(v.documentType) &&
    Number.isFinite(v.confidence) &&
    v.confidence >= 0.8 &&
    v.confidence <= 1 &&
    typeof resume.extractedText === "string" &&
    resume.extractedText.length >= 40 &&
    resume.extractedText.length <= 50000
  );
}
function createApplicationJobs({
  database = db,
  store = createJobStore(),
  search = searchJobs,
  now = Date.now,
} = {}) {
  const tasks = new Map(),
    promises = new Map();
  function state(userId, saved) {
    const task = tasks.get(userId);
    return {
      saved,
      status: task?.status || "idle",
      phase: task?.phase || "",
      error: task?.error || null,
      resumeChanged:
        !!saved &&
        saved.resumeFingerprint !==
          resumeKey(database.findUserById(userId)?.resume),
    };
  }
  function profile(req, res) {
    const user = database.findUserById(req.user.id);
    if (!user) {
      res
        .status(404)
        .json({
          code: "PROFILE_NOT_FOUND",
          message: "Sign in again or create your profile to search for jobs.",
        });
      return null;
    }
    return user;
  }
  return {
    get(req, res) {
      try {
        const user = profile(req, res);
        if (!user) return;
        return res.json(state(user.id, store.get(user.id)));
      } catch (_) {
        return res
          .status(503)
          .json({
            code: "SAVED_JOBS_UNAVAILABLE",
            message:
              "Saved jobs could not be loaded. Your browser copy is still available.",
          });
      }
    },
    start(req, res) {
      const user = profile(req, res);
      if (!user) return;
      const refresh = req.body?.refresh ?? false,
        location = req.body?.location ?? "";
      if (
        typeof refresh !== "boolean" ||
        typeof location !== "string" ||
        location.length > 160 ||
        /@|https?:|\d{5}|[\x00-\x1f]/i.test(location)
      )
        return res
          .status(400)
          .json({
            code: "INVALID_SEARCH",
            message: "Enter a city, country or Remote (up to 160 characters).",
          });
      let saved;
      try {
        saved = store.get(user.id);
      } catch (_) {
        return res
          .status(503)
          .json({
            code: "SAVED_JOBS_UNAVAILABLE",
            message:
              "Saved jobs are unavailable. Refresh has not replaced anything.",
          });
      }
      if (tasks.get(user.id)?.status === "searching")
        return res.status(202).json(state(user.id, saved));
      if (saved && !refresh) return res.json(state(user.id, saved));
      if (!accepted(user.resume))
        return res
          .status(422)
          .json({
            code: "VERIFIED_RESUME_REQUIRED",
            message: "Upload and verify your resume before searching for jobs.",
            saved,
          });
      const fingerprint = resumeKey(user.resume),
        task = {
          id: randomUUID(),
          status: "searching",
          phase: "Preparing your job search…",
          error: null,
        };
      tasks.set(user.id, task);
      const running = Promise.resolve()
        .then(async () => {
          const found = await search({
            resumeText: user.resume.extractedText,
            location: location.trim(),
            onProgress: (phase) => {
              task.phase = phase;
            },
          });
          const current = database.findUserById(user.id)?.resume;
          if (!accepted(current) || resumeKey(current) !== fingerprint)
            throw Object.assign(Error("Resume changed"), {
              code: "RESUME_CHANGED",
            });
          store.set(user.id, {
            ...found,
            id: randomUUID(),
            version: 1,
            resumeFingerprint: fingerprint,
            requestedLocation: location.trim(),
            searchedAt: found.searchedAt || new Date(now()).toISOString(),
          });
          task.status = "complete";
          task.phase = "Three jobs saved for you.";
        })
        .catch((error) => {
          task.status = "failed";
          task.phase = "";
          task.error = {
            code:
              error.code === "NOT_ENOUGH_VERIFIED_JOBS"
                ? "NOT_ENOUGH_VERIFIED_JOBS"
                : error.code === "RESUME_CHANGED"
                  ? "RESUME_CHANGED"
                  : "JOB_SEARCH_UNAVAILABLE",
            message:
              error.code === "NOT_ENOUGH_VERIFIED_JOBS"
                ? "Could not confirm three suitable open jobs. Try a broader location and refresh."
                : error.code === "RESUME_CHANGED"
                  ? "Your resume changed during the search. Refresh again to use your new resume."
                  : "Live search is temporarily unavailable. Your previous saved jobs are unchanged. Please retry.",
          };
        })
        .finally(() => {
          promises.delete(user.id);
          if (tasks.size > 1000) {
            for (const [id, item] of tasks)
              if (id !== user.id && item.status !== "searching") {
                tasks.delete(id);
                if (tasks.size <= 1000) break;
              }
          }
        });
      promises.set(user.id, running);
      return res.status(202).json(state(user.id, saved));
    },
    waitForIdle: (userId) => promises.get(userId) || Promise.resolve(),
  };
}
const handlers = createApplicationJobs();
module.exports = {
  createApplicationJobs,
  getApplicationJobs: handlers.get,
  startApplicationJobs: handlers.start,
};
