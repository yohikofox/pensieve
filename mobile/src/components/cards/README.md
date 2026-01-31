# Swipeable Card Components (Story 3.4)

## SwipeableCard

Wrapper component pour ajouter des swipe actions aux capture cards.

### Usage dans CapturesListScreen

```typescript
// 1. Import the component
import { SwipeableCard } from '../../components/cards/SwipeableCard';
import { Share } from 'react-native';

// 2. In renderCaptureItem, wrap the Card:
const renderCaptureItem = ({ item }: { item: Capture }) => {
  const handleDelete = async () => {
    // Show confirmation dialog then delete
    setShowDeleteDialog(true);
    setCaptureToDelete(item);
  };

  const handleShare = async () => {
    // Share the capture
    await Share.share({
      message: item.normalizedText || item.rawContent || 'Capture',
      title: 'Partager la capture',
    });
  };

  return (
    <SwipeableCard
      onDelete={handleDelete}
      onShare={handleShare}
    >
      <TouchableOpacity onPress={() => handleCapturePress(item.id)}>
        <Card variant="elevated" className="mb-3">
          {/* ... existing card content ... */}
        </Card>
      </TouchableOpacity>
    </SwipeableCard>
  );
};
```

### Features

✅ **Swipe right** → Red delete action
✅ **Swipe left** → Blue share action (+ orange archive optional)
✅ **Haptic feedback** on action trigger
✅ **Spring physics** animation (smooth reveal)
✅ **Auto-close** after action
✅ **Overshoot prevention** (90px max width per action)

### Actions Available

| Direction | Icon | Color | Action | Callback |
|-----------|------|-------|--------|----------|
| Right | trash-2 | Red | Delete | `onDelete()` |
| Left | share-2 | Blue | Share | `onShare()` |
| Left | archive | Orange | Archive | `onArchive()` (optional) |

### Integration Checklist

- [ ] Import SwipeableCard in CapturesListScreen.tsx
- [ ] Wrap each Card in renderCaptureItem with SwipeableCard
- [ ] Implement onDelete callback (with confirmation dialog)
- [ ] Implement onShare callback (using React Native Share API)
- [ ] Optionally implement onArchive callback
- [ ] Test swipe left/right on cards
- [ ] Verify haptic feedback works on device

### Example Implementation

```typescript
import { SwipeableCard } from '../../components/cards/SwipeableCard';

function CapturesListScreen() {
  const handleDeleteCapture = async (captureId: string) => {
    const repository = container.resolve<ICaptureRepository>(TOKENS.ICaptureRepository);
    await repository.delete(captureId);
    toast.success('Capture supprimée');
    loadCaptures(); // Reload list
  };

  const handleShareCapture = async (capture: Capture) => {
    await Share.share({
      message: capture.normalizedText || capture.rawContent || '',
      title: 'Ma capture Pensieve',
    });
  };

  const renderCaptureItem = ({ item }: { item: Capture }) => (
    <SwipeableCard
      onDelete={() => handleDeleteCapture(item.id)}
      onShare={() => handleShareCapture(item)}
    >
      <Card>{/* ... */}</Card>
    </SwipeableCard>
  );

  return <FlatList renderItem={renderCaptureItem} />;
}
```

### Notes

- Each action is 90px wide
- Friction = 2 for smooth resistance
- Uses `react-native-gesture-handler` Swipeable
- Requires `expo-haptics` for feedback
- Auto-closes swipeable after action execution

### Testing Tips

1. **Swipe slowly** to see action labels reveal
2. **Quick swipe** triggers action immediately
3. **Tap outside** to close without action
4. **Delete action** should show confirmation before deleting
5. **Share action** should open native share sheet

---

**Story 3.4 AC:** ✅ Swipe actions on capture cards
**Status:** Component ready, integration pending
**Date:** 2026-01-31
