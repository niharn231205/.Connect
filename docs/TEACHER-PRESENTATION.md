# .Connect — teacher presentation script

Use this as a spoken script, with the actions in brackets as your demo cues. The full version is approximately 8–10 minutes. Replace the name in the opening. The claims below describe implemented features; avoid calling the prototype a live recruitment service.

## Before presenting

- Open the deployed website a few minutes early so Render can wake up.
- Use a demonstration account. Keep a real, readable resume PDF and an unrelated lab-report PDF ready. Use synthetic contact details rather than displaying someone else's personal data.
- Complete one AI practice interview in advance. Download its PDF and JSON backup. This gives you a finished session to show if the AI provider is busy during the presentation.
- Open the history screen, dashboard and resume page in advance. Keep the downloaded PDF available locally.
- Do not show the Render Environment screen or API keys.

## 1. Opening and problem statement — 40 seconds

**Say:**

“Good morning, ma'am/sir. I am [your name], and my project is .Connect, a career preparation and networking platform.

Students often prepare their resume in one place, practice interview questions somewhere else, and use another platform for professional connections. They can also lose track of what they answered in previous practice sessions.

.Connect brings these activities into one workflow: create a profile, upload a valid resume, understand skill gaps, practice with AI, review previous answers, and connect with peers.”

**Show:** The homepage, then point out the consistent navigation.

**Transition:** “I will demonstrate the journey from setting up a profile to reviewing a completed interview.”

## 2. Signup, login and personalisation — 35 seconds

**Say:**

“The user begins by creating an account and choosing their field, interests, experience level, work preference and career goals. These details provide context for the career dashboard and recommendations.

The app uses authenticated API requests. Passwords are hashed on the server; the Gemini API key stays on the server and is not placed in frontend JavaScript.”

**Show:** Login and the questionnaire. Demonstrate editing already-saved preferences.

**What makes this useful:** “The profile is the starting point for several features, instead of asking the student to re-enter the same details on every screen.”

## 3. Resume-only verification — 60 seconds

**Say:**

“A file extension alone cannot prove that a document is a resume. A lab report and a resume can both be PDF files.

Our upload process first checks the allowed format and size, extracts readable text, and asks Gemini to classify the document's actual purpose. Only personal resumes or CVs with a sufficiently confident valid classification are accepted.

Here is a resume that the system accepts. Now I will try an experiment report. The report is rejected, even though it is a PDF. Renaming that report to resume.txt would not change the purpose of its content.

If verification is unavailable, the app does not quietly accept an unchecked file. A rejected upload also preserves the previous accepted resume.”

**Show:** One accepted resume and one rejected lab report. If time is short, show a prepared successful result and demonstrate the rejection live.

**Important distinction:** “This verifies the document type, not whether every qualification or achievement in the resume is true.”

## 4. Resume analysis and dashboard — 45 seconds

**Say:**

“After a resume is accepted, the app extracts relevant skills and gives suggestions about structure, sections and keywords. The dashboard brings together the resume score, skill breakdown, practice history, connections and next steps.

The resume structure score is calculated locally using rules. It is not a Gemini rating, an official ATS result or a guarantee of selection. I have kept that distinction clear in the interface.”

**Show:** Detected skills, resume suggestions, dashboard statistics and roadmap.

**What makes this useful:** “A student sees a next action, such as improving the resume or practicing an interview, rather than receiving only an unexplained number.”

## 5. Role catalogue and resume matching — 45 seconds

**Say:**

“The role catalogue shows example opportunities and compares their required skills with the profile. The displayed percentage describes skill overlap; it is not the probability of being hired.

In the resume matcher, the student can paste a job description and compare it with their accepted resume. The comparison highlights matched skills, missing terms and text similarity. The text-processing code uses TF-IDF and cosine similarity when its machine-learning dependency is available, with a token-vector fallback.

This helps the student decide what to learn or explain more clearly in their resume.”

**Show:** One role card, then a pasted job description and its comparison results.

**Be accurate:** “The current role list is a platform demonstration catalogue, not a live feed from employers. The comparison action does not submit a job application.”

## 6. Batch resume ranking — 35 seconds

**Say:**

“The batch mode compares several resumes against one job description. The same resume-only verification gate applies here as well. An unrelated experiment report cannot bypass the check by entering through the ranking feature.

The results are a comparison of document similarity and skill coverage. They are a learning or screening aid, not an automated hiring decision.”

**Show:** A prepared ranking result. Optionally show that a mixed batch containing a lab report is rejected before ranking.

## 7. AI interview questions and feedback — 75 seconds

**Say:**

“The student chooses a target role, experience level, focus topics and either three or five questions. Gemini generates a fresh set of questions and reference answers for that context.

For example, I can choose Frontend Developer, Beginner, and React with accessibility. I then write my own answer.

When I request feedback, Gemini evaluates the answer for correctness and reasoning, relevance and coverage, and clarity. The interface shows a practice score, what worked and specific improvements. I can compare my original response with the AI reference answer before continuing.

This is actual AI generation and feedback. The current interview flow does not label a simple keyword-counting rule as AI. If Gemini is unavailable, the app shows an error and keeps my answer so I can retry.

These are written practice questions, not employer-certified past interview questions. The score is guidance for learning, not a prediction of employability.”

**Show:** The role/topic controls, a generated question, your typed answer, feedback and reference answer. Use the prepared completed session if generation is slow.

## 8. Interview journal, review and downloads — 60 seconds

**Say:**

“This is an important part of the project: the interview does not disappear when practice ends. The journal stores the questions, my exact answers, AI feedback, reference answers, role, level and date.

