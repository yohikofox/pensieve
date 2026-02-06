# Story 5.4: Complétion et Navigation des Actions
# Feature file for BDD acceptance tests

Feature: Todo Completion and Navigation to Origin
  As a user
  I want to mark actions as completed with satisfying feedback and navigate back to the original idea
  So that I can track my progress and understand the context of each action

  Background:
    Given the mobile app is running
    And I am on the "Actions" tab

  # AC1: Mark Todo Complete with Checkbox
  Scenario: Mark todo complete with checkbox animation and haptic feedback
    Given I see a todo "Buy groceries" with status "todo"
    When I tap the checkbox for "Buy groceries"
    Then the checkbox animates to checked state with scale animation
    And the todo text gets strikethrough styling
    And I feel haptic feedback
    And a garden celebration animation plays (seed sprout)
    And the todo status is updated to "completed" in the database
    And the "À faire" filter count decreases by 1
    And the "Faites" filter count increases by 1

  # AC2: Todo Status Update and Sync
  Scenario: Completed todo syncs and updates filter counts
    Given I have a todo "Call dentist" with status "todo"
    And I am viewing the "À faire" filter
    When I mark "Call dentist" as complete
    Then the todo entity status changes to "completed"
    And a completion timestamp is recorded
    And the todo smoothly animates out of the "À faire" list
    And the filter count badges update in real-time
    And the change syncs to the cloud when online

  # AC3: Unmark Todo as Complete (Toggle)
    Given I have a todo "Read book" with status "completed"
    When I tap the checkbox again
    Then the todo status returns to "todo"
    And the strikethrough is removed with reverse animation
    And haptic feedback confirms the un-completion
    And the todo reappears in the "À faire" filter

  # AC4: Open Todo Detail View
  Scenario: Tap todo card to open detail modal
    Given I see a todo "Prepare presentation" in the list
    When I tap anywhere on the todo card except the checkbox
    Then a detail modal opens showing full todo information
    And I can see the complete description, deadline, and priority
    And I can edit any of these fields inline
    And changes are saved immediately with optimistic UI updates

  # AC5: Inline Editing in Todo Detail
  Scenario: Edit todo details in modal
    Given I am in the todo detail modal for "Write report"
    When I tap on the description field
    Then the field becomes editable with keyboard focus
    When I modify the value to "Write quarterly report"
    And I tap outside the field
    Then the update is saved to the database immediately
    And the UI reflects the change optimistically
    And the change rolls back on error

  # AC6-AC7: View Origin Button and Navigation
  Scenario: Navigate to source capture from todo
    Given I am in the todo detail modal for "Review PR #123"
    When I look for the source context
    Then I see a "View Origin" button
    And the button shows a preview of the source idea text
    When I tap "View Origin"
    Then the app navigates to the Feed tab
    And opens the detail view of the source capture
    And the transition animation is smooth
    And a back button allows me to return to the Actions tab

  # AC8: Highlighted Source Context
  Scenario: Source idea and todo are highlighted
    Given I navigated to a source capture from todo "Fix login bug"
    When the capture detail view opens
    Then the source idea is highlighted with subtle glow
    And the originating todo is highlighted within that idea
    And the view automatically scrolls to show the highlighted context
    And the highlights fade after 2-3 seconds

  # AC9: Completion Animation (Jardin d'idées)
  Scenario: Garden celebration animation plays on completion
    Given I see a todo "Water plants" in the Feed (inline)
    When I tap the checkbox to complete it
    Then a seed sprout animation plays
    And the animation respects the "Jardin d'idées" metaphor
    And the animation is subtle and celebratory
    And the animation is not disruptive
    And the todo remains visible but dimmed

  # AC10: Bulk Delete Completed Todos
  Scenario: Bulk delete all completed todos
    Given I have 5 completed todos
    And I am viewing the "Faites" filter
    When I tap the "Delete All Completed" button
    Then a confirmation dialog appears asking "Delete 5 completed actions?"
    When I confirm the deletion
    Then all 5 completed todos are removed from the database
    And the "Faites" filter count becomes 0
    And a success message shows "5 actions deleted"

  # AC11: Swipe Actions on Todo Cards
  Scenario: Swipe todo card for quick actions
    Given I see a todo "Buy milk" in the Actions tab
    When I swipe the todo card to the left
    Then quick actions appear: Complete, Delete, Edit
    And the swipe reveals actions with smooth animation
    And haptic feedback confirms the swipe
    When I tap "Complete"
    Then the todo is immediately marked as done
    And the celebration animation plays
