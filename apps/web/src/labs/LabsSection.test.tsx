/** The Labs section: the toggle, the choice, the reload note and Reset all (DSN-82). */
import "../styles/tokens.css";
import "../styles/reset.css";
import "../styles/global.css";

import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

import { LabsSection } from "./LabsSection";
import { RevealTap } from "./RevealTap";
import { labsState, resetLabsStoreForTests } from "./store";
import { readLabs } from "./stored";

beforeEach(() => {
  localStorage.clear();
  resetLabsStoreForTests();
});

describe("LabsSection", () => {
  it("toggles a switch, asks for a reload, and Reset all puts it back", async () => {
    render(<LabsSection />);
    const margin = screen.getByRole("switch", { name: "Margin map" });
    expect(margin).toHaveAttribute("aria-checked", "false");
    await userEvent.click(screen.getByText("Margin map"));
    expect(margin).toHaveAttribute("aria-checked", "true");
    expect(readLabs().flags).toEqual({ margin: "1" });
    const row = margin.closest("[data-row]") as HTMLElement;
    expect(row).toHaveTextContent("Reload to apply.");
    await userEvent.click(screen.getByRole("button", { name: "Reset all" }));
    expect(margin).toHaveAttribute("aria-checked", "false");
    expect(labsState().flags).toEqual({});
    expect(row).not.toHaveTextContent("Reload to apply.");
  });

  it("picks a value of a multi-value flag", async () => {
    render(<LabsSection />);
    const palette = screen.getByRole("radiogroup", { name: "Markup palette" });
    await userEvent.click(within(palette).getByRole("radio", { name: "Groups" }));
    expect(labsState().flags).toEqual({ palette: "groups" });
  });

  it("is reachable by keyboard", async () => {
    render(<LabsSection />);
    const first = screen.getAllByRole("switch")[0] as HTMLElement;
    first.focus();
    await userEvent.keyboard(" ");
    expect(first).toHaveAttribute("aria-checked", "true");
  });
});

describe("RevealTap", () => {
  it("reveals Labs after five taps on the version", async () => {
    render(<RevealTap>1.0.0-beta.0</RevealTap>);
    const version = screen.getByText("1.0.0-beta.0");
    for (let i = 0; i < 4; i++) await userEvent.click(version);
    expect(labsState().shown).toBe(false);
    await userEvent.click(version);
    expect(labsState().shown).toBe(true);
    expect(readLabs().shown).toBe(true);
  });
});
