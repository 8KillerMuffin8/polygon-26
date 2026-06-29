import { describe, it, expect } from "vitest";
import { lineString } from "@turf/helpers";
import {
  snapToOriginalLine,
  clampHandleMove,
  sliceOriginalByDistances,
  initEditState,
  getLineLengthM,
  deriveFromEdits,
  MIN_SEGMENT_LENGTH_M,
} from "./line-path";

const original = lineString([
  [34.0, 32.0],
  [34.01, 32.0],
  [34.02, 32.01],
  [34.03, 32.01],
]);

describe("snapToOriginalLine", () => {
  it("projects an off-line point back onto the polyline", () => {
    const result = snapToOriginalLine(original, [34.015, 32.05]);
    expect(result.lonLat[0]).toBeGreaterThanOrEqual(34.0);
    expect(result.lonLat[0]).toBeLessThanOrEqual(34.03);
    expect(result.lonLat[1]).toBeGreaterThanOrEqual(32.0);
    expect(result.lonLat[1]).toBeLessThanOrEqual(32.01);
    expect(result.distanceM).toBeGreaterThan(0);
    expect(result.distanceM).toBeLessThan(getLineLengthM(original));
  });
});

describe("clampHandleMove", () => {
  it("prevents start from passing end", () => {
    const lineLength = getLineLengthM(original);
    const result = clampHandleMove(
      original,
      100,
      lineLength - 50,
      "start",
      lineLength - 20,
    );
    expect(result.startM).toBeLessThanOrEqual(
      result.endM - MIN_SEGMENT_LENGTH_M,
    );
  });

  it("prevents end from passing start", () => {
    const result = clampHandleMove(original, 500, 2000, "end", 100);
    expect(result.endM).toBeGreaterThanOrEqual(
      result.startM + MIN_SEGMENT_LENGTH_M,
    );
  });

  it("clamps to line bounds", () => {
    const lineLength = getLineLengthM(original);
    const startResult = clampHandleMove(original, 100, 1000, "start", -50);
    expect(startResult.startM).toBeGreaterThanOrEqual(0);

    const endResult = clampHandleMove(
      original,
      100,
      1000,
      "end",
      lineLength + 500,
    );
    expect(endResult.endM).toBeLessThanOrEqual(lineLength);
  });

  it("never returns negative distances", () => {
    const result = clampHandleMove(original, 100, 8, "start", 500);
    expect(result.startM).toBeGreaterThanOrEqual(0);
    expect(result.endM).toBeGreaterThan(result.startM);
  });
});

describe("sliceOriginalByDistances", () => {
  it("returns a sub-segment along the original coordinate path", () => {
    const lineLength = getLineLengthM(original);
    const sliced = sliceOriginalByDistances(
      original,
      lineLength * 0.2,
      lineLength * 0.8,
    );
    expect(sliced.geometry.coordinates.length).toBeGreaterThanOrEqual(2);
    sliced.geometry.coordinates.forEach((coord) => {
      expect(coord[0]).toBeGreaterThanOrEqual(34.0);
      expect(coord[0]).toBeLessThanOrEqual(34.03);
    });
  });

  it("applies flat altitude when provided", () => {
    const lineLength = getLineLengthM(original);
    const sliced = sliceOriginalByDistances(
      original,
      100,
      lineLength - 100,
      1500,
    );
    sliced.geometry.coordinates.forEach((coord) => {
      expect(coord[2]).toBe(1500);
    });
  });
});

describe("initEditState", () => {
  it("round-trips auto-trim output distances", () => {
    const lineLength = getLineLengthM(original);
    const trimmed = sliceOriginalByDistances(
      original,
      lineLength * 0.25,
      lineLength * 0.75,
    );
    const state = initEditState(original, trimmed, 0, 1200);

    const { trimmedLines } = deriveFromEdits([state], [original]);
    expect(trimmedLines).toHaveLength(1);
    expect(trimmedLines[0].geometry.coordinates[0][0]).toBeCloseTo(
      trimmed.geometry.coordinates[0][0],
      5,
    );
    expect(trimmedLines[0].geometry.coordinates[0][2]).toBe(1200);
  });
});
