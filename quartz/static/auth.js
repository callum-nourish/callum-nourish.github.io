(function () {
  var HASH = "PASSWORD_HASH_PLACEHOLDER";
  var SALT = "nourish-docs-2026";
  var AUTH_KEY = "nourish_auth_expiry";
  var EXPIRY_MS = 8 * 60 * 60 * 1000; // 8 hours
  var LOGIN_PAGE = "/static/login.html";

  // Don't gate the login page itself
  if (window.location.pathname.indexOf("login") !== -1) return;

  var expiry = localStorage.getItem(AUTH_KEY);
  if (!expiry || parseInt(expiry, 10) < Date.now()) {
    localStorage.removeItem(AUTH_KEY);
    window.location.replace(
      LOGIN_PAGE + "?return=" + encodeURIComponent(window.location.pathname + window.location.search)
    );
  }
})();