I can reopen a completed session to understand what I said and what I should improve. Draft sessions can also be resumed, so a refresh does not force me to begin again.

The PDF is a readable report that I can keep or show to a mentor. The JSON backup preserves the complete structured session. I can export the whole journal and restore it in another browser using Restore backup.

For this no-cost version, the full journal is stored in this browser. It survives app redeploys, but clearing site data or using another device does not automatically carry it over. That is why the backup and restore controls are included.”

**Show:** Finish and save, reopen the session from History, show an original answer, download the PDF, then point out JSON export and restore.

**Memorable line:** “The goal is not just to answer once. It is to turn every practice session into material for revision.”

## 9. Connections and messages — 35 seconds

**Say:**

“Students can discover peers, send connection requests and accept requests. Once connected, they can use the messaging feature to communicate.

The chat uses Socket.IO for live message events. Connection search helps find an accepted contact, and the mobile layout moves clearly between the contact list and a conversation.”

**Show:** A prepared accepted connection and conversation between two demonstration accounts. Avoid messaging a real person during the demo.

**What makes this useful:** “Preparation and peer interaction are available in the same workspace.”

## 10. Profile, portfolio and leaderboard — 35 seconds

**Say:**

“The profile brings together career goals, interests, detected skills and the uploaded resume. Students can also add projects with descriptions and links, so their profile includes evidence of work rather than only a score.

The leaderboard is a platform activity and progress feature. Its composite score combines several in-app signals. It is not a universal ranking of professional ability or an employer selection list.”

**Show:** The project portfolio, profile and leaderboard. Explain an empty state honestly if the demonstration account has no endorsements.

## 11. UI/UX and architecture — 40 seconds

**Say:**

“I designed the interface to feel like a career studio: consistent navigation, readable typography, clear primary actions and responsive layouts. Forms have labels, loading states and recoverable error messages. Keyboard users can open navigation and use the controls.

The frontend uses HTML, CSS and JavaScript. The backend uses Node.js and Express. Python handles document parsing and text analysis. Gemini provides document classification and the new interview generation and feedback. Socket.IO supports messaging. The project is deployed on Render.”

**Show:** Briefly resize the page to a phone width, or show a phone preview. Only open source code if the teacher asks.

## 12. Uniqueness and closing — 40 seconds

**Say:**

“The distinctive part of .Connect is the connected workflow, rather than a claim that no other product has any of these features.

First, it checks document purpose, so an experiment report cannot pass simply because it has a supported extension. Second, the same gate is used for individual uploads and batch comparisons. Third, role-focused AI practice becomes a reusable journal containing the student's original answers. Fourth, PDF and JSON export make that learning portable. Finally, profile building, comparison, practice and peer connections share one workspace.

The project supports a cycle: prepare, practice, reflect and improve. Thank you. I am ready for your questions.”

## Likely teacher questions and clear answers

**Where exactly is AI used?**

“Gemini classifies resume versus non-resume content, generates interview questions and reference answers, and evaluates written interview responses. Resume structure scoring and text-similarity matching use local rules or NLP methods. I do not describe every calculation as AI.”

**How is a lab report different from a resume if both have a student name and college?**

“The classifier looks at the whole document's purpose. Aim, apparatus, procedure, observations and results usually describe an experiment. A resume summarises an individual's career, education, skills, projects and achievements. A brief project involving an experiment is allowed inside a genuine resume; a full lab report is not.”

**Can AI make mistakes?**

“Yes. Scores and model answers are study guidance. We validate the response format and show failures honestly, but structured output does not guarantee factual correctness. Users should check technical explanations and valid alternative solutions.”

**Can I view history on another phone automatically?**

“Not in the selected no-cost storage mode. The full journal is local to the browser. I can export JSON and restore it on another device. Automatic cross-device history would require persistent account storage.”

**What happens if I clear browser data?**

“The local journal can be removed. A previously downloaded JSON backup can restore it. A PDF is a readable copy, but it is not a restorable structured backup.”

**What happens if the internet or Gemini is unavailable?**

“New AI generation and feedback need the provider. Existing local history and downloaded reports remain available. The current answer is preserved for retry, and the app does not invent an AI response.”

**Does your job score guarantee an interview or send an application?**

“No. It compares the profile or resume with listed requirements. The current catalogue and comparison controls do not submit applications or contact recruiters.”

**How did you test this?**

“I tested valid and invalid resume uploads, provider failures, authenticated AI routes, structured-response validation, transcript storage and backup restore, and the main browser flows. I also checked the mobile layouts and the report download. I can show the release checks and source changes.”

**What would you improve next?**

“Persistent account and transcript storage, stronger production access controls and rate limiting, a real employer job integration, and broader evaluation of AI feedback quality. I would add voice practice only after implementing and testing audio handling; it is not claimed in the current written interview feature.”

## A 90-second version if time is cut short

“My project, .Connect, combines career preparation with peer networking. A student creates a profile, uploads a resume, compares skills with a role, practices with AI, and reviews their progress.

The upload gate checks document content rather than trusting an extension. It rejects experiment reports and assignments even if they are uploaded as PDFs or renamed as resumes. The same check protects batch ranking.

For interview practice, the student chooses a role, level and topics. Gemini generates questions and reference answers and provides feedback on the student's written responses. Completed sessions retain the exact questions, original answers and feedback in a browser journal. PDF reports are readable locally, and JSON export and restore make the journal portable.

The dashboard, portfolio, connections and messages complete the workflow. The distinction I want to emphasise is prepare, practice, reflect and improve. Scores are learning aids, not hiring guarantees, and the no-cost history mode is browser-based rather than automatic cross-device storage.”
