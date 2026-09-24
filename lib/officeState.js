export function createFrontendState() {
  return {
    isLoggedIn: false,
    lastLoginAt: null,
    nextRefreshAt: null,
    profile: null,
  };
}
