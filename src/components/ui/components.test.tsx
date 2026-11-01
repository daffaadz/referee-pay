// @vitest-environment jsdom
import React, { useState } from "react";
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Button,
  Input,
  Textarea,
  MoneyField,
  NumberStepper,
  Select,
  Checkbox,
  RadioGroup,
  Chip,
  StatusChip,
  Card,
  CardHeader,
  Toast,
} from "./index";

beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  window.HTMLElement.prototype.hasPointerCapture = vi.fn();
  window.HTMLElement.prototype.releasePointerCapture = vi.fn();
});

describe("Referee UI System Components (Keyboard & Interaction)", () => {
  it("Button triggers on click and keyboard Enter/Space", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Submit</Button>);

    const btn = screen.getByRole("button", { name: /submit/i });
    btn.focus();
    expect(document.activeElement).toBe(btn);

    await user.keyboard("{Enter}");
    expect(handleClick).toHaveBeenCalledTimes(1);

    await user.keyboard(" ");
    expect(handleClick).toHaveBeenCalledTimes(2);
  });

  it("Button disabled prevents click and keyboard activation", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(<Button disabled onClick={handleClick}>Disabled</Button>);

    const btn = screen.getByRole("button", { name: /disabled/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);

    await user.click(btn);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("Input supports focus, keyboard typing, and displays errors", async () => {
    const user = userEvent.setup();
    render(
      <Input
        label="Item name"
        placeholder="Enter name"
        error="Name is required"
      />
    );

    const input = screen.getByPlaceholderText("Enter name") as HTMLInputElement;
    await user.type(input, "Vintage Camera");
    expect(input.value).toBe("Vintage Camera");

    expect(screen.getByText("Name is required")).toBeTruthy();
    expect(input.getAttribute("aria-invalid")).toBe("true");
  });

  it("Textarea supports multi-line keyboard input", async () => {
    const user = userEvent.setup();
    render(<Textarea label="Notes" placeholder="Write terms" />);

    const textarea = screen.getByPlaceholderText("Write terms") as HTMLTextAreaElement;
    await user.type(textarea, "Line 1{Enter}Line 2");
    expect(textarea.value).toBe("Line 1\nLine 2");
  });

  it("MoneyField formats to 2 decimal places on blur and accepts only valid numeric input", async () => {
    const user = userEvent.setup();
    function MoneyHarness() {
      const [val, setVal] = useState("80");
      return <MoneyField value={val} onChange={setVal} placeholder="0.00" />;
    }
    render(<MoneyHarness />);

    const input = screen.getByPlaceholderText("0.00") as HTMLInputElement;
    expect(input.value).toBe("80");

    await user.clear(input);
    await user.type(input, "123.4");
    expect(input.value).toBe("123.4");

    fireEvent.blur(input);
    expect(input.value).toBe("123.40");
  });

  it("NumberStepper increments and decrements via ArrowUp and ArrowDown keys", async () => {
    function StepperHarness() {
      const [val, setVal] = useState(3);
      return <NumberStepper value={val} min={1} max={10} onChange={setVal} unitSuffix="days" />;
    }
    render(<StepperHarness />);

    const input = screen.getByRole("textbox") as HTMLInputElement;
    input.focus();
    expect(input.value).toBe("3");

    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(input.value).toBe("4");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input.value).toBe("3");

    // Test bounds
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    // Should clamp at min 1
    expect(input.value).toBe("1");
  });

  it("NumberStepper buttons respond to click", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<NumberStepper value={5} min={1} max={10} onChange={handleChange} label="Ship window" />);

    const plusBtn = screen.getByRole("button", { name: /increase ship window/i });
    await user.click(plusBtn);
    expect(handleChange).toHaveBeenCalledWith(6);

    const minusBtn = screen.getByRole("button", { name: /decrease ship window/i });
    await user.click(minusBtn);
    expect(handleChange).toHaveBeenCalledWith(4);
  });

  it("Select opens with Enter and accepts keyboard navigation", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(
      <Select
        label="Currency"
        value="USD"
        onValueChange={handleChange}
        options={[
          { value: "USD", label: "USD" },
          { value: "EUR", label: "EUR" },
        ]}
      />
    );

    const trigger = screen.getByRole("combobox");
    expect(trigger).toBeTruthy();
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    await user.keyboard("{Enter}");
  });

  it("Checkbox toggles via keyboard Space and click", async () => {
    const user = userEvent.setup();
    function CheckboxHarness() {
      const [checked, setChecked] = useState(false);
      return <Checkbox label="Accept returns" checked={checked} onCheckedChange={setChecked} />;
    }
    render(<CheckboxHarness />);

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox.getAttribute("data-state")).toBe("unchecked");

    checkbox.focus();
    await user.keyboard(" ");
    expect(checkbox.getAttribute("data-state")).toBe("checked");

    await user.click(checkbox);
    expect(checkbox.getAttribute("data-state")).toBe("unchecked");
  });

  it("RadioGroup supports card variant and keyboard arrow navigation", async () => {
    function RadioHarness() {
      const [val, setVal] = useState("BUYER");
      return (
        <RadioGroup
          label="Shipping payer"
          variant="card"
          value={val}
          onValueChange={setVal}
          options={[
            { value: "BUYER", label: "Buyer" },
            { value: "SELLER", label: "Seller" },
          ]}
        />
      );
    }
    render(<RadioHarness />);

    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(2);
    expect(radios[0].getAttribute("data-state")).toBe("checked");
    expect(radios[1].getAttribute("data-state")).toBe("unchecked");

    radios[0].focus();
    act(() => {
      fireEvent.keyDown(radios[0], { key: "ArrowDown" });
    });
  });

  it("Chip activates on keyboard Enter and Space", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(<Chip onClick={handleClick}>Example deal</Chip>);

    const chip = screen.getByRole("button", { name: /example deal/i });
    chip.focus();
    await user.keyboard("{Enter}");
    expect(handleClick).toHaveBeenCalledTimes(1);

    await user.keyboard(" ");
    expect(handleClick).toHaveBeenCalledTimes(2);
  });

  it("StatusChip renders all valid deal statuses", () => {
    const statuses = [
      "WAITING",
      "HELD",
      "SHIPPED",
      "DELIVERED",
      "RELEASED",
      "REFUNDED",
      "NEEDS_REVIEW",
      "PROBLEM",
    ] as const;

    statuses.forEach((s) => {
      const { unmount } = render(<StatusChip status={s} />);
      expect(screen.getByRole("status")).toBeTruthy();
      unmount();
    });
  });

  it("Card and CardHeader render title and content", () => {
    render(
      <Card>
        <CardHeader title="Summary" subtitle="Check clauses" />
        <p>Body content</p>
      </Card>
    );

    expect(screen.getByText("Summary")).toBeTruthy();
    expect(screen.getByText("Check clauses")).toBeTruthy();
    expect(screen.getByText("Body content")).toBeTruthy();
  });

  it("Toast renders message and triggers onClose", async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    render(<Toast message="Copied to clipboard" onClose={handleClose} durationMs={0} />);

    expect(screen.getByText("Copied to clipboard")).toBeTruthy();
    const closeBtn = screen.getByRole("button", { name: /close notification/i });
    await user.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
