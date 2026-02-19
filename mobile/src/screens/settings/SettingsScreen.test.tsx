import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { SettingsScreen } from './SettingsScreen';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { apiConfig } from '../../config/api';

// Mock SecureStore (replaces Supabase auth)
const mockSecureStore: Record<string, string> = {
  ba_access_token: 'mock-token-123',
  ba_refresh_token: 'mock-refresh-token',
  ba_token_expires_at: String(Date.now() + 3600 * 1000),
};
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockSecureStore[key] ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => { mockSecureStore[key] = value; }),
  deleteItemAsync: jest.fn(async (key: string) => { delete mockSecureStore[key]; }),
}));

// Mock authClient
jest.mock('../../infrastructure/auth/auth-client', () => ({
  authClient: {
    signOut: jest.fn().mockResolvedValue({ error: null }),
  },
}));

// Mock dependencies
jest.mock('expo-file-system/legacy');
jest.mock('expo-sharing');
jest.mock('../../config/api', () => ({
  apiConfig: {
    endpoints: {
      rgpd: {
        export: 'https://api.example.local/api/rgpd/export',
        deleteAccount: 'https://api.example.local/api/rgpd/delete-account',
      },
    },
  },
}));

// Mock global fetch
global.fetch = jest.fn();
global.FileReader = jest.fn().mockImplementation(() => ({
  readAsDataURL: jest.fn(),
  onloadend: null,
  onerror: null,
  result: 'data:application/zip;base64,mockBase64Data',
}));

// Mock Alert
jest.spyOn(Alert, 'alert');

