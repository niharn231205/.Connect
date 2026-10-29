const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  postingRef,
  verifyPosting,
} = require("../services/employerJobsService");
const { searchJobs } = require("../services/jobSearchService");
const { createJobStore } = require("../services/applicationJobsStore");
const {
  createApplicationJobs,
} = require("../controllers/applicationJobsController");
const SavedJobs = require("../../frontend/js/saved-jobs");
const reply = () => ({
  statusCode: 200,
  status(n) {
    this.statusCode = n;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});
const resume = () => ({
  verifiedByAI: true,
  verifiedAt: "2026-10-29T00:00:00Z",
  extractedText:
    "Alex Example. alex@example.invalid. Education: CS student. Skills: Python, SQL. Project: Built a library database.",
  verification: {
    provider: "gemini",
    isResume: true,
    documentType: "resume",
    confidence: 0.99,
  },
});
const job = (n = 0) => ({
  id: "greenhouse:acme:" + String(100000 + n),
  title: "Software intern " + n,
  company: "Acme",
  location: "Remote",
  applyUrl:
    "https://job-boards.greenhouse.io/acme/jobs/" + (100000 + n) + "#app",
  source: "greenhouse",
  whyFit: "Your Python project is relevant.",
  requirementsToCheck: "Check location and student eligibility.",
  checkedAt: new Date().toISOString(),
});
const result = () => ({
  jobs: [0, 1, 2].map(job),
  searchLocation: "Remote",
  searchedAt: new Date().toISOString(),
});
const saved = () => ({
  ...result(),
  id: "set-one",
  version: 1,
  resumeFingerprint: "old",
  requestedLocation: "Remote",
});
function harness(search = async () => result()) {
  const users = {
      one: { id: "one", resume: resume() },
      two: { id: "two", resume: resume() },
    },
    sets = {};
  const handler = createApplicationJobs({
    database: { findUserById: (id) => users[id] },
    store: {
      get: (id) => sets[id] || null,
      set: (id, value) => {
        sets[id] = value;
      },
    },
    search,
  });
  return {
    users,
    sets,
    handler,
    request: (id = "one", body = {}) => ({ user: { id }, body }),
  };
}
test("only specific HTTPS postings on employer ATS hosts can be verified", () => {
  for (const url of [
    "https://example.com/a",
    "http://jobs.lever.co/acme/abcdef",
    "https://jobs.lever.co.evil.test/acme/abcdef",
    "https://u:p@jobs.lever.co/acme/abcdef",
    "https://jobs.lever.co:444/acme/abcdef",
    "https://job-boards.greenhouse.io/acme",
    "https://jobs.ashbyhq.com/acme/abcdef/evil",
  ]) {
    assert.equal(postingRef(url), null);
    assert.equal(SavedJobs.safeLink(url), false);
  }
  for (const url of [
    job().applyUrl,
    "https://jobs.eu.lever.co/acme/abcdef-123456/apply",
    "https://jobs.ashbyhq.com/acme/abcdef-123456/application",
  ]) {
    assert.ok(postingRef(url));
    assert.equal(SavedJobs.safeLink(url), true);
  }
});
test("posting details come from published employer APIs, and closed or redirected jobs are rejected", async () => {
  let called;
  const request = async (url, options) => {
    called = url;
    assert.equal(options.redirect, "error");
    return Response.json({
      id: 100000,
      title: "Actual intern",
      company_name: "Actual company",
      location: { name: "Remote" },
      content:
        "Python software development internship. Build tested services and learn from experienced engineers.",
    });
  };
  const found = await verifyPosting(
    { url: job().applyUrl, company: "Invented company" },
    { request },
  );
  assert.equal(found.company, "Actual company");
  assert.equal(found.title, "Actual intern");
  assert.match(
    called,
    /^https:\/\/boards-api.greenhouse.io\/v1\/boards\/acme\/jobs\/100000$/,
  );
  assert.equal(
    await verifyPosting(
      { url: job().applyUrl },
      { request: async () => new Response("", { status: 404 }) },
    ),
    null,
  );
  assert.equal(
    await verifyPosting(
      { url: job().applyUrl },
      {
        request: async () =>
          Response.json({
            id: 100000,
            title: "Intern",
            application_deadline: "2000-01-01",
            content: "x".repeat(100),
          }),
      },
    ),
    null,
  );
  assert.equal(
    await verifyPosting(
      { url: "https://jobs.lever.co/acme/abcdef-123456" },
      {
        request: async () =>
          Response.json({
            id: "abcdef-123456",
            text: "Intern",
            descriptionPlain: "x".repeat(100),
            applyUrl: "https://evil.test/apply",
          }),
      },
    ),
    null,
  );
});
test("Ashby and Lever validate the exact posting identity and published application URL", async () => {
  const id = "abcdef-123456",
    url = "https://jobs.ashbyhq.com/acme/" + id;
  const item = {
    title: "Python intern",
    location: "Remote",
    descriptionPlain: "x".repeat(80),
    jobUrl: url,
    applyUrl: url + "/application",
    isListed: true,
  };
  assert.equal(
    (
      await verifyPosting(
        { url, company: "Acme" },
        { request: async () => Response.json({ jobs: [item] }) },
      )
    ).applyUrl,
    item.applyUrl,
  );
  assert.equal(
    await verifyPosting(
      { url },
      {
        request: async () =>
          Response.json({ jobs: [{ ...item, isListed: false }] }),
      },
    ),
    null,
  );
  const lever = "https://jobs.lever.co/acme/" + id;
  assert.equal(
    (
      await verifyPosting(
        { url: lever },
        {
          request: async () =>
            Response.json({
              id,
              text: "Intern",
              categories: { location: "Remote" },
              descriptionPlain: "x".repeat(80),
              applyUrl: lever + "/apply",
            }),
        },
      )
    ).applyUrl,
    lever + "/apply",
  );
});
test("Google-grounded search verifies candidates and only ranks verified employer data", async (t) => {
  const previous = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-key";
  t.after(() =>
    previous === undefined
      ? delete process.env.GEMINI_API_KEY
      : (process.env.GEMINI_API_KEY = previous),
  );
  let stage = 0;
  const request = async (url, options) => {
    const body = JSON.parse(options.body),
      input = JSON.parse(body.contents[0].parts[0].text);
    stage++;
    let value, groundingMetadata;
    if (stage === 1) {
      assert.ok(!input.resumeText.includes("alex@example.invalid"));
      value = {
        roles: ["Software intern", "Python intern"],
        skills: ["Python", "SQL"],
        level: "internship_entry",
        location: "",
      };
    }
    if (stage === 2) {
      assert.deepEqual(body.tools, [{ googleSearch: {} }]);
      assert.equal(
        body.generationConfig,
        undefined,
        "grounding must also work on Search models without tool + JSON mode",
      );
      assert.equal(input.profile.resumeText, undefined);
      value = {
        candidates: [0, 1, 2].map((n) => ({
          url: job(n).applyUrl,
          company: "Acme",
        })),
      };
      groundingMetadata = {
        webSearchQueries: ["Python intern Remote"],
        searchEntryPoint: { renderedContent: "<div>Search suggestions</div>" },
      };
    }
    if (stage === 3) {
      assert.equal(input.candidates.length, 3);
      assert.equal(input.candidates[0].title, "Verified Python intern");
      value = {
        jobs: [0, 1, 2].map((index) => ({
          index,
          whyFit: "Python projects are relevant.",
          requirementsToCheck: "Review student requirements.",
        })),
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            finishReason: "STOP",
            content: { parts: [{ text: JSON.stringify(value) }] },
            groundingMetadata,
          },
        ],
      }),
    };
  };
  const postingRequest = async (url) =>
    Response.json({
      id: Number(url.split("/").pop()),
      title: "Verified Python intern",
      company_name: "Acme",
      location: { name: "Remote" },
      content:
        "Python internship for students. Build real services and practice testing with our engineering team.",
    });
  const found = await searchJobs(
    { resumeText: resume().extractedText, location: "Remote" },
    { request, postingRequest },
  );
  assert.equal(stage, 3);
  assert.equal(found.jobs.length, 3);
  assert.equal(found.jobs[0].description, undefined);
  assert.equal(found.provider, "gemini_google_search");
});
test("ungrounded search and missing configuration never produce pretend jobs", async (t) => {
  const previous = process.env.GEMINI_API_KEY;
  t.after(() =>
    previous === undefined
      ? delete process.env.GEMINI_API_KEY
      : (process.env.GEMINI_API_KEY = previous),
  );
  delete process.env.GEMINI_API_KEY;
  await assert.rejects(searchJobs({ resumeText: "resume" }), {
    code: "JOB_SEARCH_UNAVAILABLE",
  });
  process.env.GEMINI_API_KEY = "test";
  let stage = 0;
  const request = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [
        {
          finishReason: "STOP",
          content: {
            parts: [
              {
                text: JSON.stringify(
                  ++stage === 1
                    ? {
                        roles: ["Python intern", "SQL intern"],
                        skills: [],
                        level: "internship_entry",
                        location: "",
                      }
                    : { candidates: [] },
                ),
              },
            ],
          },
        },
      ],
    }),
  });
  await assert.rejects(searchJobs({ resumeText: "resume" }, { request }), {
    code: "JOB_SEARCH_UNAVAILABLE",
  });
});
test("saved sets survive a store restart, remain isolated by user, and invalid replacement preserves the old set", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "connect-jobs-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, "jobs.json"),
    store = createJobStore(file);
  store.set("one", saved());
  assert.equal(createJobStore(file).get("one").id, "set-one");
  assert.equal(store.get("two"), null);
  assert.throws(() => store.set("one", { ...saved(), jobs: [] }));
  assert.equal(store.get("one").jobs.length, 3);
  assert.deepEqual(fs.readdirSync(dir), ["jobs.json"]);
});
test("GET never searches; first search is user-specific, ignores forged resume, and reloads keep the same set", async () => {
  let calls = 0,
    last;
  const h = harness(async (input) => {
    calls++;
    last = input;
    return result();
  });
  let res = reply();
  h.handler.get(h.request(), res);
  assert.equal(res.body.saved, null);
  assert.equal(calls, 0);
  res = reply();
  h.handler.start(
    h.request("one", { resumeText: "forged", userId: "two" }),
    res,
  );
  assert.equal(res.statusCode, 202);
  await h.handler.waitForIdle("one");
  assert.equal(calls, 1);
  assert.equal(last.resumeText, h.users.one.resume.extractedText);
  const id = h.sets.one.id;
  res = reply();
  h.handler.start(h.request(), res);
  assert.equal(res.body.saved.id, id);
  assert.equal(calls, 1);
  h.handler.get(h.request("two"), (res = reply()));
  assert.equal(res.body.saved, null);
});
test("only explicit refresh replaces jobs; failed refresh keeps the saved shortlist", async () => {
  let calls = 0;
  const h = harness(async () => {
    if (++calls === 3) throw Error("provider failure");
    return result();
  });
  h.handler.start(h.request(), reply());
  await h.handler.waitForIdle("one");
  const first = h.sets.one.id;
  h.handler.start(
    h.request("one", { refresh: true, location: "Remote" }),
    reply(),
  );
  await h.handler.waitForIdle("one");
  const second = h.sets.one.id;
  assert.notEqual(first, second);
  h.handler.start(h.request("one", { refresh: true }), reply());
  await h.handler.waitForIdle("one");
  const res = reply();
  h.handler.get(h.request(), res);
  assert.equal(res.body.status, "failed");
  assert.equal(res.body.saved.id, second);
});
test("concurrent requests share one background task and changed resumes cannot overwrite saved jobs", async () => {
  let done,
    calls = 0;
  const h = harness(() => {
    calls++;
    return new Promise((resolve) => (done = resolve));
  });
  h.sets.one = saved();
  h.handler.start(h.request("one", { refresh: true }), reply());
  await Promise.resolve();
  const waiting = h.handler.waitForIdle("one");
  const res = reply();
  h.handler.start(h.request("one", { refresh: true }), res);
  assert.equal(res.statusCode, 202);
  assert.equal(calls, 1);
  h.users.one.resume.extractedText += " changed";
  done(result());
  await waiting;
  h.handler.get(h.request(), res);
  assert.equal(res.body.saved.id, "set-one");
  assert.equal(res.body.error.code, "RESUME_CHANGED");
});
test("unverified resumes, missing users and invalid location cannot start a search", () => {
  const h = harness();
  h.users.one.resume.verification.isResume = false;
  let res = reply();
  h.handler.start(h.request(), res);
  assert.equal(res.statusCode, 422);
  res = reply();
  h.handler.start(h.request("missing"), res);
  assert.equal(res.statusCode, 404);
  for (const body of [
    { refresh: "yes" },
    { location: "https://evil.test" },
    { location: "a@b.com" },
    { location: "x".repeat(161) },
  ]) {
    res = reply();
    h.handler.start(h.request("one", body), res);
    assert.equal(res.statusCode, 400);
  }
});
test("browser backups survive new instances, are isolated by identity, and reject unsafe links", () => {
  const values = new Map(),
    storage = {
      getItem: (key) => values.get(key) || null,
      setItem: (key, value) => values.set(key, value),
    };
  SavedJobs.create(storage, "user-a").save(saved());
  assert.equal(SavedJobs.create(storage, "user-a").read().jobs.length, 3);
  assert.equal(SavedJobs.create(storage, "user-b").read(), null);
  const bad = saved();
  bad.jobs[0].applyUrl = "javascript:alert(1)";
  assert.throws(() => SavedJobs.create(storage, "user-a").save(bad));
  assert.equal(SavedJobs.create(storage, "user-a").read().id, "set-one");
});


