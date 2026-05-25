import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function run() {
    console.log("Connecting to browser CDP on port 9222...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    try {
        const contexts = browser.contexts();
        const ctx = contexts[0];
        const page = await ctx.newPage();
        
        const subredditUrl = "https://www.reddit.com/r/AndroidClosedTesting/new/";
        console.log(`Navigating to subreddit: ${subredditUrl}`);
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto(subredditUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForTimeout(5000); // Allow dynamic posts to load
        
        console.log(`Page title: "${await page.title()}"`);
        
        // Extract post details
        const posts = await page.evaluate(() => {
            const items = [];
            // Reddit shreddit-post or regular post elements
            const postElements = Array.from(document.querySelectorAll('shreddit-post, [data-testid="post-container"], article'));
            for (const el of postElements) {
                const titleAttr = el.getAttribute('post-title') || el.querySelector('h1, h2, h3, a[slot="title"]')?.innerText;
                const authorAttr = el.getAttribute('author') || el.querySelector('[data-testid="post-author"], a[href*="/user/"]')?.innerText;
                const linkEl = el.querySelector('a[shreddit-redirect-helper], a[slot="full-post-link"], a[href*="/comments/"]');
                const href = linkEl ? linkEl.href : null;
                const permalink = el.getAttribute('permalink') || href;
                const content = el.querySelector('[slot="text-body"], .feed-card-text-content')?.innerText || "";
                
                if (titleAttr) {
                    items.push({
                        title: titleAttr.trim(),
                        author: (authorAttr || "unknown").trim(),
                        url: permalink ? (permalink.startsWith("http") ? permalink : "https://www.reddit.com" + permalink) : href,
                        contentSnippet: content.slice(0, 200).trim()
                    });
                }
            }
            return items;
        });

        console.log(`Found ${posts.length} posts on the page.`);
        const outputPath = join(__dirname, "../subreddit_posts.json");
        writeFileSync(outputPath, JSON.stringify(posts, null, 2));
        console.log(`Saved posts data to ${outputPath}`);

        console.log("\n--- Top 10 Recent Posts ---");
        posts.slice(0, 10).forEach((p, idx) => {
            console.log(`${idx + 1}. [${p.author}] ${p.title}`);
            console.log(`   URL: ${p.url}`);
            console.log(`   Snippet: ${p.contentSnippet}\n`);
        });

        const screenshotPath = join(__dirname, "../subreddit_new_posts.png");
        await page.screenshot({ path: screenshotPath });
        console.log(`Screenshot saved to ${screenshotPath}`);

        await page.close();
    } catch (e) {
        console.error("Error:", e.message);
    }
}

run();
