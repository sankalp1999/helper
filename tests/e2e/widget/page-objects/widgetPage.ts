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
    this.chatInput = this.widgetFrame.locator('textarea').first();
    this.sendButton = this.widgetFrame.locator('button[type="submit"]');
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
    
    // Wait a bit for iframe content to load
    await this.page.waitForTimeout(2000);
    
    // Ensure the iframe content is loaded - use the correct selector
    await this.widgetFrame.locator('textarea').waitFor({ 
      state: "visible",
      timeout: 15000 
    });
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
      
      // Poll for message count changes using the frame locator
      while (currentCount <= initialCount) {
        await this.page.waitForTimeout(500);
        currentCount = await this.getMessageCount();
        
        // Timeout after 30 seconds
        const elapsed = Date.now() - (this.page as any)._startTime || 0;
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
    // Note: Loading state from screenshot bug branch - using generic wait
    await this.page.waitForTimeout(2000);
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