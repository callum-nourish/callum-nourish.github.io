import { QuartzConfig } from "./quartz/cfg"
import * as Plugin from "./quartz/plugins"

/**
 * Quartz 4 Configuration
 *
 * See https://quartz.jzhao.xyz/configuration for more information.
 */
const config: QuartzConfig = {
  configuration: {
    pageTitle: "Nourish Docs",
    pageTitleSuffix: " — Nourish Docs",
    enableSPA: true,
    enablePopovers: true,
    analytics: {
      provider: "plausible",
    },
    locale: "en-GB",
    baseUrl: "callum-nourish.github.io",
    ignorePatterns: ["private", "templates", ".obsidian"],
    defaultDateType: "modified",
    theme: {
      fontOrigin: "googleFonts",
      cdnCaching: true,
      typography: {
        header: "Inter",
        body: "Inter",
        code: "JetBrains Mono",
      },
      colors: {
        lightMode: {
          light: "#ffffff",          // page background — pure white
          lightgray: "#eef1f4",      // sidebar bg, borders, table stripes
          gray: "#8896a0",           // metadata, dates, secondary text
          darkgray: "#3d4852",       // body text
          dark: "#1a2332",           // headings, strong text
          secondary: "#2cc4a8",      // links, active nav — Nourish teal
          tertiary: "#7b5abf",       // hover states — Nourish purple
          highlight: "rgba(44, 196, 168, 0.08)",
          textHighlight: "rgba(44, 196, 168, 0.28)",
        },
        darkMode: {
          light: "#0f1923",          // page background — deep navy
          lightgray: "#1b2d3c",      // sidebar bg, borders
          gray: "#4a6878",           // metadata, secondary text
          darkgray: "#b8ccd4",       // body text
          dark: "#e4eff4",           // headings
          secondary: "#2cc4a8",      // links — teal holds on dark
          tertiary: "#a07ee0",       // hover — lightened purple for dark
          highlight: "rgba(44, 196, 168, 0.1)",
          textHighlight: "rgba(44, 196, 168, 0.22)",
        },
      },
    },
  },
  plugins: {
    transformers: [
      Plugin.FrontMatter(),
      Plugin.CreatedModifiedDate({
        priority: ["frontmatter", "git", "filesystem"],
      }),
      Plugin.SyntaxHighlighting({
        theme: {
          light: "vitesse-light",
          dark: "vitesse-dark",
        },
        keepBackground: false,
      }),
      Plugin.ObsidianFlavoredMarkdown({ enableInHtmlEmbed: false }),
      Plugin.GitHubFlavoredMarkdown(),
      Plugin.TableOfContents(),
      Plugin.CrawlLinks({ markdownLinkResolution: "shortest" }),
      Plugin.Description(),
      Plugin.Latex({ renderEngine: "katex" }),
    ],
    filters: [Plugin.RemoveDrafts()],
    emitters: [
      Plugin.AliasRedirects(),
      Plugin.ComponentResources(),
      Plugin.ContentPage(),
      Plugin.FolderPage(),
      Plugin.TagPage(),
      Plugin.ContentIndex({
        enableSiteMap: true,
        enableRSS: true,
      }),
      Plugin.Assets(),
      Plugin.Static(),
      Plugin.Favicon(),
      Plugin.NotFoundPage(),
      // Comment out CustomOgImages to speed up build time
      Plugin.CustomOgImages(),
    ],
  },
}

export default config
