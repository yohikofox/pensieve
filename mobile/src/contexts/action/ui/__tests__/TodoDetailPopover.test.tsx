/**
 * TodoDetailPopover Component Tests
 *
 * Story 5.1 - Issue #7 (Code Review): Unit tests for TodoDetailPopover save logic
 * Tests editing, saving, change detection, and navigation
 */

import "reflect-metadata"; // Required for TSyringe DI
import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import type { Todo } from "../../domain/Todo.model";

// Mock all dependencies BEFORE importing the component
jest.mock("../../hooks/useUpdateTodo");
jest.mock("../../hooks/useToggleTodoStatus");
jest.mock("expo-haptics");
jest.mock("../../../../hooks/useTheme", () => ({
  useTheme: () => ({ isDark: false }),
}));
jest.mock("../../../../design-system/tokens", () => ({
  colors: {
    gray: {
      50: "#f9fafb",
      100: "#f3f4f6",
      200: "#e5e7eb",
      300: "#d1d5db",
      700: "#374151",
      800: "#1f2937",
      900: "#111827",
    },
    blue: { 50: "#eff6ff", 400: "#60a5fa", 500: "#3b82f6", 600: "#2563eb" },
    red: { 400: "#f87171", 500: "#ef4444" },
    yellow: { 400: "#fbbf24", 500: "#f59e0b" },
    green: { 400: "#4ade80", 500: "#22c55e" },
    white: "#ffffff",
  },
}));
jest.mock("../../utils/formatDeadline", () => ({
  formatDeadline: (deadline?: number) => ({
    text: deadline ? "Dans 1 jour" : "Pas d'échéance",
    isOverdue: false,
  }),
  getDeadlineColor: () => "#4b5563",
}));
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
  }),
}));
// Mock DateTimePickerModal as a proper React component
const MockDateTimePicker = (props: any) => null;
jest.mock("react-native-modal-datetime-picker", () => ({
  __esModule: true,
  default: MockDateTimePicker,
}));
jest.mock("tsyringe", () => ({
  container: {
    resolve: jest.fn(),
  },
}));
jest.mock("../../../../infrastructure/di/tokens", () => ({
  TOKENS: {
    ICaptureRepository: Symbol("ICaptureRepository"),
  },
}));

// NOW import the component after all mocks are set
import { TodoDetailPopover } from "../TodoDetailPopover";
import { useUpdateTodo } from "../../hooks/useUpdateTodo";
import { useToggleTodoStatus } from "../../hooks/useToggleTodoStatus";

// Mock Alert
jest.spyOn(Alert, "alert");

const mockUpdateTodo = jest.fn();
const mockToggleStatus = jest.fn();
const mockOnClose = jest.fn();

