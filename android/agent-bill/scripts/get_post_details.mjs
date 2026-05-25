import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const targetUrls = [
    "https://www.reddit.com/r/AndroidClosedTesting/comments/1tjvecs/closed_testing_looking_for_12_testers_for_my_new/",
    "https://www.reddit.com/r/AndroidClosedTesting/comments/1tju216/rejected_twice_for_not_enough_testing_test_for/",
    "https://www.reddit.com/r/AndroidClosedTesting/comments/1tjtv20/looking_for_android_closed_testing_testers_for/",
    "https://www.reddit.com/r/AndroidClosedTesting/comments/1tjsmu1/looking_for_beta_testers_to_sign_up_and_create_a/"
];

async function run() {
    console.log("Connecting to browser CDP on port 9222...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    try {
        const contexts = browser.contexts();
        const ctx = contexts[0];
        const page = await ctx.newPage();
        await page.setViewportSize({ width: 1440, height: 900 });

        const results = [];

        for (const url of targetUrls) {
            console.log(`\n-----------------------------------------`);
            console.log(`Scraping URL: ${url}`);
            try {
                await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
                await page.waitForTimeout(3000);
                
                const title = await page.title();
                console.log(`Title: ${title}`);

                const pageData = await page.evaluate(() => {
                    // Extract all text and links
                    const bodyText = document.body.innerText;
                    const links = Array.from(document.querySelectorAll('a')).map(a => ({
                        text: a.innerText ? a.innerText.trim() : "",
                        href: a.href
                    })).filter(l => l.href && (l.href.includes("google.com") || l.href.includes("play.google.com") || l.href.includes("groups.google.com")));
                    
                    return { bodyText, links };
                });

                results.push({
                    url,
                    title,
                    bodySnippet: pageData.bodyText.slice(0, 1500),
                    googleLinks: pageData.links
                });

            } catch (err) {
                console.error(`Error scraping ${url}:`, err.message);
            }
        }

        const outputPath = join(__dirname, "../mutual_testers_details.json");
        writeFileSync(outputPath, JSON.stringify(results, null, 2));
        console.log(`\nSuccessfully saved mutual tester details to ${outputPath}`);
        
        await page.close();
    } catch (e) {
        console.error("CDP Connection Error:", e.message);
    }
}

run();
