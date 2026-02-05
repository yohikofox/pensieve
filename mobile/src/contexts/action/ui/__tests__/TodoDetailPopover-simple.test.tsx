/**
 * TodoDetailPopover Simple Test - Debug "Element type is invalid" error
 */

import 'reflect-metadata';
import React from 'react';
import { View, Text } from 'react-native';
import { render } from '@testing-library/react-native';

// Create a SUPER SIMPLE mock component to test if the issue is with our test setup
const SimpleTodoDetailPopover: React.FC<any> = ({ visible, todo, onClose }) => {
  if (!visible) return null;

  return (
    <View testID="simple-popover">
      <Text>Todo: {todo.description}</Text>
    </View>
  );
};

describe('TodoDetailPopover - Simple Mock Test', () => {
  const mockTodo = {
    id: 'todo-1',
    description: 'Test description',
    status: 'todo' as const,
    priority: 'medium' as const,
  };

  it('should render simple mock without crashing', () => {
    const { getByTestId, getByText } = render(
      <SimpleTodoDetailPopover
        visible={true}
        todo={mockTodo}
        onClose={() => {}}
      />
    );

    expect(getByTestId('simple-popover')).toBeTruthy();
    expect(getByText('Todo: Test description')).toBeTruthy();
  });
});
