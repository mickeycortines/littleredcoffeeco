# Little Red Coffee Co.

Static site and Cloudflare Pages Function for the Little Red Coffee Co. website.

## Inquiry forms

Both website inquiry forms send a same-origin `POST /api/inquiries` request. The Pages Function exchanges the configured Google refresh token for an access token and sends an email through the Gmail API. It validates the request on the server, uses the visitor's validated email as `Reply-To`, and does not store submissions in browser local storage.

Both forms use Cloudflare Managed Turnstile, and the Pages Function verifies the submitted token and hostname before contacting Google or Gmail. Configure the public site key in `script.js` and set `TURNSTILE_SECRET_KEY` as an encrypted Cloudflare Pages secret. Do not put the private key in source code.

Configure these as encrypted Cloudflare Pages secrets for the relevant deployment environments:

- `TURNSTILE_SECRET_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN`

The Gmail account must authorize the `https://www.googleapis.com/auth/gmail.send` scope. The function sends email from `book@littleredcoffeeco.ca` to `Book@littleredcoffeeco.ca`. Do not put credential values in source code, client-side files, logs, or issue reports.

## Deploy

Deploy this repository as a Git-integrated Cloudflare Pages project so that Pages builds and deploys the `functions/` directory alongside the static site. Configure the production and preview secrets in **Workers & Pages → your Pages project → Settings → Variables and Secrets**. Direct dashboard asset uploads do not deploy Pages Functions.

Set the Pages build command to none and the build output directory to `.` (the repository root), then deploy the selected branch. Connect `littleredcoffeeco.ca` under **Custom domains** if needed.

## Test

1. Run the inquiry handler tests with `node --test tests/inquiries.test.mjs`. They use test-only fake keys and mocked external calls.
2. For a local Functions preview, create a local `.dev.vars` file with the four required values, then run `npx wrangler pages dev .`. The endpoint only accepts the two production hostnames, so local Turnstile submissions fail closed. `.dev.vars*` is gitignored; never commit or share the file.
3. Submit the quick invite form and VIP form with valid data. Confirm each only shows its success state after the API returns success and the message arrives at `Book@littleredcoffeeco.ca` with the visitor's address as `Reply-To`.
4. Test invalid email, an overlong name, an unsupported VIP interest, and a non-empty honeypot field; each must be rejected by the endpoint without sending mail.
5. With the local service or preview unavailable, submit each form and confirm it shows a retry message, retains entered values, and allows a later retry.
6. Confirm the submit buttons disable while a request is pending and that `script.js` no longer writes form data to local storage.

No rate limiting is configured by this change. Cloudflare deployment and live email delivery must be verified in the target Pages project.
