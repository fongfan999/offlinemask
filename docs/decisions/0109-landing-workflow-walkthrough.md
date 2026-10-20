# 0109 — Explain the product through a workflow walkthrough

Date: 2026-10-20

## Context

The owner requested a more modern, animated and trustworthy landing page that explains the problem OfflineMask solves. They explicitly scoped the redesign to the landing page and requested a local desktop walkthrough to inform it.

An isolated debug application was built with a separate bundle identifier, leaving the existing desktop process and its data alone. Using only the built-in synthetic sample, the walkthrough covered masking, the warning about a missed name, manually masking that name, and restoring three aliases in a rewritten synthetic reply. No recognition pack was downloaded and no external AI was contacted.

## Decision

Keep the paper, ink and cobalt palette and self-hosted Vietnamese fonts. Give the hero a direct explanation and a larger, interactive illustration of four stages: original content, masking and review, an AI reply, and restoration. The reply has different wording from the original so restoration demonstrates a useful result.

State explicitly that the example is fictional, the AI reply is prewritten, and users review the output and choose what to send. Describe missed information and unchanged-alias requirements rather than imply perfect recognition or guaranteed restoration.

Use the existing GSAP dependency for entrance motion, stage transitions and a finite, user-started walkthrough. Offer direct stage selection and a stop control. Stop playback when the document becomes hidden or motion preferences change; suppress movement for reduced motion. Dispose timelines, animation contexts and listeners when the host removes the page.

Keep stage copy in `landing/demo.js` beside the portable product fragment, stylesheet and initializer. The standalone Cloudflare Workers host and future Astro/EmDash integration use the same files. No new dependencies, storage, telemetry or runtime network requests are introduced.

## Verification boundary

The native masking and restoration flow was exercised locally. Final browser screenshot and interaction verification of this landing revision was interrupted because the browser tool reported that local browser access was disabled in Work settings. Build and source checks are separate from visual validation; the latter remains required before publishing.

## Follow-up — stronger visual hierarchy

The owner judged the first revision insufficiently improved. Replace the centered hero and oversized imitation desktop window with a split composition: a direct benefit and download action beside a compact interactive example. Remove the decorative sidebar and duplicate source panel. Keep the original-content stage available through the existing controls.

Use larger workflow cards and readable supporting text, softer button styling, and a contained download section. Preserve the shared palette, Vietnamese fonts, four-stage GSAP behavior and cleanup contract. Stack the hero and cards at narrower widths. No desktop changes or new dependencies are needed.

Browser access still reports disabled despite the owner's screenshot showing it enabled. This follow-up requires visual and interaction verification once access is available; build success alone does not establish visual quality.
