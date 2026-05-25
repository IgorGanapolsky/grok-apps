import { chromium } from "playwright";

async function run() {
    console.log("Connecting to Chrome Canary CDP on port 9222...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    try {
        const contexts = browser.contexts();
        const ctx = contexts[0];
        const pages = await ctx.pages();
        const optinPage = pages.find(p => p.url().includes("play.google.com/apps/testing"));
        
        if (!optinPage) {
            console.error("No active opt-in page found in contexts.");
            return;
        }

        console.log("Reloading the page to see if membership propagated...");
        await optinPage.reload({ waitUntil: "domcontentloaded" });
        console.log("Waiting 5 seconds for page to stabilize...");
        await optinPage.waitForTimeout(5000);
        
        const pageText = await optinPage.evaluate(() => document.body.innerText);
        console.log("\n--- AFTER REFRESH: OPTIN ACTIVE PAGE BODY TEXT ---");
        console.log(pageText);
        console.log("------------------------------------\n");

        const allButtons = await optinPage.evaluate(() => {
            return Array.from(document.querySelectorAll('button, [role="button"], a, input[type="button"]')).map(btn => ({
                innerText: btn.innerText || btn.value || "",
                outerHTML: btn.outerHTML.substring(0, 200),
                visible: !!(btn.offsetWidth || btn.offsetHeight)
            }));
        });
        console.log("Buttons found on page after refresh:", JSON.stringify(allButtons.filter(b => b.innerText.trim() !== ""), null, 2));

        await optinPage.screenshot({ path: "scratch_optin_after_refresh.png", timeout: 5000 }).catch(err => {
            console.log("Screenshot failed:", err.message);
        });

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await browser.close().catch(() => {});
    }
}

run();
