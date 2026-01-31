/**
 * DebugRect - Rectangle de debug pour visualiser les bounds d'un élément
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface DebugRectProps {
  /** X coordinate (window) */
  x: number;
  /** Y coordinate (window) */
  y: number;
  /** Width (window) */
  width: number;
  /** Height (window) */
  height: number;
  /** Border color */
  color?: string;
  /** Label */
  label?: string;
}

export function DebugRect({ x, y, width, height, color = '#FFFF00', label }: DebugRectProps) {
  return (
    <>
      <View
        style={[
          styles.rect,
          {
            left: x,
            top: y,
            width,
            height,
            borderColor: color,
          },
        ]}
      />
      {label && (
        <View style={[styles.labelContainer, { left: x, top: y - 25 }]}>
          <Text style={styles.label}>{label}</Text>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  rect: {
    position: 'absolute',
    borderWidth: 2,
    borderStyle: 'dashed',
    zIndex: 9999,
    pointerEvents: 'none',
  },
  labelContainer: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 4,
    borderRadius: 4,
    zIndex: 10000,
  },
  label: {
    color: '#FFFF00',
    fontSize: 10,
    fontFamily: 'monospace',
  },
});
