# Google Analytics setup

Date: 2026-09-08

Goal: Explain how to set up Google Analytics for Ray2Volt Solar.

Observed: The local website uses static HTML. Its pages contain Google Ads tag AW-18014889887. No explicit GA4 measurement ID was identified in the inspected HTML/JavaScript. Google tag destinations configured in Google's interface have not been checked.

Assumptions: The intended website is https://ray2voltsolar.com/. India reporting time and INR suit the business.

Principles: Reuse the existing Google tag where appropriate; avoid duplicate tracking. Verify data collection after publishing.

Decisions: Explain GA4 account/property and web stream creation; request the measurement ID before implementing. No website tracking code changed.

Pending: User creates or identifies the GA4 web stream and provides its G- measurement ID. Then install and verify tracking. Consider successful enquiries, phone clicks and WhatsApp clicks as subsequent measurement needs.

Reference: https://support.google.com/analytics/answer/9304153?hl=en

Follow-up: User screenshot shows Google detected G Tag Sales@R2V 001 (AW-18014889887, GT-KVN8J4PS). Reusing it will replace settings of the new Ray2Volt Solar Website tag with the existing tag settings. Recommend confirming reuse if the Analytics tag is newly created and has no custom settings to preserve; otherwise review Details first. This route can connect Analytics without code changes. After confirmation, verify Realtime before considering additional installation.
