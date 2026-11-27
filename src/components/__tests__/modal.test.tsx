// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it } from "vitest";
import { Modal } from "@/components/ui";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  document.body.innerHTML = "";
});

it("abre o modal direto no body, fora da área animada da aba", () => {
  // A aba fica dentro de .fade-up (animação com transform), que prende elementos `position: fixed`.
  const tab = document.createElement("div");
  tab.className = "fade-up";
  document.body.appendChild(tab);
  const root = createRoot(tab);
  act(() => root.render(<Modal open onClose={() => {}} title="Nova conta fixa"><input name="desc" /></Modal>));

  const dialog = document.querySelector('[role="dialog"]');
  expect(dialog).not.toBeNull();
  expect(dialog!.closest(".fade-up")).toBeNull();
  expect(tab.contains(dialog)).toBe(false);

  act(() => root.unmount());
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});
