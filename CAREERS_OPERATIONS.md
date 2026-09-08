# Hiring application operations

- Live page: https://ray2voltsolar.com/careers.html
- Form: `hiring-form`. Optional fields: date of birth, email and résumé URL. No role-specific screening questions.
- Email route: the same Web3Forms access key used by the existing contact form. The service keeps the destination address private; the repository does not expose it.
- Notification subject: `New Hiring Application - <preferred role>`.
- Technical verification on 8 September 2026: Web3Forms accepted the clearly labeled no-attachment test with HTTP 200 and `success: true`. Inbox receipt is not observable from this repository. Owner should locate `[TEST - IGNORE] Ray2Volt hiring form email notification` in the existing form inbox/spam folder before paid traffic starts.
- The current Web3Forms plan rejects file uploads. The owner approved an optional résumé URL instead. Only HTTP/HTTPS URLs without embedded credentials are accepted by the browser. Links are submitted as text, never rendered as applicant-controlled HTML. A file is not uploaded or stored by this site.
- This is a static GitHub Pages site. Required-field, phone, date, selection and URL validation run in the browser; Web3Forms handles the server-side mail transport and anti-spam. There is no custom backend enforcing the recruitment schema, so treat all received applicant data as untrusted and verify in screening.
- A hidden `botcheck` field uses the existing Web3Forms honeypot pattern. Service rate limits may reject traffic; failures preserve answers and offer a retry/contact option. Do not automatically retry after an ambiguous network failure.
- Success is shown only after an HTTP-success JSON response with literal `success: true`. No customer enquiry thank-you redirect or customer lead conversion is fired by this form.
- On success, the page pushes exactly one event per loaded form instance: `{ event: 'job_application_submitted', form_id: 'ray2volt_hiring' }` to `window.dataLayer`. No applicant personal data is included. Lasan must wire and verify recruitment-specific Meta/Google conversion tags before optimizing ads to this event; this code alone does not install Meta Pixel or a Google recruitment conversion action.
- UTM parameters plus `gclid`, `gbraid`, `wbraid` and `fbclid` from the application-page URL are included in the email (each capped at 500 characters). Attribution is not carried across other pages or persisted in cookies. Use the careers URL directly in ads. The recorded page URL excludes the query string.
- Seven focused checks run with `node --test tests/careers.test.cjs`. JavaScript syntax can be checked with `node --check careers.js`.
- Manually verified desktop, tablet and 390px mobile layout, alternate WhatsApp visibility and mutually exclusive `None` experience selection. No automated live applicant submissions are part of tests.
