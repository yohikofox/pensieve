/**
 * InitialSyncProgressModal Unit Tests
 * Story 6.3 - Task 1.4: Progress Indicator UI
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { InitialSyncProgressModal } from '../InitialSyncProgressModal';

describe('InitialSyncProgressModal', () => {
  describe('Task 1.4: Progress indicator UI', () => {
    it('should render modal when visible=true', () => {
      const { getByText } = render(
        <InitialSyncProgressModal visible={true} progress={0} />
      );

      expect(getByText(/syncing/i)).toBeTruthy();
    });

    it('should not render modal when visible=false', () => {
      const { queryByText } = render(
        <InitialSyncProgressModal visible={false} progress={0} />
      );

      expect(queryByText(/syncing/i)).toBeNull();
    });

    it('should display progress percentage', () => {
      const { getByText } = render(
        <InitialSyncProgressModal visible={true} progress={42} />
      );

      expect(getByText(/42%/)).toBeTruthy();
    });

    it('should display 0% for initial state', () => {
      const { getByText } = render(
        <InitialSyncProgressModal visible={true} progress={0} />
      );

      expect(getByText(/0%/)).toBeTruthy();
    });

    it('should display 100% when complete', () => {
      const { getByText } = render(
        <InitialSyncProgressModal visible={true} progress={100} />
      );

      expect(getByText(/100%/)).toBeTruthy();
    });

    it('should display syncing message', () => {
      const { getByText } = render(
        <InitialSyncProgressModal visible={true} progress={50} />
      );

      expect(getByText(/syncing your data/i)).toBeTruthy();
    });
  });
});
