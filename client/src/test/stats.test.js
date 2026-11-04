import { expect, test } from "vitest";
import { studentStats } from "../utils/studentStats";
import { academicCareers } from "./academicFixtures";

test("statistics use referenced careers, career-level pairs and actual registration month", () => {
  const now = new Date(2026, 9, 20, 12);
  expect(studentStats([
    { careerId: academicCareers[0]._id, nivelAcademico: 1, createdAt: new Date(2026, 9, 1).toISOString() },
    { careerId: academicCareers[0]._id, nivelAcademico: 2, createdAt: new Date(2026, 8, 30).toISOString() },
    { careerId: academicCareers[1]._id, nivelAcademico: 1, createdAt: new Date(2025, 9, 1).toISOString() },
    { careerId: academicCareers[1]._id, nivelAcademico: 1, createdAt: new Date(2026, 9, 25).toISOString() },
    { createdAt: "invalid-date" }, {},
  ], academicCareers, now)).toEqual({ total: 6, activeCareers: 2, levels: 3, newThisMonth: 1 });
  expect(studentStats([], [], now)).toEqual({ total: 0, activeCareers: 0, levels: 0, newThisMonth: 0 });
  expect(studentStats([], academicCareers, now).activeCareers).toBe(2);
});
