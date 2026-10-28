(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SavedJobs = api;
})(typeof window === "undefined" ? globalThis : window, function () {
  function safeLink(value) {
    try {
      const u = new URL(value),
        p = u.pathname.split("/").filter(Boolean);
      if (u.protocol !== "https:" || u.username || u.password || u.port)
        return false;
      if (
        ["boards.greenhouse.io", "job-boards.greenhouse.io"].includes(
          u.hostname,
        )
      )
        return (
          p.length === 3 &&
          p[1] === "jobs" &&
          /^[a-z0-9_-]+$/i.test(p[0]) &&
          /^\d+$/.test(p[2])
        );
      return (
        ["jobs.lever.co", "jobs.eu.lever.co", "jobs.ashbyhq.com"].includes(
          u.hostname,
        ) &&
        [2, 3].includes(p.length) &&
        /^[a-z0-9_-]+$/i.test(p[0]) &&
        /^[a-z0-9-]{6,100}$/i.test(p[1]) &&
        (!p[2] || ["apply", "application"].includes(p[2]))
      );
    } catch (_) {
      return false;
    }
  }
  function valid(value) {
    return (
      !!value &&
      value.version === 1 &&
      typeof value.id === "string" &&
      value.id.length <= 100 &&
      Number.isFinite(Date.parse(value.searchedAt)) &&
      typeof value.searchLocation === "string" &&
      value.searchLocation.length <= 200 &&
      Array.isArray(value.jobs) &&
      value.jobs.length === 3 &&
      value.jobs.every(
        (j) =>
          safeLink(j.applyUrl) &&
          [
            "title",
            "company",
            "location",
            "whyFit",
            "requirementsToCheck",
          ].every(
            (k) =>
              typeof j[k] === "string" && !!j[k].trim() && j[k].length < 1500,
          ),
      )
    );
  }
  function create(storage, key) {
    return {
      read() {
        const raw = storage.getItem(key);
        if (!raw) return null;
        const value = JSON.parse(raw);
        if (!valid(value))
          throw Error(
            "Your browser copy could not be read. Refresh jobs to create a new set.",
          );
        return value;
      },
      save(value) {
        if (!valid(value)) throw Error("Invalid saved jobs");
        storage.setItem(key, JSON.stringify(value));
        return value;
      },
    };
  }
  return { safeLink, valid, create };
});
