import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithTheme } from "../../test/render";
import type { WorkflowNode } from "../../types/workflows";
import { AutomationExecutionDialog } from "./AutomationExecutionDialog";

describe("AutomationExecutionDialog", () => {
  it("collects required text inputs and preserves configured defaults", () => {
    const onSubmit = vi.fn();

    renderWithTheme(
      <AutomationExecutionDialog
        workflowName="Release workflow"
        mode="dry-run"
        nodes={[
          createInputNode("message", "Messaggio", true, ""),
          createInputNode("channel", "Canale", false, "stable")
        ]}
        willSaveChanges={false}
        loading={false}
        error={null}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Genera anteprima" }));
    expect(screen.getByText("Questo valore è obbligatorio")).toBeVisible();
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole("textbox", { name: /Messaggio/ }), {
      target: { value: "release candidate" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Genera anteprima" }));

    expect(onSubmit).toHaveBeenCalledWith({
      message: "release candidate",
      channel: "stable"
    });
  });
});

function createInputNode(
  key: string,
  label: string,
  required: boolean,
  defaultValue: string
): WorkflowNode {
  return {
    id: `input-${key}`,
    type: "input.text",
    name: label,
    position: { x: 0, y: 0 },
    config: {
      key,
      label,
      description: "",
      placeholder: "",
      defaultValue,
      required,
      multiline: false
    }
  };
}