test('Search retries stay on supported grounding models and grounded text still requires employer verification', async t => {
 const before=process.env.GEMINI_API_KEY;process.env.GEMINI_API_KEY='test';t.after(()=>before===undefined?delete process.env.GEMINI_API_KEY:process.env.GEMINI_API_KEY=before);
 let searches=0;
 const request=async(url,options)=>{
  const body=JSON.parse(options.body);
  let value;
  if(body.tools){
   searches++;
   if(searches<3)return {ok:false,status:429,headers:new Headers()};
   assert.match(url,/models\/gemini-3\.8-flash:generateContent$/);
   return {ok:true,status:200,json:async()=>({candidates:[{finishReason:'STOP',groundingMetadata:{webSearchQueries:['Python intern']},content:{parts:[{text:'Employer openings: '+[0,1,2].map(n=>job(n).applyUrl).join(' ')}]}}]})};
  }
  const input=JSON.parse(body.contents[0].parts[0].text);
  value=input.candidates?{jobs:[0,1,2].map(index=>({index,whyFit:'Relevant Python skills.',requirementsToCheck:'Check requirements.'}))}:{roles:['Python intern','SQL intern'],skills:['Python'],level:'internship_entry',location:''};
  return {ok:true,status:200,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(value)}]}}]})};
 };
 const postingRequest=async url=>Response.json({id:Number(url.split('/').pop()),title:'Python intern',company_name:'Acme',location:{name:'Remote'},content:'Python internship for students with projects. Build software and learn with the engineering team.'});
 const found=await searchJobs({resumeText:resume().extractedText},{request,postingRequest,wait:async()=>{}});
 assert.equal(searches,3);assert.equal(found.jobs.length,3);assert.equal(found.jobs[0].title,'Python intern');
});


test('provider rate limit is actionable and preserves previous jobs',async()=>{
 const h=harness(async()=>{throw Object.assign(Error('limited'),{code:'JOB_SEARCH_RATE_LIMITED'});});h.sets.one=saved();h.handler.start(h.request('one',{refresh:true}),reply());await h.handler.waitForIdle('one');const res=reply();h.handler.get(h.request(),res);assert.equal(res.body.saved.id,'set-one');assert.equal(res.body.error.code,'JOB_SEARCH_RATE_LIMITED');assert.match(res.body.error.message,/429/);
});
