# Live job shortlists

Overview and the authenticated sidebar link to `/apply-jobs.html`. The existing Role catalogue remains demonstration data; Apply for jobs searches live employer postings.

Uses the existing `GEMINI_API_KEY` and `GEMINI_MODEL` (structured-output capable text model; Search uses a separate Search-capable model). `GEMINI_JOB_SEARCH_MODEL` optionally selects the grounding model (default `gemini-3.5-flash-lite`, bounded fallback `gemini-3.8-flash`). The Search call uses text output and validates candidates after retrieval, so a text-only fallback model is not mistakenly used for grounding. No new hosting service or secret is required. Google API usage is governed by the project's quotas and billing settings.

## Search and validation

1. The server uses only the signed-in user's saved, Gemini-accepted resume. A request cannot supply another user's resume or identity.
2. Gemini extracts role phrases, skills, experience level and an explicitly stated location. Contact details are masked. Only this professional search profile is sent into the Google Search step, not the resume text.
3. Google Search finds specific employer posting URLs on Greenhouse, Lever or Ashby. Search grounding metadata is required. The server checks the exact posting against the provider's public publishing API. Arbitrary model-supplied hosts are never fetched.
4. Gemini selects three verified postings, with reasons and requirements to check. Titles, employer metadata and application links come from verified provider records. Entry-level searches exclude explicitly senior/manager titles. This is guidance, not an eligibility or hiring decision.

If three suitable published postings cannot be confirmed, the search fails honestly rather than inventing entries. A broader location may help. Published does not guarantee a vacancy will remain open later.

## Persistence and API

- `GET /api/jobs/applications`: protected, returns the user's saved set and task status. Never starts a search.
- `POST /api/jobs/applications/search`: protected. `{refresh:false, location:""}` starts only the first search. Existing saved results are returned unchanged. `{refresh:true, location:"Remote"}` explicitly requests replacement.
- Search returns 202 immediately and runs a bounded background task; the page polls GET. Concurrent requests share the pending task. Resume changes during a task invalidate its output.
- A complete valid set replaces the previous set atomically in `backend/data/application-jobs.json`; failed searches leave it intact. The runtime file is gitignored. Disk storage on the current Render service is ephemeral.
- A per-account browser copy (keyed by a SHA-256 email identifier) survives server redeploys on that browser. It is not encryption. Clearing site storage, changing browser/device or an unavailable prior account mapping can remove access to that copy. Server persistence on this host does not promise permanent cross-device history.
- The page prefers a newer completed server set, retains a local copy when the server has none, and never refreshes on an ordinary reload, route revisit, resume change or location edit. Editing location requires the explicit Refresh action.
- Google Search suggestions render in a sandboxed iframe with no scripts, forms or same-origin access. Generated text is rendered with textContent and employer URLs are restricted to supported HTTPS ATS hosts.

No job application is submitted. An Apply link opens the employer page with `noopener noreferrer`.

## Verification

Run `cd backend && npm test`. Tests cover exact ATS identity checks, unsafe URL rejection, grounding requirement, account isolation, first-search/refresh semantics, task concurrency, changed-resume rejection, atomic preservation and browser-copy validation.

Official API references: [Google Search grounding](https://ai.google.dev/gemini-api/docs/google-search), [structured output](https://ai.google.dev/gemini-api/docs/structured-output), [Greenhouse](https://docs.greenhouse.io/job-board.html), [Lever](https://github.com/lever/postings-api), [Ashby](https://developers.ashbyhq.com/docs/public-job-posting-api).
