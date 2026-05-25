import { chromium } from "playwright";

async function run() {
    console.log("Connecting to Chrome Canary CDP on port 9222...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    try {
        const contexts = browser.contexts();
        const ctx = contexts[0];
        const page = await ctx.newPage();
        await page.setViewportSize({ width: 1440, height: 900 });

        const optinUrl = "https://play.google.com/apps/testing/com.nbaquiz.guesstheplayer";
        console.log(`Navigating to opt-in: ${optinUrl}`);
        await page.goto(optinUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
        console.log("Navigated. Waiting 4 seconds...");
        await page.waitForTimeout(4000);

        const pageText = await page.evaluate(() => document.body.innerText);
        console.log("\n--- OPTIN PAGE BODY TEXT ---");
        console.log(pageText);
        console.log("-----------------------------\n");

        const allButtons = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('button, [role="button"], a, input[type="button"]')).map(btn => ({
                innerText: btn.innerText || btn.value || "",
                outerHTML: btn.outerHTML.substring(0, 200),
                visible: !!(btn.offsetWidth || btn.offsetHeight)
            }));
        });
        console.log("Buttons found on page:", JSON.stringify(allButtons, null, 2));

        console.log("Attempting screenshot with 5s timeout...");
        await page.screenshot({ path: "scratch_optin_loaded.png", timeout: 5000 }).catch(err => {
            console.log("Screenshot failed or timed out:", err.message);
        });

        await page.close();
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await browser.close().catch(() => {});
    }
}

run();
