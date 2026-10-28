# .Connect — Career Studio design direction

Status: Approved by the user and implemented across the app.

[Interactive preview](https://p.superdesign.dev/draft/ef37f691-be66-4a37-a831-76a204e8166e) · [Superdesign canvas](https://superdesign.dev/teams/4be9d11b-143d-4944-909c-f843273627ff/projects/250725b0-eb1d-4b43-a980-a7d436878906)

## Reference and visual approach

Reference: [Godly](https://godly.design/), inspected on 28 October 2026. The directly inspected desktop page has a black canvas, a left navigation rail, a Georgia display heading and a varied masonry gallery. Its heading computes to Georgia, 48px, weight 500 and 52.8px line height. A separate Firecrawl light-theme capture uses a white canvas and #18181B primary text. These are distinct observed themes; the proposed warm ivory palette below is an adaptation for .Connect.

The design borrows editorial type contrast, controlled framing, restrained accent color and varied showcase proportions. It preserves .Connect's actual textual wordmark and amber identity. Godly's logo, other sites' gallery artwork and navigation taxonomy are not reused. Superdesign's automatic website extraction aborted twice; the reference analysis uses the inspected screenshots and page styles instead.

## Proposed tokens

| Role | Value |
| --- | --- |
| Main paper canvas | #F4F1E9 |
| Surface | #FFFEFA |
| Ink / primary action | #11110F |
| Supporting text | #64635D |
| Brand amber | #F59E0B |
| Amber hover | #D97706 |
| Rules and borders | #D8D5CC |
| Dark product stage | #1C1C18 |
| Text on dark | #FAF8F2 |
| Supporting text on dark | #B8B5AC |
| Success / danger / warning | #2D6A4F / #B53535 / #8A5600 |

Georgia provides the editorial display type; Plus Jakarta Sans provides body, navigation, controls and the wordmark. Desktop hero type is 88px, scaling to 64px on tablet and 48px on narrow mobile. The main container is 1280px maximum with responsive gutters. Cards use 16–24px radii; the primary action uses a pill shape and at least 44px height. Amber buttons and surfaces use ink text for contrast.

## Homepage composition

- Compact header with the genuine .Connect. wordmark, Login and Get Started.
- Two-line editorial headline: “Your next / chapter.” A concise explanation and visible create-profile action.
- Native product illustration: a fictional resume layered over an ink studio board, with a written practice prompt. The illustration is labeled as an example; no actual user data is shown.
- Varied feature layout: a wide resume-analysis showcase, a dark written-practice showcase and an open horizontal peer-connections section.
- Three-step journey: create a profile, verify a resume, choose the next action.
- Plain-language FAQ for formats, size limits, document checks and score interpretation.
- One final create-profile action and a concise footer with working destinations.

The illustration uses editable HTML/CSS rather than downloaded stock photography. Header and footer preserve the existing text identity; there is no source image logo to replace.

## Product-wide UX direction

Apply this system consistently to signup/login, career onboarding, resume upload, dashboard, profile, connections/messages, jobs, resume matching, written interview practice and leaderboard after approval. Preserve the existing URLs, form IDs, script hooks and API contracts.

Prioritize a useful next action on the dashboard, consistent navigation with a mobile disclosure, associated form labels, accessible password controls and native form semantics. Error messages should persist, be announced and offer a clear recovery route. Motion should remain restrained and honor prefers-reduced-motion.

Resume validation must remain unchanged: PDF/DOCX/TXT, maximum 5 MB, rejection of experiment reports and assignments, Gemini document-type classification and preservation of the previous valid profile on rejection. Explain that structure/keyword scores do not predict hiring decisions and that document classification does not verify credentials. Use indeterminate processing rather than invented progress percentages.

## Review and validation

The draft was reviewed at the browser's 1280×720 desktop viewport and at 360×800 mobile width. The primary desktop action fits within the initial viewport, and the draft has no horizontal page overflow at those widths. Review corrections addressed the mobile header, illustration overlap, heading order, example labels and link destinations. The approved system is now implemented in native HTML, CSS and JavaScript across all 13 routes.
