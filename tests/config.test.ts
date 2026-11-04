import { afterEach, describe, expect, it, vi } from "vitest";
import { configProblems } from "@/lib/server/config";
import { encrypt } from "@/lib/server/crypto";

afterEach(() => vi.unstubAllEnvs());

describe("production secret configuration", () => {
  it("reports and rejects a short key without disclosing it", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_SECRET", "x");
    expect(configProblems().some((problem) => problem.name === "APP_SECRET")).toBe(true);
    expect(() => encrypt("payload")).toThrow("APP_SECRET doit contenir au moins 32 caractères aléatoires.");
  });

  it("accepts a generated key", async () => {
    const { randomBytes } = await import("node:crypto");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_SECRET", randomBytes(32).toString("base64"));
    expect(configProblems().some((problem) => problem.name === "APP_SECRET")).toBe(false);
  });
});
