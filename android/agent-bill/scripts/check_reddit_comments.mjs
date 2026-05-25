import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function run() {
    console.log("Connecting to Comet CDP on port 9222...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    try {
        const contexts = browser.contexts();
        const ctx = contexts[0];
        const page = await ctx.newPage();
        
        const profileUrl = "https://www.reddit.com/user/eazyigz123/submitted/";
        console.log(`Navigating to user profile submitted page: ${profileUrl}`);
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto(profileUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForTimeout(5000);

        console.log("Finding the AgentBill mutual test post link...");
        const postLink = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a'));
            const targetLink = links.find(l => l.innerText && l.innerText.includes("AgentBill"));
            return targetLink ? targetLink.href : null;
        });

        if (postLink) {
            console.log(`Found live post link: ${postLink}`);
            console.log("Navigating to live post to check comments...");
            await page.goto(postLink, { waitUntil: "domcontentloaded", timeout: 30000 });
            await page.waitForTimeout(5000);

            console.log(`Page title: "${await page.title()}"`);
            
            const commentsText = await page.evaluate(() => {
                // Extract comment elements or general page text
                return document.body.innerText;
            });
            const textPath = join(__dirname, "../reddit_comments_text.txt");
            writeFileSync(textPath, commentsText);
            console.log(`Text comments saved to ${textPath}`);

            // Log comments/mentions of email/group
            console.log("\n--- Reddit Live Thread Content ---");
            const lines = commentsText.split("\n")
                .map(l => l.trim())
                .filter(l => l.length > 0 && (
                    l.includes("test") || 
                    l.includes("Test") || 
                    l.includes("join") || 
                    l.includes("Join") || 
                    l.includes("group") || 
                    l.includes("Group") || 
                    l.includes("email") ||
                    l.includes("Email") ||
                    l.includes("@") ||
                    l.includes("http")
                ));
            console.log(lines.slice(0, 40).join("\n"));
            console.log("----------------------------------\n");

            const screenshotPath = join(__dirname, "../reddit_live_comments.png");
            await page.screenshot({ path: screenshotPath });
            console.log(`Screenshot saved to ${screenshotPath}`);
        } else {
            console.log("AgentBill mutual test post link not found in user's recent submissions.");
            // Take screenshot of submitted list as fallback
            const screenshotPath = join(__dirname, "../reddit_profile_submitted.png");
            await page.screenshot({ path: screenshotPath });
            console.log(`Screenshot saved to ${screenshotPath}`);
        }

        await page.close();

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        console.log("CDP disconnected.");
    }
}
run();

