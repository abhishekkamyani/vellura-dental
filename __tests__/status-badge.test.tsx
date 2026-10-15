/** @jest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "@/components/admin/status-badge";

describe("StatusBadge", () => {
  it.each([
    ["CONFIRMED", "Confirmed", "text-sky-700"],
    ["COMPLETED", "Completed", "text-emerald-700"],
    ["CANCELLED", "Cancelled", "text-rose-700"],
  ])("renders %s with its own colour", (status, label, colourClass) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toHaveClass(colourClass);
  });
});
