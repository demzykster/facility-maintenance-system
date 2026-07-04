import { describe, expect, it } from "vitest";
import { defaultWorkerView, WORKER_VIEWS } from "../src/workerProfileModel.js";

describe("worker profile model", () => {
  it("opens regular workers on the new report tab", () => {
    expect(defaultWorkerView({ role: "worker", dept: "מחסן" })).toBe(WORKER_VIEWS.newReport);
  });

  it("opens cleaning department workers on cleaning as their profile home", () => {
    expect(defaultWorkerView({ role: "worker", dept: "ניקיון" })).toBe(WORKER_VIEWS.cleaning);
  });

  it("opens manual cleaning-capable workers on cleaning as their profile home", () => {
    expect(defaultWorkerView({ role: "worker", dept: "מחסן", cleaningAccess: true })).toBe(WORKER_VIEWS.cleaning);
  });
});
