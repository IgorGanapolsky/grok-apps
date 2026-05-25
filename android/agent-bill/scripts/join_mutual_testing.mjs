import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const screenshotsDir = join(__dirname, "../mutual_testing_screenshots");

// Ensure screenshots directory exists
try {
    mkdirSync(screenshotsDir, { recursive: true });
} catch (err) {}

const partners = [
    {
        name: "Own-Art3757_SitLess",
        group: "https://groups.google.com/g/stairs-counter-closed-testing",
        optin: "https://play.google.com/apps/testing/com.health.sitless"
    },
    {
        name: "ClassyChris23_BrackIt",
        group: "https://groups.google.com/g/brackit-tester/",
        optin: "https://play.google.com/apps/testing/com.getbrackit.brackit"
    },
    {
        name: "Fit_Television3597_Dosey",
        group: "https://groups.google.com/g/dosey_tester",
        optin: "https://play.google.com/apps/testing/com.dosey.app"
    },
    {
        name: "qasimzee_Neumanmath",
        group: "https://groups.google.com/g/neuman_testing",
        optin: "https://play.google.com/apps/testing/com.neumanmath.android"
    },
    {
        name: "MonteeSaurusRex_TaskDomme",
        group: "https://groups.google.com/g/taskdommetest",
        optin: "https://play.google.com/apps/testing/com.taskdomme"
    }
];

async function run() {
    console.log("Connecting to Chrome Canary CDP on port 9222...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    try {
        const contexts = browser.contexts();
        const ctx = contexts[0];
        const page = await ctx.newPage();
        await page.setViewportSize({ width: 1440, height: 900 });

        for (const partner of partners) {
            console.log(`\n=========================================`);
            console.log(`PROCESSING PARTNER: ${partner.name}`);
            
            // 1. Join Google Group
            console.log(`Navigating to Google Group: ${partner.group}`);
            await page.goto(partner.group, { waitUntil: "domcontentloaded", timeout: 30000 });
            await page.waitForTimeout(4000);

            let groupScreenshot1 = join(screenshotsDir, `${partner.name}_group_loaded.png`);
            await page.screenshot({ path: groupScreenshot1 });
            console.log(`Screenshot saved: ${groupScreenshot1}`);

            // Try to find and click "Join group"
            const joinClicked = await page.evaluate(() => {
                // Find buttons/elements with text "Join group" or "Join this group"
                const elements = Array.from(document.querySelectorAll('button, [role="button"], a, div, span'));
                const joinBtn = elements.find(el => {
                    const txt = el.innerText ? el.innerText.toLowerCase() : "";
                    return txt.includes("join group") || txt.includes("join this group");
                });

                if (joinBtn) {
                    joinBtn.click();
                    return { success: true, text: joinBtn.innerText };
                }
                return { success: false };
            });

            if (joinClicked.success) {
                console.log(`Successfully clicked join button: "${joinClicked.text}"`);
                await page.waitForTimeout(4000);
                let groupScreenshot2 = join(screenshotsDir, `${partner.name}_group_joined.png`);
                await page.screenshot({ path: groupScreenshot2 });
                console.log(`Screenshot saved: ${groupScreenshot2}`);
            } else {
                console.log("No explicit 'Join group' button found or already joined.");
            }

            // 2. Opt-in to testing
            console.log(`Navigating to Opt-in link: ${partner.optin}`);
            await page.goto(partner.optin, { waitUntil: "domcontentloaded", timeout: 30000 });
            await page.waitForTimeout(4000);

            let optinScreenshot1 = join(screenshotsDir, `${partner.name}_optin_loaded.png`);
            await page.screenshot({ path: optinScreenshot1 });
            console.log(`Screenshot saved: ${optinScreenshot1}`);

            // Try to find and click "Become a tester"
            const optinClicked = await page.evaluate(() => {
                const elements = Array.from(document.querySelectorAll('button, [role="button"], input[type="button"], a'));
                const becomeTesterBtn = elements.find(el => {
                    const txt = el.innerText || el.value || "";
                    const txtLower = txt.toLowerCase();
                    return txtLower.includes("become a tester") || txtLower.includes("become tester") || txtLower.includes("accept invitation");
                });

                if (becomeTesterBtn) {
                    becomeTesterBtn.click();
                    return { success: true, text: becomeTesterBtn.innerText || becomeTesterBtn.value };
                }
                return { success: false };
            });

            if (optinClicked.success) {
                console.log(`Successfully clicked Become a tester button: "${optinClicked.text}"`);
                await page.waitForTimeout(4000);
                let optinScreenshot2 = join(screenshotsDir, `${partner.name}_optin_joined.png`);
                await page.screenshot({ path: optinScreenshot2 });
                console.log(`Screenshot saved: ${optinScreenshot2}`);
            } else {
                console.log("No explicit 'Become a tester' button found or already opted-in.");
            }
        }

        await page.close();
        console.log("\nAll mutual testing enrollment steps completed!");
    } catch (e) {
        console.error("Error during automation execution:", e.message);
    }
}

run();
