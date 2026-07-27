# Security Policy

## Threat model

InReply processes input from two parties, and it helps to keep them separate:

1. **Unauthenticated HTTP callers.** The webhook endpoint is public. Requests
   without a valid provider signature are rejected before anything is parsed
   or fetched (401/400), oversized bodies are refused (1 MiB cap), and error
   responses for unverified callers contain only static text.
2. **Email senders.** A valid signature only proves the _provider_ delivered
   the email; the email itself is written by an arbitrary third party. InReply
   therefore treats subjects, bodies, and threading headers as hostile: reply
   extraction and HTML conversion are bounded against deep nesting and
   pathological inputs, and values that flow into outbound headers
   (`reply.subject`, `reply.headers`) are stripped of control characters.

### What your application must still handle

- **Thread spoofing.** `threadId` comes from the `References` header, which
  the sender controls. Anyone who learns a thread's root Message-ID can send
  an email that resolves to that thread. If you use a shared `ThreadStore`
  and feed `conversation.messages` to an AI, a third party could pull another
  conversation's history into their reply. If threads are sensitive, scope
  store lookups by sender (e.g. key on `threadId + from.email`, or verify
  `conversation.message.from` against the thread's known participants before
  using the history).
- **Prompt injection.** `conversation.message.text` is untrusted text going
  into your model. Treat it like any other user input: don't grant the model
  tools or permissions you wouldn't grant the email sender.
- **`InMemoryThreadStore` is for development.** It caps threads (1000) and
  messages per thread (500) to bound memory, but it is not durable and not
  multi-instance safe.

## Supported versions

Only the latest minor release of `inreply` and `@inreply/resend` receives
security fixes.

## Reporting a vulnerability

InReply handles webhook signature verification, so security reports are taken
seriously.

Please do **not** open a public issue for security problems. Instead, use
[GitHub private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
on this repository ("Security" tab, then "Report a vulnerability").

You can expect an acknowledgement within 72 hours. Please include:

- A description of the issue and its impact
- Steps to reproduce (a failing test or curl command is ideal)
- Affected package and version

Thank you for disclosing responsibly.
