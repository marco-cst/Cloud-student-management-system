const jwt = require("jsonwebtoken");

function loadConfig(env = process.env) {
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32 || env.JWT_SECRET.startsWith("replace-")) {
    throw new Error("JWT_SECRET must be a random secret of at least 32 characters");
  }
  const secure = env.COOKIE_SECURE === "true";
  const origin = env.APP_ORIGIN || "http://localhost:5173";
  if (env.NODE_ENV === "production" && (!secure || !origin.startsWith("https://"))) {
    throw new Error("Production requires HTTPS APP_ORIGIN and COOKIE_SECURE=true");
  }
  const proxy = env.TRUST_PROXY ?? "false";
  if (!["false", "loopback"].includes(proxy)) {
    throw new Error("TRUST_PROXY must be false or loopback; unrestricted proxy trust is not supported");
  }
  const expiresIn = env.JWT_EXPIRES_IN || "15m";
  // Reject invalid or excessively long sessions at startup.
  const sample = jwt.decode(jwt.sign({}, env.JWT_SECRET, { expiresIn }));
  if (sample.exp - sample.iat > 3600 || sample.exp <= sample.iat) {
    throw new Error("JWT_EXPIRES_IN must be positive and at most one hour");
  }
  return {
    secret: env.JWT_SECRET, expiresIn, origin, trustProxy: proxy === "loopback" ? "loopback" : false,
    cookie: { httpOnly: true, secure, sameSite: "strict", path: "/api" },
    issuer: "student-management", audience: "student-management-web",
  };
}

module.exports = { loadConfig };
