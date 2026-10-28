# Resume matcher AI role guidance

Authenticated `POST /api/jobs/career-advice` accepts only optional `jdText`
(0–15,000 characters). It reads the signed-in user's saved, Gemini-accepted
resume; caller-supplied resume text and user IDs are never used. Unverified or
unreadable resumes are rejected before a provider call.

Gemini returns three roles to explore, why each connects to the resume, literal
resume evidence, skills to build, next steps, truthful resume improvements and
optional job-description notes. Every evidence excerpt must occur in the resume
text. Invalid or unsupported output returns a recoverable error. These checks
reduce fabricated evidence; they do not guarantee the correctness of AI advice.

Email addresses and likely phone numbers are masked before the request. The
prompt excludes protected characteristics and prohibits invented experience,
credentials, salaries, vacancies and hiring guarantees. Display uses text nodes.

The existing local NLP comparison runs independently alongside AI guidance. An
independent AI button also supports resume-only exploration.
Provider failure does not erase the skill comparison. Changing the job
description marks displayed advice stale. Updating a resume during an AI request
rejects the stale result. Successful responses are cached per user, resume
revision and job description for 30 minutes, with a bounded in-memory cache.

Configuration reuses the existing Gemini key/model settings. There is no paid
resource provisioning or new dependency. Recommendations are not saved as
permanent account history. The app's existing temporary server storage still
applies to uploaded resumes and profiles.
