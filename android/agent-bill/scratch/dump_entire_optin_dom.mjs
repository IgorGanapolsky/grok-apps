import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

async function run() {
    console.log("Connecting to Chrome Canary CDP on port 9222...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    try {
        const contexts = browser.contexts();
        const ctx = contexts[0];
        const pages = await ctx.pages();
        const optinPage = pages.find(p => p.url().includes("play.google.com/apps/testing"));
        
        if (!optinPage) {
            console.error("No active opt-in page found.");
            return;
        }

        const html = await optinPage.content();
        writeFileSync("scratch_optin_full.html", html);
        console.log("Saved full HTML structure to scratch_optin_full.html");

        // Inspect forms and buttons in detail
        const formsAndInputs = await optinPage.evaluate(() => {
            const results = [];
            
            // All forms
            const forms = Array.from(document.querySelectorAll('form'));
            results.push(`Forms count: ${forms.length}`);
            forms.forEach((f, idx) => {
                results.push(`Form #${idx}: action=${f.action}, method=${f.method}, outerHTML=${f.outerHTML.substring(0, 400)}`);
                const inputs = Array.from(f.querySelectorAll('input, button'));
                inputs.forEach((inp, iIdx) => {
                    results.push(`  Input #${iIdx}: type=${inp.type}, name=${inp.name}, value=${inp.value || inp.innerText}, outerHTML=${inp.outerHTML.substring(0, 300)}`);
                });
            });

            // All standalone buttons
            const standaloneButtons = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"]'));
            results.push(`Standalone buttons count: ${standaloneButtons.length}`);
            standaloneButtons.forEach((btn, idx) => {
                results.push(`Button #${idx}: innerText="${btn.innerText}", value="${btn.value}", outerHTML=${btn.outerHTML.substring(0, 300)}`);
            });

            return results;
        });

        console.log("\n--- DETAILED FORMS & INPUTS ---");
        formsAndInputs.forEach(line => console.log(line));
        console.log("-------------------------------\n");

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await browser.close().catch(() => {});
    }
}

run();
