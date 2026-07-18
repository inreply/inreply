# inreply

**Turn inbound email replies into resumable AI conversations.**

```ts
import { createInReply } from 'inreply';
import { resend } from '@inreply/resend';

const { resumeConversation } = createInReply({ provider: resend() });

const conversation = await resumeConversation(request);
await myAgent.reply(conversation);
```

InReply hides webhook verification, email parsing, quoted-reply stripping, and
thread reconstruction behind one clean `Conversation` object that any AI
framework can consume.

This is the provider-agnostic core. Pair it with a provider package —
[`@inreply/resend`](https://www.npmjs.com/package/@inreply/resend) is the first.

📖 **Full documentation: [github.com/inreply/inreply](https://github.com/inreply/inreply)**
