import test from "node:test";
import assert from "node:assert/strict";

import { resolveSafeAdminRedirect } from "../authRedirect.js";

test("returns fallback when redirect is missing", () => {
  assert.equal(resolveSafeAdminRedirect(null), "/admin/dashboard");
  assert.equal(resolveSafeAdminRedirect(""), "/admin/dashboard");
});

test("allows internal admin paths", () => {
  assert.equal(
    resolveSafeAdminRedirect("/admin/contacts?tab=inactive"),
    "/admin/contacts?tab=inactive"
  );
});

test("rejects external or malformed redirect targets", () => {
  assert.equal(resolveSafeAdminRedirect("https://evil.example"), "/admin/dashboard");
  assert.equal(resolveSafeAdminRedirect("//evil.example/admin"), "/admin/dashboard");
  assert.equal(resolveSafeAdminRedirect("/public/status"), "/admin/dashboard");
});

test("rejects redirect back to login", () => {
  assert.equal(resolveSafeAdminRedirect("/admin/login"), "/admin/dashboard");
  assert.equal(resolveSafeAdminRedirect("/admin/login?next=/admin/dashboard"), "/admin/dashboard");
});
