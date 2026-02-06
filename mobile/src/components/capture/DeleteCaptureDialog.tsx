/**
 * DeleteCaptureDialog Component
 *
 * Confirmation dialog for capture deletion
 * Story 5.4 - Autonomous component: calls hooks directly, no prop drilling
 */

import React from "react";
import { AlertDialog } from "../../design-system/components";
import { useDeleteCapture } from "../../hooks/useDeleteCapture";

export function DeleteCaptureDialog() {
  // Autonomous - calls hooks directly
  const { showDeleteDialog, confirmDelete, cancelDelete } = useDeleteCapture();

  return (
    <AlertDialog
      visible={showDeleteDialog}
      onClose={cancelDelete}
      title="Supprimer cette capture ?"
      message="Cette action est irréversible."
      icon="trash-2"
      variant="danger"
      confirmAction={{
        label: "Supprimer",
        onPress: confirmDelete,
      }}
      cancelAction={{
        label: "Annuler",
        onPress: cancelDelete,
      }}
    />
  );
}
