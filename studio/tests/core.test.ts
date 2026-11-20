import { describe, expect, it } from "vitest";
import { addDays, brusselsToUtcIso, diffDays, utcToBrussels, todayBrussels } from "@/lib/time";
import { matchesPublication, makeContext, effectiveDate } from "@/lib/filter";
import { EMPTY_FILTERS, cardStage, normalizeMime, type PublicationSummary, type Tag, type Cycle } from "@/lib/domain";
import { splitSql, MIGRATIONS } from "@/lib/server/migrations";

describe("fuseau Europe/Brussels", () => {
  it("hiver = UTC+1, été = UTC+2", () => {
    expect(brusselsToUtcIso("2027-01-14", "09:30")).toBe("2027-01-14T08:30:00.000Z");
    expect(brusselsToUtcIso("2027-07-14", "09:30")).toBe("2027-07-14T07:30:00.000Z");
  });
  it("jours de changement d'heure", () => {
    expect(brusselsToUtcIso("2027-03-28", "12:00")).toBe("2027-03-28T10:00:00.000Z");
    expect(brusselsToUtcIso("2027-10-31", "12:00")).toBe("2027-10-31T11:00:00.000Z");
    expect(utcToBrussels("2027-03-28T01:30:00Z")).toEqual({ date: "2027-03-28", time: "03:30" });
  });
  it("aller-retour et date du jour", () => {
    expect(utcToBrussels(brusselsToUtcIso("2026-12-31", "23:45"))).toEqual({ date: "2026-12-31", time: "23:45" });
    expect(todayBrussels(new Date("2026-12-31T23:30:00Z"))).toBe("2027-01-01");
  });
  it("calculs de jours", () => {
    expect(addDays("2027-02-27", 2)).toBe("2027-03-01");
    expect(diffDays("2027-01-28", "2027-01-14")).toBe(14);
  });
});

const tag = (id: string, dimension: Tag["dimension"], label: string): Tag => ({ id, dimension, label, color: "blue", position: 0 });
const tags = [tag("ig", "canal", "Instagram"), tag("li", "canal", "LinkedIn"), tag("fc", "public", "Formation Continue"), tag("he", "public", "Haute École")];
const cycle = (id: string, name: string, aud: string | null): Cycle => ({ id, kind: "cycle", name, description: "", audience_tag_id: aud, category: "", start_date: null, end_date: null, status: "en_cours", links: [], notes: "", position: 0 });
const pub = (p: Partial<PublicationSummary>): PublicationSummary => ({
  id: Math.random().toString(), cycle_id: "c1", session_id: null, title: "x", body_excerpt: "", body: "", channel_tag_id: null, format_tag_id: null, audience_tag_id: null, nature_tag_id: null,
  tag_ids: [], production_status: "a_creer", diffusion_status: "a_programmer", target_date: null, target_time: null, scheduled_at: null, published_at: null, position: 0, archived: false,
  attachment_count: 0, link_count: 0, cover: null, first_link: null, updated_at: "", ...p,
});

describe("recherche combinée (scénario G)", () => {
  const ctx = makeContext([cycle("c1", "Humains.ia", "fc"), cycle("c2", "JPO", "he")], [], tags);
  const list = [
    pub({ title: "ok", channel_tag_id: "ig", diffusion_status: "programme", scheduled_at: "2027-01-20T08:00:00Z" }),
    pub({ title: "pas programmé", channel_tag_id: "ig" }),
    pub({ title: "autre public", cycle_id: "c2", channel_tag_id: "ig", diffusion_status: "programme" }),
    pub({ title: "linkedin", channel_tag_id: "li", diffusion_status: "programme" }),
  ];
  it("Instagram + Formation Continue (hérité du cycle) + Programmé", () => {
    const f = { ...EMPTY_FILTERS, channelIds: ["ig"], audienceIds: ["fc"], diffusion: ["programme" as const] };
    expect(list.filter((p) => matchesPublication(p, f, ctx)).map((p) => p.title)).toEqual(["ok"]);
  });
  it("texte sans accents ni casse, nom de cycle", () => {
    expect(list.filter((p) => matchesPublication(p, { ...EMPTY_FILTERS, q: "HUMAINS linkédin" }, ctx)).map((p) => p.title)).toEqual(["linkedin"]);
  });
  it("période sur la date programmée en janvier", () => {
    const f = { ...EMPTY_FILTERS, from: "2027-01-01", to: "2027-01-31" };
    expect(list.filter((p) => matchesPublication(p, f, ctx)).map((p) => p.title)).toEqual(["ok"]);
    expect(effectiveDate(list[0])).toBe("2027-01-20");
  });
});

describe("domaine", () => {
  it("une date cible ne rend pas « Programmé »", () => {
    expect(cardStage({ production_status: "pret", diffusion_status: "a_programmer" })).toBe("a_programmer");
    expect(cardStage({ production_status: "pret", diffusion_status: "programme" })).toBe("programme");
  });
  it("types de fichiers", () => {
    expect(normalizeMime("a.JPG", "")).toBe("image/jpeg");
    expect(normalizeMime("page.html", "text/html")).toBe("text/html");
    expect(normalizeMime("virus.exe", "application/x-msdownload")).toBeNull();
  });
  it("migrations découpées en instructions", () => {
    expect(splitSql(MIGRATIONS[0].sql).length).toBeGreaterThan(20);
  });
});
