import { describe, expect, it } from "vitest";
import { aggregatePeopleReport, minutesToHours, type PersonTicketCount } from "./peopleReport.js";

const counts: PersonTicketCount[] = [
  { userId: 1, userName: "Bruno", status: "resolvido", category: "Hardware", total: 2 },
  { userId: 1, userName: "Bruno", status: "aberto", category: "Rede", total: 1 },
  { userId: 2, userName: "Ana", status: "aberto", category: "Rede", total: 3 },
  { userId: null, userName: null, status: "aberto", category: "Rede", total: 9 },
];

describe("aggregatePeopleReport", () => {
  const report = aggregatePeopleReport(counts, [
    { userId: 1, resolved: 2, avgMinutes: 90 },
    { userId: 2, resolved: 0, avgMinutes: null },
  ]);

  it("keeps 'no assignee' last even with the most tickets, and breaks ties by name", () => {
    // Bruno e Ana têm 3 chamados cada: Ana vem antes pelo nome.
    expect(report.people.map((p) => p.userId)).toEqual([2, 1, null]);
  });

  it("orders people with more tickets first", () => {
    const more = aggregatePeopleReport(
      [...counts, { userId: 1, userName: "Bruno", status: "aberto", category: "Rede", total: 1 }],
      [],
    );
    expect(more.people.map((p) => p.userId)).toEqual([1, 2, null]);
  });

  it("splits each person by status and category", () => {
    const bruno = report.people.find((p) => p.userId === 1)!;
    expect(bruno.total).toBe(3);
    expect(bruno.byStatus.resolvido).toBe(2);
    expect(bruno.byStatus.aberto).toBe(1);
    expect(bruno.byCategory).toEqual([
      { label: "Hardware", total: 2 },
      { label: "Rede", total: 1 },
    ]);
  });

  it("adds resolved tickets and the average resolution time in hours", () => {
    const bruno = report.people.find((p) => p.userId === 1)!;
    expect(bruno.resolved).toBe(2);
    expect(bruno.avgResolutionHours).toBe(1.5);
    const ana = report.people.find((p) => p.userId === 2)!;
    expect(ana.resolved).toBe(0);
    expect(ana.avgResolutionHours).toBeNull();
  });

  it("defaults to zero resolved when a person has no resolution data", () => {
    const none = report.people.find((p) => p.userId === null)!;
    expect(none.resolved).toBe(0);
    expect(none.avgResolutionHours).toBeNull();
  });

  it("lists categories by frequency", () => {
    expect(report.categories).toEqual(["Rede", "Hardware"]);
  });
});

describe("minutesToHours", () => {
  it("rounds to one decimal", () => {
    expect(minutesToHours(100)).toBe(1.7);
    expect(minutesToHours(null)).toBeNull();
  });
});

describe("aggregatePeopleReport ratings", () => {
  it("adds the average rating, rounded to one decimal, and how many were rated", () => {
    const { people } = aggregatePeopleReport(
      [{ userId: 1, userName: "Bruno", status: "resolvido", category: "Rede", total: 3 }],
      [{ userId: 1, resolved: 3, avgMinutes: 60, avgRating: 4.333, rated: 3 }],
    );
    expect(people[0]).toMatchObject({ avgRating: 4.3, rated: 3 });
  });

  it("leaves the average empty when nobody rated", () => {
    const { people } = aggregatePeopleReport(
      [{ userId: 1, userName: "Bruno", status: "aberto", category: "Rede", total: 1 }],
      [{ userId: 1, resolved: 0, avgMinutes: null }],
    );
    expect(people[0]).toMatchObject({ avgRating: null, rated: 0 });
  });
});
