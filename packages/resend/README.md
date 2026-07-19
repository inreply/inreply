# @inreply/resend

The [Resend](https://resend.com) provider for [InReply](https://github.com/inreply/inreply) - turn inbound Resend webhooks into resumable AI conversations.

```ts
import { createInReply } from 'inreply';
import { resend } from '@inreply/resend';

const { resumeConversation } = createInReply({ provider: resend() });
// reads RESEND_API_KEY and RESEND_WEBHOOK_SECRET from the environment
```

Handles svix signature verification, the metadata-only `email.received`
webhook, fetching the full message via the Received Emails API, and mapping
everything into InReply's normalized shape.

📖 **Full documentation: [github.com/inreply/inreply](https://github.com/inreply/inreply)**
