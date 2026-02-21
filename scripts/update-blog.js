// Reads posts/*.md and generates blog/index.html + blog/{slug}/index.html
const fs   = require('fs');
const path = require('path');

const POSTS_DIR = path.join(__dirname, '..', 'posts');
const BLOG_DIR  = path.join(__dirname, '..', 'blog');

if (!fs.existsSync(BLOG_DIR)) fs.mkdirSync(BLOG_DIR, { recursive: true });

// ── Frontmatter parser ───────────────────────────────────
function parseFrontmatter(raw) {
    const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!m) return { meta: {}, body: raw };

    const meta = {};
    for (const line of m[1].split('\n')) {
        const colon = line.indexOf(':');
        if (colon === -1) continue;
        const key = line.slice(0, colon).trim();
        let   val = line.slice(colon + 1).trim();
        if (/^["']/.test(val) && val.endsWith(val[0])) val = val.slice(1, -1);
        meta[key] = val;
    }

    return { meta, body: m[2].trim() };
}

// ── HTML escaper ─────────────────────────────────────────
function esc(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ── Markdown → HTML converter ────────────────────────────
function markdownToHtml(md) {
    let html = md;

    // Fenced code blocks
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g,
        (_, lang, code) => `<pre><code class="language-${lang}">${esc(code.trim())}</code></pre>`);

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Headings
    html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^### (.+)$/gm,  '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm,   '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm,    '<h1>$1</h1>');

    // Bold + italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g,     '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g,         '<em>$1</em>');

    // Images (before links so ![…](…) isn't caught by link regex)
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g,
        '<img src="$2" alt="$1" loading="lazy">');

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // Blockquotes
    html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');

    // Unordered lists (consecutive lines starting with "- ")
    html = html.replace(/((?:^- .+\n?)+)/gm, match => {
        const items = match.trim().split('\n')
            .map(l => `<li>${l.replace(/^- /, '')}</li>`).join('');
        return `<ul>${items}</ul>`;
    });

    // Ordered lists
    html = html.replace(/((?:^\d+\. .+\n?)+)/gm, match => {
        const items = match.trim().split('\n')
            .map(l => `<li>${l.replace(/^\d+\. /, '')}</li>`).join('');
        return `<ol>${items}</ol>`;
    });

    // Paragraphs — wrap double-newline-separated blocks that aren't block elements
    const BLOCK = /^<(h[1-6]|ul|ol|pre|blockquote)/;
    html = html
        .split(/\n\n+/)
        .map(block => {
            block = block.trim();
            if (!block) return '';
            if (BLOCK.test(block)) return block;
            return `<p>${block.replace(/\n/g, '<br>')}</p>`;
        })
        .join('\n');

    return html;
}

// ── Date formatter ───────────────────────────────────────
function formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00Z');
    return d.toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
    });
}

// ── Individual post page ─────────────────────────────────
function postPageHtml(meta, contentHtml) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="${esc(meta.description || '')}">
    <meta property="og:title"       content="${esc(meta.title)}">
    <meta property="og:description" content="${esc(meta.description || '')}">
    <meta property="og:type"        content="article">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="../../style.css">
    <link rel="stylesheet" href="../blog.css">
    <title>${esc(meta.title)} — Dimitris Skaronis</title>
</head>
<body>
    <div class="bg-orb bg-orb--purple"></div>
    <div class="bg-orb bg-orb--blue"></div>

    <nav class="nav">
        <div class="nav__inner">
            <div class="logo">
                <a href="../../index.html">
                    <img src="../../assets/New.TechnoKing.png" alt="TechnoKing logo">
                </a>
            </div>
            <div class="nav__links">
                <a href="../../index.html" class="nav__link">Home</a>
                <a href="../index.html"    class="nav__link nav__link--active">Blog</a>
            </div>
        </div>
    </nav>

    <main class="post-main">
        <article class="post">
            <header class="post__header">
                <time class="post__date">${formatDate(meta.date)}</time>
                <h1 class="post__title">${meta.title}</h1>
                ${meta.description ? `<p class="post__description">${esc(meta.description)}</p>` : ''}
                ${meta.link ? `<a href="${meta.link}" class="post__substack-link" target="_blank" rel="noopener">Read on Substack →</a>` : ''}
            </header>
            <div class="post__body">
                ${contentHtml}
            </div>
        </article>
    </main>
