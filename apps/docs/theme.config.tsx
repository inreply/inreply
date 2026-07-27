import type { DocsThemeConfig } from 'nextra-theme-docs';

const config: DocsThemeConfig = {
  logo: <span style={{ fontWeight: 700 }}>InReply</span>,
  project: {
    link: 'https://github.com/inreply/inreply',
  },
  docsRepositoryBase: 'https://github.com/inreply/inreply/tree/main/apps/docs',
  head: (
    <>
      <title>InReply</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta
        name="description"
        content="Turn inbound email replies into resumable AI conversations."
      />
    </>
  ),
  footer: {
    content: <span>MIT {new Date().getFullYear()} InReply contributors</span>,
  },
};

export default config;
