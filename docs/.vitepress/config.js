import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Trionary',
  description: 'A plain-English backend language that compiles to Node.js',
  base: '/spml/',

  head: [
    ['link', { rel: 'icon', href: '/spml/favicon.ico' }],
  ],

  themeConfig: {
    logo: null,
    siteTitle: 'Trionary',

    nav: [
      { text: 'Home', link: '/' },
      { text: 'Getting Started', link: '/GETTING_STARTED' },
      { text: 'Keywords', link: '/KEYWORDS' },
      { text: 'Changelog', link: 'https://github.com/api-bridges/spml/releases' },
    ],

    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'Getting Started', link: '/GETTING_STARTED' },
          { text: 'Keyword Reference', link: '/KEYWORDS' },
          { text: 'Limitations', link: '/LIMITATIONS' },
          { text: 'Plugin API', link: '/PLUGIN_API' },
        ],
      },
      {
        text: 'Upgrading',
        items: [
          { text: 'Migration: v0 → v1', link: '/MIGRATION_v0_to_v1' },
        ],
      },
      {
        text: 'Project',
        items: [
          { text: 'Roadmap', link: '/ROADMAP' },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/api-bridges/spml' },
    ],

    footer: {
      message: 'Released under the ISC License.',
      copyright: 'Copyright © 2024-present Trionary contributors',
    },

    editLink: {
      pattern: 'https://github.com/api-bridges/spml/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },
  },
})
