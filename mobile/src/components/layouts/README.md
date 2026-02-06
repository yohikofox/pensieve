# Layout Components

Reusable layout wrappers that provide consistent theming and structure across the app.
All layouts automatically adapt to the active color scheme (blue/green/monochrome).

## Available Layouts

### StandardLayout

For most app screens - provides consistent background and optional padding.

**Usage:**
```tsx
import { StandardLayout } from '@/components/layouts';

export function MyScreen() {
  return (
    <StandardLayout>
      <ScrollView>
        {/* Your content */}
      </ScrollView>
    </StandardLayout>
  );
}
```

**Props:**
- `useSafeArea?: boolean` - Use SafeAreaView wrapper (default: true)
- `style?: ViewStyle` - Additional custom styles
- `noPadding?: boolean` - Override default padding (default: true)

**When to use:**
- Settings screens
- List screens
- Form screens
- Most standard app screens

### FullScreenLayout

For immersive fullscreen experiences without padding.

**Usage:**
```tsx
import { FullScreenLayout } from '@/components/layouts';

export function CaptureScreen() {
  return (
    <FullScreenLayout>
      {/* Fullscreen content - no padding */}
    </FullScreenLayout>
  );
}
```

**Props:**
- `useSafeArea?: boolean` - Use SafeAreaView wrapper (default: false)
- `style?: ViewStyle` - Additional custom styles
- `backgroundColor?: 'screen' | 'card' | 'transparent'` - Background color (default: 'screen')

**When to use:**
- Capture/Record screen
- Media viewers (image, video)
- Onboarding screens
- Auth screens (if fullscreen design)
- Camera/Scanner screens

## Migration Guide

### Before
```tsx
export function MyScreen() {
  return (
    <ScrollView className="flex-1 bg-bg-screen">
      <View className="mt-5 mx-4">
        {/* content */}
      </View>
    </ScrollView>
  );
}
```

### After
```tsx
export function MyScreen() {
  return (
    <StandardLayout>
      <ScrollView className="flex-1">
        <View className="mt-5 mx-4">
          {/* content */}
        </View>
      </ScrollView>
    </StandardLayout>
  );
}
```

## Benefits

✅ **Automatic theming** - Adapts to color scheme changes (blue/green/monochrome)
✅ **Consistent structure** - Same layout behavior across all screens
✅ **Type-safe** - Full TypeScript support
✅ **Flexible** - Customizable via props
✅ **Safe areas** - Built-in SafeAreaView support
