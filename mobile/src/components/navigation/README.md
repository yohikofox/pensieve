# Swipe Navigation Components (Story 3.2)

## SwipeNavigationHandler

Component pour activer la navigation par swipe left/right entre captures.

### Usage dans CaptureDetailScreen

```typescript
// 1. Import the component
import { SwipeNavigationHandler } from '../../components/navigation/SwipeNavigationHandler';

// 2. In the render, wrap the entire content:
return (
  <SwipeNavigationHandler
    captureId={captureId}
    onNavigate={(newId) => {
      // Re-load the capture when navigation occurs
      setLoading(true);
      loadCapture();
    }}
  >
    {/* Existing ScrollView or View content */}
    <ScrollView>
      {/* ... existing content ... */}
    </ScrollView>
  </SwipeNavigationHandler>
);
```

### Features

✅ **Swipe right** → Navigate to previous capture
✅ **Swipe left** → Navigate to next capture
✅ **Auto-disabled** when at first/last capture
✅ **Threshold**: 100px minimum swipe distance
✅ **Velocity detection** for natural feel

### Integration Checklist

- [ ] Import SwipeNavigationHandler in CaptureDetailScreen.tsx
- [ ] Wrap the main render content (ScrollView)
- [ ] Pass captureId from route.params
- [ ] Implement onNavigate callback to reload capture data
- [ ] Test swiping between captures
- [ ] Verify loadCapture() is called on navigation

### Technical Details

- Uses `react-native-gesture-handler` Pan Gesture
- Updates navigation params with setParams()
- Calls onNavigate callback for screen re-render
- Threshold: 100px translation + positive/negative velocity
- Integrates with useCapturesStore for capture list

### Example Implementation

```typescript
export function CaptureDetailScreen({ route, navigation }: Props) {
  const { captureId } = route.params;

  const loadCapture = useCallback(async () => {
    // Your existing loadCapture logic
  }, [captureId]);

  return (
    <SwipeNavigationHandler
      captureId={captureId}
      onNavigate={() => loadCapture()}
    >
      <ScrollView>
        {/* Your existing content */}
      </ScrollView>
    </SwipeNavigationHandler>
  );
}
```

---

**Story 3.2 AC:** ✅ Swipe left/right to navigate between captures
**Status:** Component ready, integration pending
**Date:** 2026-01-31
