import { chromium } from "playwright";

async function run() {
    console.log("[err-inspector] Connecting to Comet CDP...");
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

        const data = await page.evaluate(() => {
            // Find all red validation texts or error elements
            const errorElements = Array.from(document.querySelectorAll(".mdc-text-field-helper-text--validation-msg, .error, [role='alert'], .mdc-text-field--invalid"));
            const errors = errorElements.map(el => ({
                tagName: el.tagName.toLowerCase(),
                className: el.className || "",
                innerText: el.innerText ? el.innerText.trim() : "",
                outerHTML: el.outerHTML
            })).filter(e => e.innerText.length > 0);

            // Also check the value of the textarea
            const textarea = document.querySelector('textarea[aria-label="Release notes"]');
            const textareaValue = textarea ? textarea.value : "TEXTAREA NOT FOUND";

            // Also check all buttons and their states
            const buttons = Array.from(document.querySelectorAll("button")).map(el => ({
                text: el.innerText ? el.innerText.trim() : "",
                enabled: !el.disabled,
                ariaDisabled: el.getAttribute("aria-disabled") || ""
            }));

            return { errors, textareaValue, buttons };
        });

        console.log("\n--- ACTIVE VALIDATION ERRORS ---");
        if (data.errors.length === 0) {
            console.log("No validation errors found in DOM!");
        } else {
            data.errors.forEach((err, idx) => {
                console.log(`Error #${idx}: Class="${err.className}", Text="${err.innerText}"`);
            });
        }

        console.log(`\n--- CURRENT TEXTAREA VALUE ---`);
        console.log(`"${data.textareaValue}"`);

        console.log("\n--- BUTTON STATES ---");
        data.buttons.forEach((btn, idx) => {
            if (btn.text.includes("Save") || btn.text.includes("Next") || btn.text.includes("Review")) {
                console.log(`Button #${idx}: Text="${btn.text}", Enabled=${btn.enabled}, AriaDisabled="${btn.ariaDisabled}"`);
            }
        });
        console.log("--------------------------------\n");

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
    }
}

run();
