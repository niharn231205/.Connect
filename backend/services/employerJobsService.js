// Read only published employer postings from known ATS APIs. Never fetch a model-supplied host.
const text = (v, max = 500) =>
  typeof v === "string" && !!v.trim() && v.length <= max;
function postingRef(value) {
  let u;
  try {
    u = new URL(value);
  } catch (_) {
    return null;
  }
  if (u.protocol !== "https:" || u.username || u.password || u.port)
    return null;
  const p = u.pathname.split("/").filter(Boolean);
  let provider, board, id;
  if (
    ["boards.greenhouse.io", "job-boards.greenhouse.io"].includes(u.hostname) &&
    p.length === 3 &&
    p[1] === "jobs" &&
    /^\d+$/.test(p[2])
  ) {
    provider = "greenhouse";
    board = p[0];
    id = p[2];
  } else if (
    ["jobs.lever.co", "jobs.eu.lever.co"].includes(u.hostname) &&
    [2, 3].includes(p.length) &&
    (!p[2] || p[2] === "apply")
  ) {
    provider = "lever";
    board = p[0];
    id = p[1];
  } else if (
    u.hostname === "jobs.ashbyhq.com" &&
    [2, 3].includes(p.length) &&
    (!p[2] || p[2] === "application")
  ) {
    provider = "ashby";
    board = p[0];
    id = p[1];
  }
  if (
    !provider ||
    !board ||
    !/^[a-z0-9_-]{1,100}$/i.test(board) ||
    !/^[a-z0-9-]{6,100}$/i.test(id)
  )
    return null;
  return {
    provider,
    board,
    id,
    host: u.hostname,
    key: provider + ":" + board.toLowerCase() + ":" + id,
  };
}
async function publicJson(url, request) {
  const r = await request(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(12000),
    redirect: "error",
  });
  if (!r.ok) return null;
  if (Number(r.headers.get("content-length")) > 6000000)
    throw Error("Large posting response");
  const reader = r.body.getReader();
  let size = 0;
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 6000000) {
      await reader.cancel();
      throw Error("Large posting response");
    }
    chunks.push(Buffer.from(value));
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
function plain(value) {
  return String(value || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}
function companyName(slug, suggested) {
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  return text(suggested, 160) && norm(slug) === norm(suggested)
    ? suggested
    : slug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
async function verifyPosting(
  candidate,
  { request = globalThis.fetch, now = Date.now } = {},
) {
  const ref = postingRef(candidate.url);
  if (!ref) return null;
  let data, title, location, description, applyUrl, company;
  if (ref.provider === "greenhouse") {
    data = await publicJson(
      `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(ref.board)}/jobs/${ref.id}`,
      request,
    );
    if (
      !data ||
      String(data.id) !== ref.id ||
      (data.application_deadline &&
        Date.parse(data.application_deadline) < now())
    )
      return null;
    title = data.title;
    location = data.location?.name;
    description = plain(data.content);
    company = data.company_name || companyName(ref.board, candidate.company);
    applyUrl = `https://job-boards.greenhouse.io/${ref.board}/jobs/${ref.id}#app`;
  } else if (ref.provider === "lever") {
    const api =
      ref.host === "jobs.eu.lever.co" ? "api.eu.lever.co" : "api.lever.co";
    data = await publicJson(
      `https://${api}/v0/postings/${encodeURIComponent(ref.board)}/${ref.id}?mode=json`,
      request,
    );
    if (!data || data.id !== ref.id) return null;
    title = data.text;
    location = data.categories?.location;
    description = plain(data.descriptionPlain || data.description);
    company = companyName(ref.board, candidate.company);
    applyUrl = data.applyUrl;
    const link = postingRef(applyUrl);
    if (!link || link.key !== ref.key) return null;
  } else {
    data = await publicJson(
      `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(ref.board)}?includeCompensation=false`,
      request,
    );
    data = data?.jobs?.find((job) => {
      const link = postingRef(job.jobUrl);
      return link?.key === ref.key && job.isListed !== false;
    });
    if (!data) return null;
    title = data.title;
    location = data.location;
    description = plain(data.descriptionPlain || data.descriptionHtml);
    company = companyName(ref.board, candidate.company);
    applyUrl = data.applyUrl;
    const link = postingRef(applyUrl);
    if (!link || link.key !== ref.key) return null;
  }
  if (
    !text(title, 240) ||
    !text(company, 160) ||
    description.length < 60 ||
    /talent (community|network)|general application|future opportunities/i.test(
      title,
    )
  )
    return null;
  return {
    id: ref.key,
    title,
    company,
    location: text(location, 300) ? location : "Location not specified",
    applyUrl,
    sourceUrl: candidate.url,
    source: ref.provider,
    description: description.slice(0, 12000),
    checkedAt: new Date(now()).toISOString(),
  };
}
module.exports = { postingRef, verifyPosting };
