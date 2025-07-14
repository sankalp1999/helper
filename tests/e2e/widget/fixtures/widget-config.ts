export const widgetConfigs = {
  anonymous: {
    token: "test-widget-token",
  },
  authenticated: {
    token: "test-widget-token",
    email: "authenticated@example.com",
    name: "Authenticated User",
    userId: "auth-user-123",
  },
  withCustomData: {
    token: "test-widget-token",
    email: "custom@example.com",
    name: "Custom User",
    userId: "custom-user-456",
    metadata: {
      plan: "premium",
      role: "admin",
    },
  },
};