# AI interview practice and local journal

The interview screen uses authenticated `POST /api/interview/generate` and
`POST /api/interview/evaluate-ai`. Both call Gemini on the server with structured
JSON output and bounded retries. `/evaluate` is an alias for the AI evaluator.
There is no heuristic fallback advertised as AI. The older question/answer bank
and its PDF endpoint remain available as a general practice resource.

Configuration reuses `GEMINI_API_KEY`, `GEMINI_MODEL` and optional fallback-model
settings. The key is never sent to the browser. Interview requests allow a
65-second total provider budget; resume-verification timing remains unchanged.

The full transcript is saved in browser localStorage, scoped to a hash of the
authenticated account email. A cached identity allows local review when the
server cannot be reached. This intentionally selected no-cost mode is not
automatic account sync. Browser data clearing, private browsing and device
changes can remove access. PDF is a reading copy; versioned JSON backups can
restore the structured journal. Imports validate every session before one atomic
write and do not silently replace completed records or evict old sessions on
quota errors. Treat downloaded backups as personal files.

The browser saves drafts, accepted feedback and completed sessions. Review uses
text nodes for user and AI content. A PDF/JSON download includes original answers,
questions, reference answers and feedback. PDF generation uses the vendored
MIT-licensed jsPDF 4.2.1. Reports with non-Latin characters use a printable browser
report to preserve those characters; JSON always preserves the complete text.

Only a role/score/session ID summary is posted to the existing dashboard API.
That summary still uses the service's temporary server storage. The journal is
independent of that temporary summary. Backup imports do not recreate dashboard
scores. Gemini judgments are practice guidance, not employment decisions.

Tests cover provider success/failure/malformed output, auth, limits and overlapping
requests, storage reload, exact transcript round trips, account separation,
invalid imports and quota errors. Browser QA covers generation, written answers,
draft resume, completion, later review, PDF/JSON download, restore and mobile.
