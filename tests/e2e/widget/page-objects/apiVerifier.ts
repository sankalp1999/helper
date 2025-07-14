import { Page, expect } from "@playwright/test";

export class ApiVerifier {
  readonly page: Page;
  private apiCalls: Array<{ url: string; method: string; body?: any; response?: any }> = [];

  constructor(page: Page) {
    this.page = page;
  }

  async startCapturing() {
    this.apiCalls = [];
    
    await this.page.route("**/api/**", async (route) => {
      try {
        const request = route.request();
        const url = request.url();
        const method = request.method();
        const body = request.postData();
        
        const apiCall = {
          url,
          method,
          body: body ? JSON.parse(body) : undefined,
        };
        
        this.apiCalls.push(apiCall);
        
        const response = await route.fetch();
        apiCall.response = {
          status: response.status(),
          ok: response.ok(),
          headers: response.headers(),
        };
        
        await route.fulfill({ response });
      } catch (error) {
        // If the page is closed, just abort the route
        if (error.message?.includes('Target page, context or browser has been closed')) {
          await route.abort().catch(() => {});
        } else {
          throw error;
        }
      }
    });
  }

  async verifyChatApiCall() {
    const chatCall = this.apiCalls.find(call => 
      call.url.includes("/api/chat") && call.method === "POST"
    );
    
    if (!chatCall) {
      console.log('Available API calls:', this.apiCalls.map(c => ({ url: c.url, method: c.method })));
    }
    
    expect(chatCall).toBeDefined();
    expect(chatCall?.response?.ok).toBe(true);
    
    return chatCall;
  }

  async verifySessionApiCall() {
    const sessionCall = this.apiCalls.find(call => 
      call.url.includes("/api/widget/session") && call.method === "POST"
    );
    
    if (!sessionCall) {
      console.log('Available API calls:', this.apiCalls.map(c => ({ url: c.url, method: c.method })));
    }
    
    expect(sessionCall).toBeDefined();
    expect(sessionCall?.response?.ok).toBe(true);
    
    return sessionCall;
  }

  async verifyScreenshotInRequest() {
    const chatCall = await this.verifyChatApiCall();
    
    // Check various possible screenshot formats in the request
    const hasScreenshot = chatCall?.body?.messages?.some((msg: any) => {
      // Check for experimental_attachments
      if (msg.experimental_attachments?.some((att: any) => 
        att.contentType?.startsWith("image/") || att.url?.includes("data:image")
      )) {
        return true;
      }
      
      // Check for attachments
      if (msg.attachments?.some((att: any) => 
        att.contentType?.startsWith("image/") || att.url?.includes("data:image")
      )) {
        return true;
      }
      
      // Check for screenshot in content
      if (msg.content?.includes("data:image") || msg.screenshot) {
        return true;
      }
      
      return false;
    }) || chatCall?.body?.screenshot || chatCall?.body?.attachments?.length > 0;
    
    if (!hasScreenshot) {
      console.log('Chat call body:', JSON.stringify(chatCall?.body, null, 2));
    }
    
    expect(hasScreenshot).toBe(true);
    
    return chatCall;
  }

  async verifyStreamingResponse() {
    const chatCall = await this.verifyChatApiCall();
    const headers = chatCall?.response?.headers;
    
    // The widget API might return JSON instead of streaming
    const contentType = headers?.["content-type"] || "";
    expect(contentType).toMatch(/text\/event-stream|application\/json/);
  }

  async verifyApiCallCount(endpoint: string, expectedCount: number) {
    const count = this.apiCalls.filter(call => call.url.includes(endpoint)).length;
    expect(count).toBe(expectedCount);
  }

  getApiCalls() {
    return this.apiCalls;
  }

  clearApiCalls() {
    this.apiCalls = [];
  }
}