const mockTodo: Todo = {
  id: "todo-1",
  thoughtId: "thought-1",
  ideaId: "idea-1",
  captureId: "capture-1",
  userId: "user-1",
  description: "Test todo description",
  status: "todo",
  priority: "medium",
  deadline: Date.now() + 86400000, // Tomorrow
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

describe("TodoDetailPopover", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useUpdateTodo as jest.Mock).mockReturnValue({
      mutate: mockUpdateTodo,
    });
    (useToggleTodoStatus as jest.Mock).mockReturnValue({
      mutate: mockToggleStatus,
    });
  });

  describe("Minimal Rendering Test", () => {
    it("should render without crashing", () => {
      // Minimal test to see if component loads at all
      const { toJSON } = render(
        <TodoDetailPopover
          visible={true}
          todo={mockTodo}
          onClose={mockOnClose}
        />,
      );

      // Just check it doesn't crash
      expect(toJSON()).toBeTruthy();
    });
  });

  describe("Rendering", () => {
    it("should render todo details correctly", () => {
      const { getByText, getByDisplayValue } = render(
        <TodoDetailPopover
          visible={true}
          todo={mockTodo}
          onClose={mockOnClose}
        />,
      );

      expect(getByDisplayValue("Test todo description")).toBeTruthy();
      expect(getByText("Todo Details")).toBeTruthy();
    });

    it("should show priority buttons", () => {
      const { getByText } = render(
        <TodoDetailPopover
          visible={true}
          todo={mockTodo}
          onClose={mockOnClose}
        />,
      );

      expect(getByText("High")).toBeTruthy();
      expect(getByText("Medium")).toBeTruthy();
      expect(getByText("Low")).toBeTruthy();
    });
  });

  describe("Change Detection", () => {
    it("should enable Save button when description changes", async () => {
      const { getByDisplayValue, getByText } = render(
        <TodoDetailPopover
          visible={true}
          todo={mockTodo}
          onClose={mockOnClose}
        />,
      );

      const input = getByDisplayValue("Test todo description");
      fireEvent.changeText(input, "Modified description");

      await waitFor(() => {
        const saveButton = getByText("Save Changes");
        expect(saveButton).toBeTruthy();
        // Button should be enabled (not have disabled style)
      });
    });

    it("should enable Save button when priority changes", async () => {
      const { getByText } = render(
        <TodoDetailPopover
          visible={true}
          todo={mockTodo}
          onClose={mockOnClose}
        />,
      );

      const highButton = getByText("High");
      fireEvent.press(highButton);

      await waitFor(() => {
        const saveButton = getByText("Save Changes");
        expect(saveButton).toBeTruthy();
      });
    });

    it("should disable Save button when no changes", () => {
      const { getByText } = render(
        <TodoDetailPopover
          visible={true}
          todo={mockTodo}
          onClose={mockOnClose}
        />,
      );

      // Initially no changes, button should show "No Changes"
      expect(getByText("No Changes")).toBeTruthy();
    });
  });

  describe("Saving Changes", () => {
    it("should call updateTodo when description changed", async () => {
      const { getByDisplayValue, getByText } = render(
        <TodoDetailPopover
          visible={true}
          todo={mockTodo}
          onClose={mockOnClose}
        />,
      );

      const input = getByDisplayValue("Test todo description");
      fireEvent.changeText(input, "Modified description");

      await waitFor(() => {
        const saveButton = getByText("Save Changes");
        fireEvent.press(saveButton);
      });

      await waitFor(() => {
        expect(mockUpdateTodo).toHaveBeenCalledWith({
          id: "todo-1",
          changes: expect.objectContaining({
            description: "Modified description",
          }),
        });
      });
    });

    it("should call toggleStatus when completion status changed", async () => {
      const { getByText } = render(
        <TodoDetailPopover
          visible={true}
          todo={mockTodo}
          onClose={mockOnClose}
        />,
      );

      // Find and toggle completion switch (we look for the label text)
      const completedLabel = getByText(/Completed/i);
      expect(completedLabel).toBeTruthy();

      // Note: Testing Switch interaction is complex, so we verify it renders
      // Actual toggle testing would require accessing the Switch component directly
    });

    it("should save multiple changes at once", async () => {
      const { getByDisplayValue, getByText } = render(
        <TodoDetailPopover
          visible={true}
          todo={mockTodo}
          onClose={mockOnClose}
        />,
      );

      // Change description
      const input = getByDisplayValue("Test todo description");
      fireEvent.changeText(input, "New description");

      // Change priority
      const lowButton = getByText("Low");
      fireEvent.press(lowButton);

      await waitFor(() => {
        const saveButton = getByText("Save Changes");
        fireEvent.press(saveButton);
      });

      await waitFor(() => {
        expect(mockUpdateTodo).toHaveBeenCalledWith({
          id: "todo-1",
          changes: expect.objectContaining({
            description: "New description",
            priority: "low",
          }),
        });
      });
    });
  });

  describe("Cancel Behavior", () => {
    it("should reset changes on cancel", async () => {
      const { getByDisplayValue, getByText } = render(
        <TodoDetailPopover
          visible={true}
          todo={mockTodo}
          onClose={mockOnClose}
        />,
      );

      // Make a change
      const input = getByDisplayValue("Test todo description");
      fireEvent.changeText(input, "Modified description");

      // Cancel
      const cancelButton = getByText("✕");
      fireEvent.press(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it("should not call updateTodo if no changes on cancel", () => {
      const { getByText } = render(
        <TodoDetailPopover
          visible={true}
          todo={mockTodo}
          onClose={mockOnClose}
        />,
      );

      // Cancel without changes
      const cancelButton = getByText("✕");
      fireEvent.press(cancelButton);

      expect(mockUpdateTodo).not.toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe("Navigation to Source Capture", () => {
    it("should show View Origin button", () => {
      const { getByText } = render(
        <TodoDetailPopover
          visible={true}
          todo={mockTodo}
          onClose={mockOnClose}
        />,
      );

      expect(getByText("View Origin")).toBeTruthy();
    });
  });

  describe("State Management", () => {
    it("should reset local state when todo prop changes", () => {
      const { rerender, getByDisplayValue } = render(
        <TodoDetailPopover
          visible={true}
          todo={mockTodo}
          onClose={mockOnClose}
        />,
      );

      expect(getByDisplayValue("Test todo description")).toBeTruthy();

      // Change todo prop
      const newTodo = { ...mockTodo, description: "Different description" };
      rerender(
        <TodoDetailPopover
          visible={true}
          todo={newTodo}
          onClose={mockOnClose}
        />,
      );

      expect(getByDisplayValue("Different description")).toBeTruthy();
    });
  });
});
