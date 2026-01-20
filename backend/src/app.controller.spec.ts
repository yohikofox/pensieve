import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('handleAuthCallback', () => {
    it('should return HTML page with auth callback handler', async () => {
      // Arrange
      const mockResponse = {
        send: jest.fn(),
      } as any;

      // Act
      await appController.handleAuthCallback(mockResponse);

      // Assert
      expect(mockResponse.send).toHaveBeenCalledTimes(1);
      const htmlContent = mockResponse.send.mock.calls[0][0];

      // Verify it's HTML
      expect(htmlContent).toContain('<!DOCTYPE html>');
      expect(htmlContent).toContain('<html>');

      // Verify title
      expect(htmlContent).toContain('Email Confirmed');

      // Verify it handles deep link
      expect(htmlContent).toContain('pensine://auth/callback');

      // Verify it reads URL fragments (access_token, refresh_token)
      expect(htmlContent).toContain('access_token');
      expect(htmlContent).toContain('refresh_token');

      // Verify JavaScript is present
      expect(htmlContent).toContain('<script>');
      expect(htmlContent).toContain('window.location.hash');
    });

    it('should include user-friendly messages', async () => {
      // Arrange
      const mockResponse = {
        send: jest.fn(),
      } as any;

      // Act
      await appController.handleAuthCallback(mockResponse);

      // Assert
      const htmlContent = mockResponse.send.mock.calls[0][0];

      // Verify user-facing messages
      expect(htmlContent).toContain('Processing...');
      expect(htmlContent).toContain('Email Confirmed!');
      expect(htmlContent).toContain('Invalid Link');
    });

    it('should have responsive styling', async () => {
      // Arrange
      const mockResponse = {
        send: jest.fn(),
      } as any;

      // Act
      await appController.handleAuthCallback(mockResponse);

      // Assert
      const htmlContent = mockResponse.send.mock.calls[0][0];

      // Verify responsive viewport meta tag
      expect(htmlContent).toContain('name="viewport"');
      expect(htmlContent).toContain('width=device-width');

      // Verify CSS styling
      expect(htmlContent).toContain('<style>');
      expect(htmlContent).toContain('font-family');
    });
  });
});
