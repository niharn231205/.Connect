const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { postingRef } = require("./employerJobsService");
function validSet(value) {
  if (
    !value ||
    value.version !== 1 ||
    typeof value.id !== "string" ||
    value.id.length > 100 ||
    !Number.isFinite(Date.parse(value.searchedAt)) ||
    typeof value.searchLocation !== "string" ||
    value.searchLocation.length > 200 ||
    !Array.isArray(value.jobs) ||
    value.jobs.length !== 3
  )
    return false;
  const ids = new Set();
  return value.jobs.every((job) => {
    const ref = postingRef(job.applyUrl);
    if (!ref || ids.has(ref.key)) return false;
    ids.add(ref.key);
    return (
      ["title", "company", "location", "whyFit", "requirementsToCheck"].every(
        (k) =>
          typeof job[k] === "string" && !!job[k].trim() && job[k].length < 1500,
      ) &&
      ["greenhouse", "lever", "ashby"].includes(job.source) &&
      Number.isFinite(Date.parse(job.checkedAt))
    );
  });
}
function createJobStore(
  filename = path.join(__dirname, "../data/application-jobs.json"),
) {
  function read() {
    try {
      const data = JSON.parse(fs.readFileSync(filename, "utf8"));
      if (data.version !== 1 || typeof data.sets !== "object" || !data.sets)
        throw Error("Invalid saved jobs");
      return data.sets;
    } catch (e) {
      if (e.code === "ENOENT") return {};
      throw e;
    }
  }
  return {
    get(userId) {
      const value = read()[userId];
      if (value && !validSet(value)) throw Error("Invalid saved jobs");
      return value || null;
    },
    set(userId, value) {
      if (!validSet(value)) throw Error("Invalid job set");
      const sets = read();
      Object.defineProperty(sets, userId, {
        value,
        enumerable: true,
        writable: true,
        configurable: true,
      });
      const temp = filename + "." + randomUUID() + ".tmp";
      try {
        fs.writeFileSync(temp, JSON.stringify({ version: 1, sets }), {
          mode: 0o600,
        });
        fs.renameSync(temp, filename);
      } finally {
        if (fs.existsSync(temp)) fs.unlinkSync(temp);
      }
      return value;
    },
  };
}
module.exports = { createJobStore, validSet };