</body>
</html>`;
}

// ── Blog index page ──────────────────────────────────────
function blogIndexHtml(posts) {
    const byYear = {};
    for (const p of posts) {
        const y = p.date.slice(0, 4);
        if (!byYear[y]) byYear[y] = [];
        byYear[y].push(p);
    }

    const yearsHtml = Object.keys(byYear)
        .sort((a, b) => b - a)
        .map(year => {
            const cardsHtml = byYear[year].map(p => `
            <article class="post-card glass-card">
                <a href="${p.slug}/index.html" class="post-card__link">
                    <time class="post-card__date">${formatDate(p.date)}</time>
                    <h2 class="post-card__title">${esc(p.title)}</h2>
                    ${p.description ? `<p class="post-card__desc">${esc(p.description)}</p>` : ''}
                    <span class="post-card__read">Read post →</span>
                </a>
            </article>`).join('');

            return `
        <section class="year-group">
            <h3 class="year-label">${year}</h3>
            ${cardsHtml}
        </section>`;
        }).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="Blog posts by Dimitris Skaronis">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="../style.css">
    <link rel="stylesheet" href="blog.css">
    <title>Blog — Dimitris Skaronis</title>
</head>
<body>
    <div class="bg-orb bg-orb--purple"></div>
    <div class="bg-orb bg-orb--blue"></div>

    <nav class="nav">
        <div class="nav__inner">
            <div class="logo">
                <a href="../index.html">
                    <img src="../assets/New.TechnoKing.png" alt="TechnoKing logo">
                </a>
            </div>
            <div class="nav__links">
                <a href="../index.html" class="nav__link">Home</a>
                <a href="index.html"   class="nav__link nav__link--active">Blog</a>
            </div>
        </div>
    </nav>

    <main class="blog-main">
        <div class="blog-header">
            <div class="hero__badge">Writing</div>
            <h1 class="blog-title">Blog</h1>
            <p class="blog-subtitle">
                Thoughts and ideas — synced from
                <a href="https://technoking.substack.com" target="_blank" rel="noopener" class="substack-link">Substack</a>.
            </p>
        </div>

        <div class="posts-list">
            ${posts.length === 0
                ? '<p class="no-posts">No posts yet — check back soon.</p>'
                : yearsHtml}
        </div>
    </main>
</body>
</html>`;
}

// ── Main ─────────────────────────────────────────────────
function main() {
    if (!fs.existsSync(POSTS_DIR)) {
        fs.mkdirSync(POSTS_DIR, { recursive: true });
        console.log('Created posts/ directory.');
    }

    const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));
    const posts = [];

    for (const file of files) {
        const raw          = fs.readFileSync(path.join(POSTS_DIR, file), 'utf8');
        const { meta, body } = parseFrontmatter(raw);

        if (!meta.title || !meta.date || !meta.slug) {
            console.warn(`  Skipping ${file}: missing title, date, or slug.`);
            continue;
        }

        const contentHtml = markdownToHtml(body);
        const postDir     = path.join(BLOG_DIR, meta.slug);

        if (!fs.existsSync(postDir)) fs.mkdirSync(postDir, { recursive: true });
        fs.writeFileSync(path.join(postDir, 'index.html'), postPageHtml(meta, contentHtml), 'utf8');
        console.log(`  Built: ${meta.title}`);

        posts.push(meta);
    }

    posts.sort((a, b) => new Date(b.date) - new Date(a.date));

    fs.writeFileSync(path.join(BLOG_DIR, 'index.html'), blogIndexHtml(posts), 'utf8');
    console.log(`Blog index built with ${posts.length} post(s).`);

    fs.writeFileSync(
        path.join(__dirname, '..', 'blog-posts.json'),
        JSON.stringify(posts, null, 2),
        'utf8',
    );
    console.log('Exported blog-posts.json.');
}

main();
