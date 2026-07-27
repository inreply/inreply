# inreply

## 0.1.0

### Minor Changes

- 6adddf6: Initial release.

  - `inreply` - the provider-agnostic core: `createInReply()`, the `Conversation`
    object, reply cleaning (quoted history + signatures), stateless thread
    resolution from Message-ID/References, typed `InReplyError`s, optional
    `ThreadStore` with a bundled `InMemoryThreadStore`, and the `InboundProvider`
    contract for provider authors.
  - `@inreply/resend` - the first provider: svix webhook verification, the
    metadata-only `email.received` flow, body fetch via the Received Emails API,
    and mapping to the normalized `InboundEmail`.
