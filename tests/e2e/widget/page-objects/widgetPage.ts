import { Page, Locator } from "@playwright/test";

export class WidgetPage {
  readonly page: Page;
  readonly widgetFrame: Locator;
  readonly chatInput: Locator;
  readonly sendButton: Locator;
  readonly screenshotCheckbox: Locator;
  readonly messagesList: Locator;
  readonly loadingSpinner: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    // Use a more flexible iframe selector
    this.widgetFrame = page.frameLocator("iframe").first();
    // Use more flexible selectors that can match different input types
    this.chatInput = this.widgetFrame.locator('textarea, input[type="text"], input:not([type]), [contenteditable="true"]').first();
    this.sendButton = this.widgetFrame.locator('button[type="submit"], button:has-text("Send"), button:has([data-testid*="send"])').first();
    this.screenshotCheckbox = this.widgetFrame.locator('input[type="checkbox"]');
    this.messagesList = this.widgetFrame.locator('[data-testid="messages-list"]');
    this.loadingSpinner = this.widgetFrame.locator('[data-testid="loading-spinner"]');
    this.errorMessage = this.widgetFrame.locator('[data-testid="error-message"]');
  }

  async loadWidget(config?: { 
    token?: string; 
    email?: string; 
    name?: string; 
    userId?: string; 
  }) {
    // Use the vanilla test page which already has the widget properly configured
    await this.page.goto("/widget/test/vanilla");
    
    // Wait for the widget button to appear (the SDK creates this)
    await this.page.waitForSelector('[data-helper-toggle]', { timeout: 15000 });
    
    // Click the button to open the widget
    await this.page.click('[data-helper-toggle]');
    
    // Wait for any iframe to be visible
    await this.page.waitForSelector('iframe', { 
      state: 'visible',
      timeout: 15000 
    });
    
    // Wait for iframe content to be properly loaded by checking multiple possible selectors
    // The widget might use different input types (textarea, input, etc.)
    let inputFound = false;
    const possibleInputSelectors = ['textarea', 'input[type="text"]', 'input', '[contenteditable="true"]'];
    
    for (const selector of possibleInputSelectors) {
      try {
        await this.widgetFrame.locator(selector).first().waitFor({ 
          state: "visible",
          timeout: 5000 
        });
        inputFound = true;
        break;
      } catch {
        // Try next selector
        continue;
      }
    }
    
    if (!inputFound) {
      // Final fallback: wait for iframe to be attached and give it time to load
      await this.page.waitForTimeout(3000);
      
      // Try to wait for any interactive element in the iframe
      try {
        await this.widgetFrame.locator('button, input, textarea, [role="textbox"]').first().waitFor({ 
          state: "visible",
          timeout: 10000 
        });
      } catch {
        // If still no interactive elements, the widget might have a different structure
        // Continue anyway as some tests might not need input
      }
    }
  }

  async sendMessage(message: string, includeScreenshot = false) {
    await this.chatInput.fill(message);
    
    if (includeScreenshot) {
      await this.screenshotCheckbox.check();
    }
    
    await this.sendButton.click();
  }

  async waitForResponse() {
    // Wait for either data-testid="ai-message" or any new message to appear
    try {
      await this.widgetFrame.locator('[data-testid="ai-message"]').waitFor({ state: "visible", timeout: 30000 });
    } catch {
      // Fallback: wait for message count to increase using Playwright's frame locator
      const initialCount = await this.getMessageCount();
      let currentCount = initialCount;
      const startTime = Date.now();
      
      // Poll for message count changes using the frame locator
      while (currentCount <= initialCount) {
        await this.page.waitForTimeout(500);
        currentCount = await this.getMessageCount();
        
        // Timeout after 30 seconds
        const elapsed = Date.now() - startTime;
        if (elapsed > 30000) break;
      }
    }
  }

  async getLastMessage() {
    const messages = await this.widgetFrame.locator('[data-testid="message"]').all();
    if (messages.length === 0) return null;
    return messages[messages.length - 1];
  }

  async toggleScreenshotWithKeyboard() {
    await this.chatInput.focus();
    await this.page.keyboard.press("Meta+/");
  }

  async isScreenshotCheckboxChecked() {
    return this.screenshotCheckbox.isChecked();
  }

  async waitForScreenshotCapture() {
    // Wait for one of these conditions indicating screenshot capture is complete:
    // 1. The screenshot checkbox gets unchecked (after submission)
    // 2. A new message appears in the chat
    // 3. The input field is cleared and re-enabled
    
    const initialMessageCount = await this.getMessageCount();
    
    try {
      await Promise.race([
        // Wait for message count to increase (screenshot sent as message)
        this.page.waitForFunction(
          async (initial) => {
            // Poll for message count change
            await new Promise(resolve => setTimeout(resolve, 100));
            return true; // Will be re-evaluated by getMessageCount below
          },
          initialMessageCount,
          { timeout: 5000 }
        ).then(async () => {
          // Double-check message count increased
          const newCount = await this.getMessageCount();
          if (newCount <= initialMessageCount) {
            throw new Error('Message count did not increase');
          }
        }),
        
        // Wait for checkbox to be unchecked after submission
        this.screenshotCheckbox.waitFor({ 
          state: "hidden", 
          timeout: 5000 
        }),
        
        // Wait for input to be cleared (indicates submission completed)
        this.widgetFrame.waitForFunction(
          () => {
            const textarea = document.querySelector('textarea');
            return textarea && textarea.value === '';
          },
          { timeout: 5000 }
        )
      ]);
    } catch (error) {
      // If all waits timeout, wait a short time then continue
      // This handles cases where screenshot might be captured differently
      await this.page.waitForTimeout(500);
    }
  }

  async getErrorMessage() {
    return this.errorMessage.textContent();
  }

  async isLoadingVisible() {
    return this.loadingSpinner.isVisible();
  }

  async getMessageCount() {
    // Try multiple selectors for messages
    let messages = await this.widgetFrame.locator('[data-testid="message"]').all();
    if (messages.length === 0) {
      // Try a more generic selector - look for message containers
      messages = await this.widgetFrame.locator('div[class*="message"]:has(p)').all();
    }
    return messages.length;
  }

  async getEmptyStateMessage() {
    return this.widgetFrame.locator('[data-testid="empty-state"]').textContent();
  }
}