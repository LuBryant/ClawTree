# Credential rotation runbook

Use this runbook after any credential reaches source control, a browser bundle, logs, or an untrusted device. Deleting the value from the latest commit is not revocation.

## Immediate containment

1. Disable the exposed provider key in the DeepSeek console and verify that a direct request with that key is rejected.
2. Create a replacement key with the smallest available permissions and budget cap.
3. Store it only as the deployment secret `DEEPSEEK_API_KEY`; never prefix it with `NEXT_PUBLIC_`.
4. Create a dedicated, least-privilege MySQL user and password. Revoke the previously shared database credential and terminate its active sessions.
5. Store `MYSQL_HOST`, `MYSQL_DATABASE`, `MYSQL_USER`, and `MYSQL_PASSWORD` in the deployment secret store.

## Verification

- `git ls-files .env` prints nothing.
- `npm run secret:scan:source` and `npm run secret:scan:diff` pass before build.
- `npm --prefix frontend run build` followed by `npm run secret:scan:bundle` passes.
- Browser requests go only to `/api/assistant/chat`; provider authorization is added server-side.
- With `DJANGO_DEBUG=false`, missing `DJANGO_SECRET_KEY` or MySQL variables fail startup. A production MySQL `root` user is rejected.

Record provider/database revocation timestamps and the operator in the team's private incident log. Do not put credential fingerprints or values in this repository.
