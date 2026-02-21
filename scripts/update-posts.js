// Fetches posts from Substack via rss2json.com (bypasses Cloudflare block on GitHub Actions)
// and writes them as Markdown files in posts/
const https = require('https');
const fs   = require('fs');
const path = require('path');
const url  = require('url');

const SUBSTACK_FEED = 'https://technoking.substack.com/feed';
const API_URL       = 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(SUBSTACK_FEED);
const POSTS_DIR     = path.join(__dirname, '..', 'posts');

if (!fs.existsSync(POSTS_DIR)) fs.mkdirSync(POSTS_DIR, { recursive: true });

// ── HTTP fetch with redirect support ────────────────────
function fetchUrl(targetUrl) {
    return new Promise((resolve, reject) => {
        const parsed = new url.URL(targetUrl);
        const options = {
            hostname: parsed.hostname,
            path:     parsed.pathname + parsed.search,
            headers:  {
                'User-Agent':      'Mozilla/5.0 (compatible; BlogSync/1.0)',
                'Accept':          'application/json',
                'Accept-Encoding': 'identity',
            },
        };
        https.get(options, res => {
            console.log(`  HTTP ${res.statusCode}`);
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return resolve(fetchUrl(res.headers.location));
            }
            res.setEncoding('utf8');
            let data = '';
            res.on('data', chunk => (data += chunk));
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

// ── HTML entity decoder ──────────────────────────────────
function decodeEntities(str) {
    return str
        .replace(/&amp;/g,  '&')
        .replace(/&lt;/g,   '<')
        .replace(/&gt;/g,   '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g,  "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(parseInt(c)));
}

// ── HTML → Markdown converter ────────────────────────────
function htmlToMarkdown(html) {
    if (!html) return '';
    let md = html;

    // Strip Substack subscription widgets
    md = md.replace(/<div[^>]*class="[^"]*subscription[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
    md = md.replace(/<div[^>]*class="[^"]*subscribe[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
    md = md.replace(/<p[^>]*class="[^"]*button-wrapper[^"]*"[^>]*>[\s\S]*?<\/p>/gi, '');

    // Code blocks
    md = md.replace(/<pre><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi,
        (_, c) => '\n```\n' + decodeEntities(c.trim()) + '\n```\n');

    // Inline code
    md = md.replace(/<code>(.*?)<\/code>/gi, '`$1`');

    // Headings
    md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n# $1\n');
    md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n## $1\n');
    md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n### $1\n');
    md = md.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '\n#### $1\n');

    // Bold / italic
    md = md.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
    md = md.replace(/<b[^>]*>(.*?)<\/b>/gi,           '**$1**');
    md = md.replace(/<em[^>]*>(.*?)<\/em>/gi,         '*$1*');
    md = md.replace(/<i[^>]*>(.*?)<\/i>/gi,           '*$1*');

    // Images
    md = md.replace(/<img[^>]+src="([^"]+)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)');
    md = md.replace(/<img[^>]+src="([^"]+)"[^>]*\/?>/gi,                   '![]($1)');

    // Links
    md = md.replace(/<a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');

    // Blockquotes
    md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, c) =>
        c.trim().split('\n').map(l => '> ' + l.trim()).join('\n') + '\n');

    // Lists
    md = md.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, c) =>
        c.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n') + '\n');
    md = md.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, c) => {
        let i = 0;
        return c.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (__, li) => `${++i}. ${li}\n`) + '\n';
    });

    // Paragraphs / line breaks
    md = md.replace(/<br\s*\/?>/gi, '\n');
    md = md.replace(/<\/p>/gi, '\n\n');
    md = md.replace(/<p[^>]*>/gi, '');

    // Strip remaining tags
    md = md.replace(/<[^>]+>/g, '');

    md = decodeEntities(md);
    md = md.replace(/\n{3,}/g, '\n\n').trim();
    return md;
}

// ── Turn a post title into a URL slug ───────────────────
function slugify(title) {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
}

// ── Main ─────────────────────────────────────────────────
async function main() {
    console.log('Fetching Substack feed via rss2json...');
    const raw  = await fetchUrl(API_URL);
    const feed = JSON.parse(raw);

    if (feed.status !== 'ok') {
        throw new Error(`rss2json error: ${feed.message}`);
    }

    const items = feed.items || [];
    console.log(`Found ${items.length} posts in feed.`);

    let newCount = 0;

    for (const item of items) {
        const title       = decodeEntities(item.title || '').trim();
        const link        = item.link || '';
        const date        = (item.pubDate || '').slice(0, 10);
        const slug        = slugify(title);
        const rawBody     = item.content || item.description || '';
        const description = (item.description || '')
            .replace(/<[^>]+>/g, '').trim().slice(0, 200);

        if (!title || !slug) continue;

        const filePath = path.join(POSTS_DIR, `${slug}.md`);
        if (fs.existsSync(filePath)) {
            console.log(`  Skipping (exists): ${title}`);
            continue;
        }

        const body = htmlToMarkdown(rawBody);
        const fm   = [
            '---',
            `title: "${title.replace(/"/g, '\\"')}"`,
            `date: ${date}`,
            `slug: ${slug}`,
            `description: "${description.replace(/"/g, '\\"')}"`,
            `link: ${link}`,
            '---',
            '',
        ].join('\n');

        fs.writeFileSync(filePath, fm + body, 'utf8');
        console.log(`  Imported: ${title}`);
        newCount++;
    }

    console.log(`Done. ${newCount} new post(s) imported.`);
}

main().catch(err => { console.error(err); process.exit(1); });
