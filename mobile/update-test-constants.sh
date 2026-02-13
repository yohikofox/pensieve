#!/bin/bash

# List of test files to update
files=(
  "src/contexts/capture/__tests__/capture-integration.test.ts"
  "src/contexts/capture/__tests__/capture-performance.test.ts"
  "src/contexts/capture/data/__tests__/CaptureRepository.test.ts"
  "src/contexts/capture/data/mappers/__tests__/capture.mapper.test.ts"
  "src/contexts/capture/domain/__tests__/Capture.model.test.ts"
  "src/contexts/capture/domain/__tests__/Capture.retry.test.ts"
  "src/contexts/capture/services/__tests__/RecordingService.regression.test.ts"
  "src/contexts/capture/services/__tests__/OfflineSyncService.test.ts"
  "src/contexts/capture/services/__tests__/RetentionPolicyService.test.ts"
  "src/contexts/capture/services/__tests__/SyncQueueService.test.ts"
)

for file in "${files[@]}"; do
  echo "Processing $file..."

  # Check if file already has the import
  if ! grep -q "CAPTURE_TYPES, CAPTURE_STATES" "$file"; then
    # Find the correct import location based on relative path
    if [[ $file == *"/__tests__/"* ]]; then
      # Files in __tests__ subdirectories
      if [[ $file == *"/domain/__tests__/"* ]]; then
        import_path="../Capture.model"
      elif [[ $file == *"/data/__tests__/"* ]]; then
        import_path="../../domain/Capture.model"
      elif [[ $file == *"/services/__tests__/"* ]]; then
        import_path="../../domain/Capture.model"
      elif [[ $file == *"/data/mappers/__tests__/"* ]]; then
        import_path="../../../domain/Capture.model"
      else
        import_path="../../domain/Capture.model"
      fi
    else
      import_path="../domain/Capture.model"
    fi

    # Add import after the last existing import
    perl -pi -e "if (/^import/ && !defined \$found) { \$last_import = \$_; } elsif (defined \$last_import && !/^import/ && !defined \$found) { print \"import { CAPTURE_TYPES, CAPTURE_STATES } from '$import_path';\n\"; \$found = 1; }" "$file"
  fi

  # Replace string literals with constants
  perl -pi -e "
    s/type: 'audio'/type: CAPTURE_TYPES.AUDIO/g;
    s/type: 'text'/type: CAPTURE_TYPES.TEXT/g;
    s/type: 'image'/type: CAPTURE_TYPES.IMAGE/g;
    s/type: 'url'/type: CAPTURE_TYPES.URL/g;
    s/state: 'recording'/state: CAPTURE_STATES.RECORDING/g;
    s/state: 'captured'/state: CAPTURE_STATES.CAPTURED/g;
    s/state: 'processing'/state: CAPTURE_STATES.PROCESSING/g;
    s/state: 'ready'/state: CAPTURE_STATES.READY/g;
    s/state: 'failed'/state: CAPTURE_STATES.FAILED/g;
    s/type: \"audio\"/type: CAPTURE_TYPES.AUDIO/g;
    s/type: \"text\"/type: CAPTURE_TYPES.TEXT/g;
    s/type: \"image\"/type: CAPTURE_TYPES.IMAGE/g;
    s/type: \"url\"/type: CAPTURE_TYPES.URL/g;
    s/state: \"recording\"/state: CAPTURE_STATES.RECORDING/g;
    s/state: \"captured\"/state: CAPTURE_STATES.CAPTURED/g;
    s/state: \"processing\"/state: CAPTURE_STATES.PROCESSING/g;
    s/state: \"ready\"/state: CAPTURE_STATES.READY/g;
    s/state: \"failed\"/state: CAPTURE_STATES.FAILED/g;
  " "$file"
done

echo "Done!"
