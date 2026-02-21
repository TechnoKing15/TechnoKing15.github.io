---
title: "My Blog is a Mirror"
date: 2026-02-21
slug: my-blog-is-a-mirror
description: "I write on Substack."
link: https://technoking.substack.com/p/my-blog-is-a-mirror
---
I write on Substack. But I also want to own my content.

So I built a small system: every 15 minutes, a GitHub Action fetches this Substack’s RSS feed, converts each post from HTML to Markdown, and rebuilds a static version of my blog at https://technoking15.github.io/blog. No CMS, no database, no dependencies, just plain files in a git repository.

The workflow looks like this:

Write on Substack → RSS feed → GitHub Action → Markdown files → Static HTML → GitHub Pages

Substack stays the primary publishing surface. The GitHub site is a permanent, self-hosted mirror I control completely. If Substack ever goes away, my posts don’t.

The whole thing is about 400 lines of vanilla Node.js with zero npm packages. The scripts run on GitHub’s free compute tier. Hosting is free on GitHub Pages.

I got the idea from https://skaronis.com, who built the same pipeline for his site. I adapted it for mine.

If you want to do the same, the code is open on my https://github.com/TechnoKing15/TechnoKing15.github.io.