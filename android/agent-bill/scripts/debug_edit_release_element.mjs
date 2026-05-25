import { chromium } from "playwright";

async function run() {
    console.log("Connecting to Comet CDP on port 9222...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    try {
        const contexts = browser.contexts();
        if (contexts.length === 0) throw new Error("No contexts found");
        const ctx = contexts[0];
        const pages = await ctx.pages();
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        if (!page) {
            console.log("No Play Console tab found. Opening a new one...");
            page = await ctx.newPage();
        }

        const internalTestingUrl = "https://play.google.com/console/u/0/developers/8239620436488925047/app/4973243580627455820/tracks/internal-testing";
        console.log(`Navigating to Internal testing track: ${internalTestingUrl}`);
        await page.goto(internalTestingUrl, { waitUntil: "networkidle", timeout: 90000 });
        await page.waitForTimeout(5000);

        // Find elements with text matching 'Edit' or 'release'
        const matchingElements = await page.evaluate(() => {
            const allElements = Array.from(document.querySelectorAll('*'));
            return allElements.map(el => {
                const text = el.innerText ? el.innerText.trim() : "";
                if (text.toLowerCase().includes("edit release") || text.includes("Edit release")) {
                    return {
                        tagName: el.tagName,
                        text: text.replace(/\n/g, ' | ').slice(0, 100),
                        id: el.id,
                        className: el.className,
                        ariaLabel: el.getAttribute("aria-label"),
                        debugId: el.getAttribute("debug-id")
                    };
                }
                return null;
            }).filter(Boolean);
        });

        console.log("Found matching elements for 'Edit release':", JSON.stringify(matchingElements, null, 2));

        // Let's also search broadly for any interactive click targets containing "Edit" or "edit"
        const editTargets = await page.evaluate(() => {
            const interactives = Array.from(document.querySelectorAll('a, button, [role="button"]'));
            return interactives.map(el => {
                const text = el.innerText ? el.innerText.trim() : "";
                if (text.toLowerCase().includes("edit")) {
                    return {
                        tagName: el.tagName,
                        text: text.replace(/\n/g, ' | '),
                        id: el.id,
                        className: el.className,
                        href: el.href || null
                    };
                }
                return null;
            }).filter(Boolean);
        });

        console.log("Interactive elements containing 'Edit':", JSON.stringify(editTargets, null, 2));

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("Disconnected successfully.");
    }
}
run();
