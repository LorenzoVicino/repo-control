import assert from "node:assert/strict";
import test from "node:test";
import {
  readSessionCookie,
  serializeClearedSessionCookie,
  serializeSessionCookie,
  SESSION_COOKIE_NAME
} from "./sessionCookie.js";

test("reads the session token out of a shared cookie header", () => {
  assert.equal(readSessionCookie(`${SESSION_COOKIE_NAME}=token-a`), "token-a");
  assert.equal(readSessionCookie(`theme=dark; ${SESSION_COOKIE_NAME}=token-b; lang=en`), "token-b");
  assert.equal(readSessionCookie(`  ${SESSION_COOKIE_NAME} = token-c  `), "token-c");
});

test("treats an absent, empty or lookalike cookie as no session", () => {
  assert.equal(readSessionCookie(undefined), null);
  assert.equal(readSessionCookie(""), null);
  assert.equal(readSessionCookie("theme=dark"), null);
  assert.equal(readSessionCookie(`${SESSION_COOKIE_NAME}=`), null);
  assert.equal(readSessionCookie(`=${SESSION_COOKIE_NAME}`), null);
  // A cookie whose name merely contains the session name must not be mistaken for it.
  assert.equal(readSessionCookie(`other_${SESSION_COOKIE_NAME}=token`), null);
  assert.equal(readSessionCookie(`${SESSION_COOKIE_NAME}_backup=token`), null);
});

test("serializes a session cookie the browser will keep to itself", () => {
  const cookie = serializeSessionCookie("token-value", 3600);

  assert.equal(cookie.startsWith(`${SESSION_COOKIE_NAME}=token-value;`), true);
  assert.match(cookie, /(?:^|; )Path=\/(?:;|$)/);
  assert.match(cookie, /(?:^|; )HttpOnly(?:;|$)/);
  assert.match(cookie, /(?:^|; )SameSite=Strict(?:;|$)/);
  assert.match(cookie, /(?:^|; )Max-Age=3600(?:;|$)/);
});

test("keeps Max-Age a whole, non-negative number of seconds", () => {
  assert.match(serializeSessionCookie("token", 12.7), /Max-Age=12(?:;|$)/);
  assert.match(serializeSessionCookie("token", -5), /Max-Age=0(?:;|$)/);
});

test("clears the cookie with the same attributes it was set with", () => {
  const cookie = serializeClearedSessionCookie();

  assert.equal(cookie.startsWith(`${SESSION_COOKIE_NAME}=;`), true);
  assert.match(cookie, /Max-Age=0/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.equal(readSessionCookie(cookie.split(";")[0]), null);
});