describe('SettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Restore valid token in SecureStore before each test
    mockSecureStore['ba_access_token'] = 'mock-token-123';
    mockSecureStore['ba_refresh_token'] = 'mock-refresh-token';
    mockSecureStore['ba_token_expires_at'] = String(Date.now() + 3600 * 1000);
  });

  describe('Export Data', () => {
    it('should render export button', () => {
      const { getByText } = render(<SettingsScreen />);
      expect(getByText('Exporter mes données')).toBeTruthy();
    });

    it('should show confirmation dialog when export button is pressed', () => {
      const { getByText } = render(<SettingsScreen />);

      fireEvent.press(getByText('Exporter mes données'));

      expect(Alert.alert).toHaveBeenCalledWith(
        'Exporter mes données',
        expect.stringContaining('ZIP'),
        expect.arrayContaining([
          expect.objectContaining({ text: 'Annuler' }),
          expect.objectContaining({ text: 'Exporter' }),
        ]),
      );
    });

    it('should call export API when confirmed', async () => {
      // Arrange
      const mockBlob = new Blob(['mock-zip'], { type: 'application/zip' });
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });
      (FileSystem.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);
      (Sharing.shareAsync as jest.Mock).mockResolvedValue(undefined);

      const { getByText } = render(<SettingsScreen />);

      // Act
      fireEvent.press(getByText('Exporter mes données'));

      // Get the confirmation callback
      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const confirmButton = alertCall[2].find((btn: any) => btn.text === 'Exporter');
      await confirmButton.onPress();

      // Assert
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          apiConfig.endpoints.rgpd.export,
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              Authorization: 'Bearer mock-token-123',
            }),
          }),
        );
      });
    });

    it('should save and share ZIP file after download', async () => {
      // Arrange
      const mockBlob = new Blob(['mock-zip'], { type: 'application/zip' });
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });
      (FileSystem.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);
      (Sharing.shareAsync as jest.Mock).mockResolvedValue(undefined);

      const { getByText } = render(<SettingsScreen />);

      // Act
      fireEvent.press(getByText('Exporter mes données'));
      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const confirmButton = alertCall[2].find((btn: any) => btn.text === 'Exporter');
      await confirmButton.onPress();

      // Assert
      await waitFor(() => {
        expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
          expect.stringContaining('pensine-export-'),
          expect.any(String),
          expect.objectContaining({
            encoding: FileSystem.EncodingType.Base64,
          }),
        );
        expect(Sharing.shareAsync).toHaveBeenCalledWith(
          expect.stringContaining('pensine-export-'),
          expect.objectContaining({
            mimeType: 'application/zip',
          }),
        );
      });
    });

    it('should show error alert if export fails', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const { getByText } = render(<SettingsScreen />);

      // Act
      fireEvent.press(getByText('Exporter mes données'));
      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const confirmButton = alertCall[2].find((btn: any) => btn.text === 'Exporter');
      await confirmButton.onPress();

      // Assert
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Erreur',
          expect.stringContaining('Network error'),
        );
      });
    });

    it('should show error if not authenticated', async () => {
      // Arrange — supprimer les tokens du store
      delete mockSecureStore['ba_access_token'];
      delete mockSecureStore['ba_refresh_token'];

      const { getByText } = render(<SettingsScreen />);

      // Act
      fireEvent.press(getByText('Exporter mes données'));
      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const confirmButton = alertCall[2].find((btn: any) => btn.text === 'Exporter');
      await confirmButton.onPress();

      // Assert
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Erreur',
          expect.stringContaining('Non authentifié'),
        );
      });
    });
  });

  describe('Delete Account', () => {
    it('should render delete button', () => {
      const { getByText } = render(<SettingsScreen />);
      expect(getByText('Supprimer mon compte')).toBeTruthy();
    });

    it('should show warning dialog when delete button is pressed', () => {
      const { getByText } = render(<SettingsScreen />);

      fireEvent.press(getByText('Supprimer mon compte'));

      expect(Alert.alert).toHaveBeenCalledWith(
        expect.stringContaining('Supprimer mon compte'),
        expect.stringContaining('DÉFINITIVE'),
        expect.arrayContaining([
          expect.objectContaining({ text: 'Annuler' }),
          expect.objectContaining({ text: 'Supprimer', style: 'destructive' }),
        ]),
      );
    });

    it('should show password modal when delete is confirmed', () => {
      const { getByText, getByPlaceholderText } = render(<SettingsScreen />);

      // Press delete button
      fireEvent.press(getByText('Supprimer mon compte'));

      // Confirm deletion
      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const deleteButton = alertCall[2].find((btn: any) => btn.text === 'Supprimer');
      deleteButton.onPress();

      // Password modal should be visible
      expect(getByText('Confirmer votre mot de passe')).toBeTruthy();
      expect(getByPlaceholderText('Mot de passe')).toBeTruthy();
    });

    it('should call delete API with password when confirmed', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValue({
        status: 204,
      });

      const { getByText, getByPlaceholderText } = render(<SettingsScreen />);

      // Press delete button
      fireEvent.press(getByText('Supprimer mon compte'));

      // Confirm deletion
      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const deleteButton = alertCall[2].find((btn: any) => btn.text === 'Supprimer');
      deleteButton.onPress();

      // Enter password
      const passwordInput = getByPlaceholderText('Mot de passe');
      fireEvent.changeText(passwordInput, 'MySecurePassword123');

      // Confirm password
      const confirmButton = getByText('Confirmer');
      fireEvent.press(confirmButton);

      // Assert
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          apiConfig.endpoints.rgpd.deleteAccount,
          expect.objectContaining({
            method: 'DELETE',
            headers: expect.objectContaining({
              Authorization: 'Bearer mock-token-123',
              'Content-Type': 'application/json',
            }),
            body: JSON.stringify({ password: 'MySecurePassword123' }),
          }),
        );
      });
    });

    it('should sign out after successful deletion', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValue({
        status: 204,
      });

      const { getByText, getByPlaceholderText } = render(<SettingsScreen />);

      // Act
      fireEvent.press(getByText('Supprimer mon compte'));
      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const deleteButton = alertCall[2].find((btn: any) => btn.text === 'Supprimer');
      deleteButton.onPress();

      const passwordInput = getByPlaceholderText('Mot de passe');
      fireEvent.changeText(passwordInput, 'MySecurePassword123');

      const confirmButton = getByText('Confirmer');
      fireEvent.press(confirmButton);

      // Wait for success alert
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Compte supprimé',
          expect.stringContaining('supprimés'),
          expect.any(Array),
        );
      });

      // Confirm sign out
      const successAlertCall = (Alert.alert as jest.Mock).mock.calls.find(
        (call) => call[0] === 'Compte supprimé',
      );
      const okButton = successAlertCall[2][0];
      await okButton.onPress();

      // Assert — signOut is called via authClient
      const { authClient } = require('../../infrastructure/auth/auth-client');
      expect(authClient.signOut).toHaveBeenCalled();
    });

    it('should show error for invalid password (401)', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValue({
        status: 401,
      });

      const { getByText, getByPlaceholderText } = render(<SettingsScreen />);

      // Act
      fireEvent.press(getByText('Supprimer mon compte'));
      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const deleteButton = alertCall[2].find((btn: any) => btn.text === 'Supprimer');
      deleteButton.onPress();

      const passwordInput = getByPlaceholderText('Mot de passe');
      fireEvent.changeText(passwordInput, 'WrongPassword');

      const confirmButton = getByText('Confirmer');
      fireEvent.press(confirmButton);

      // Assert
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Erreur',
          'Mot de passe incorrect.',
        );
      });
    });

    it('should not submit empty password', async () => {
      const { getByText, getByPlaceholderText } = render(<SettingsScreen />);

      // Act
      fireEvent.press(getByText('Supprimer mon compte'));
      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const deleteButton = alertCall[2].find((btn: any) => btn.text === 'Supprimer');
      deleteButton.onPress();

      // Don't enter password, just press confirm
      const confirmButton = getByText('Confirmer');
      fireEvent.press(confirmButton);

      // Assert
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Erreur',
          'Veuillez saisir votre mot de passe.',
        );
      });
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should close modal when cancel is pressed', () => {
      const { getByText, queryByPlaceholderText } = render(<SettingsScreen />);

      // Open modal
      fireEvent.press(getByText('Supprimer mon compte'));
      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const deleteButton = alertCall[2].find((btn: any) => btn.text === 'Supprimer');
      deleteButton.onPress();

      // Modal should be visible
      expect(queryByPlaceholderText('Mot de passe')).toBeTruthy();

      // Press cancel
      const cancelButton = getByText('Annuler');
      fireEvent.press(cancelButton);

      // Modal should be closed
      expect(queryByPlaceholderText('Mot de passe')).toBeNull();
    });
  });

  describe('UI Elements', () => {
    it('should render section title', () => {
      const { getByText } = render(<SettingsScreen />);
      expect(getByText('Confidentialité & Données')).toBeTruthy();
    });

    it('should render export subtitle', () => {
      const { getByText } = render(<SettingsScreen />);
      expect(getByText('Télécharger toutes vos données')).toBeTruthy();
    });

    it('should render delete subtitle', () => {
      const { getByText } = render(<SettingsScreen />);
      expect(getByText('Suppression définitive et irréversible')).toBeTruthy();
    });

    it('should show loading indicator during export', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100)),
      );

      const { getByText, UNSAFE_getAllByType } = render(<SettingsScreen />);

      // Act
      fireEvent.press(getByText('Exporter mes données'));
      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const confirmButton = alertCall[2].find((btn: any) => btn.text === 'Exporter');
      confirmButton.onPress();

      // Assert - ActivityIndicator should be visible
      await waitFor(() => {
        const activityIndicators = UNSAFE_getAllByType('ActivityIndicator' as any);
        expect(activityIndicators.length).toBeGreaterThan(0);
      });
    });
  });
});
