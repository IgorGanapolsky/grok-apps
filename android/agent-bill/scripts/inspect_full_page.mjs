import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

async function run() {
    console.log("[inspector] Connecting to Comet CDP on port 9222...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    try {
        const contexts = browser.contexts();
        if (contexts.length === 0) throw new Error("No contexts");
        const ctx = contexts[0];
        const pages = await ctx.pages();
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        if (!page) {
            throw new Error("No Play Console tab found.");
        }

        console.log(`[inspector] Found tab: "${await page.title()}"`);
        
        // Let's scroll down to the bottom of the page
        console.log("[inspector] Scrolling down page to expose all fields...");
        await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight);
        });
        await page.waitForTimeout(3000);

        // Capture scrolled screenshot
        const scrolledScreenshot = resolve(rootDir, "current_tab_scrolled.png");
        await page.screenshot({ path: scrolledScreenshot });
        console.log(`[inspector] Scrolled screenshot saved to: ${scrolledScreenshot}`);

        // Let's check inputs and textareas and buttons
        const pageData = await page.evaluate(() => {
            const inputs = Array.from(document.querySelectorAll("input, textarea")).map(el => ({
                tag: el.tagName.toLowerCase(),
                type: el.getAttribute("type") || "",
                ariaLabel: el.getAttribute("aria-label") || "",
                placeholder: el.getAttribute("placeholder") || "",
                value: el.value || "",
                visible: el.getBoundingClientRect().height > 0
            }));

            const buttons = Array.from(document.querySelectorAll("button")).map(el => ({
                text: el.innerText ? el.innerText.trim() : "",
                ariaLabel: el.getAttribute("aria-label") || "",
                enabled: !el.disabled,
                visible: el.getBoundingClientRect().height > 0
            }));

            const errorText = Array.from(document.querySelectorAll(".error, [role='alert'], [aria-live='assertive']")).map(el => el.innerText).filter(Boolean);

            return { inputs, buttons, errorText };
        });

        console.log("\n--- INPUTS & TEXTAREAS ---");
        pageData.inputs.forEach((inp, idx) => {
            console.log(`Input #${idx}: Tag=${inp.tag}, Type=${inp.type}, AriaLabel="${inp.ariaLabel}", Placeholder="${inp.placeholder}", Value="${inp.value}", Visible=${inp.visible}`);
        });

        console.log("\n--- BUTTONS ---");
        pageData.buttons.forEach((btn, idx) => {
            if (btn.visible) {
                console.log(`Button #${idx}: Text="${btn.text}", AriaLabel="${btn.ariaLabel}", Enabled=${btn.enabled}`);
            }
        });

        console.log("\n--- ERROR TEXTS DETECTED ---");
        console.log(pageData.errorText.join("\n"));
        console.log("----------------------------\n");

    } catch (e) {
        console.error("[inspector] Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[inspector] CDP connection closed.");
    }
}

run();
