import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';

const HF_TOKEN_ENDPOINT = 'https://huggingface.co/oauth/token';

@Controller()
export class AppController {
  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  @Get('auth/huggingface/callback')
  async handleHuggingFaceOAuthCallback(
    @Query('code') code: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    return this.handleHuggingFaceCallback(code, error, res);
  }

  @Get()
  async handleAuthCallback(
    @Res() res: Response,
  ) {
    // Handle Supabase auth callback (fragment-based)
    // Serve an HTML page that reads the fragment (#access_token=...)
    // and redirects to the mobile app via deep link
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Email Confirmed</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }
          .container {
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            text-align: center;
            max-width: 400px;
          }
          h1 { color: #333; margin-bottom: 20px; }
          p { color: #666; margin-bottom: 30px; }
          .emoji { font-size: 64px; margin-bottom: 20px; }
          .button {
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 12px 24px;
            border-radius: 6px;
            text-decoration: none;
            font-weight: 600;
            margin-top: 20px;
          }
          .button:hover {
            background: #5568d3;
          }
          .loading {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid #f3f3f3;
            border-top: 3px solid #667eea;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="emoji">✅</div>
          <h1 id="title">Processing...</h1>
          <p id="message">
            <div class="loading"></div>
          </p>
          <a id="deeplink" href="#" class="button" style="display: none;">Open Pensine App</a>
        </div>

        <script>
          // Read tokens from URL fragment (#access_token=...)
          const hash = window.location.hash.substring(1);
          const params = new URLSearchParams(hash);

          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');
          const type = params.get('type') || 'signup';

          if (accessToken && refreshToken) {
            // Build deep link for mobile app
            const deepLink = \`pensine://auth/callback?access_token=\${accessToken}&refresh_token=\${refreshToken}&type=\${type}\`;

            // Update UI
            document.getElementById('title').textContent = 'Email Confirmed!';
            document.getElementById('message').innerHTML = 'Your email has been verified. Opening Pensine app...';

            const linkElement = document.getElementById('deeplink');
            linkElement.href = deepLink;
            linkElement.style.display = 'inline-block';

            // Try to open the app automatically
            setTimeout(() => {
              window.location.href = deepLink;
            }, 1500);

            // Update message after delay
            setTimeout(() => {
              document.getElementById('message').innerHTML = \`
                If the app doesn't open automatically, click the button below.
                <br><br>
                <small style="color: #999;">
                  Make sure Pensine app is installed on your device.
                </small>
              \`;
            }, 3000);
          } else {
            // No tokens in URL
            document.getElementById('title').textContent = '❌ Invalid Link';
            document.getElementById('message').textContent = 'This confirmation link is invalid or has expired.';
          }
        </script>
      </body>
      </html>
    `);
  }

  /**
   * Handle HuggingFace OAuth callback
   * Exchanges auth code for access token and redirects to mobile app
   */
  private async handleHuggingFaceCallback(
    code: string | undefined,
    error: string | undefined,
    res: Response,
  ) {
    // If error from HuggingFace, redirect with error
    if (error) {
      console.error('[HuggingFace] OAuth error:', error);
      return res.redirect(`pensine://auth/huggingface?error=${encodeURIComponent(error)}`);
    }

    if (!code) {
      return res.redirect('pensine://auth/huggingface?error=no_code');
    }

    // Read env vars at runtime (after ConfigModule has loaded .env)
    const clientId = process.env.HF_CLIENT_ID;
    const clientSecret = process.env.HF_CLIENT_SECRET;
    const redirectUri = process.env.HF_REDIRECT_URI;

    console.log('[HuggingFace] Config:', {
      clientId: clientId ? `${clientId.substring(0, 8)}...` : '(empty)',
      clientSecret: clientSecret ? '***' : '(empty)',
      redirectUri: redirectUri || '(empty)',
    });

    if (!clientId || !clientSecret || !redirectUri) {
      console.error('[HuggingFace] Missing HF_CLIENT_ID, HF_CLIENT_SECRET, or HF_REDIRECT_URI');
      return res.redirect('pensine://auth/huggingface?error=server_config');
    }

    try {
      // Exchange authorization code for access token
      const tokenResponse = await fetch(HF_TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientSecret,
          code: code,
          redirect_uri: redirectUri,
        }).toString(),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('[HuggingFace] Token exchange failed:', tokenResponse.status, errorText);
        return res.redirect('pensine://auth/huggingface?error=token_exchange_failed');
      }

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;

      if (!accessToken) {
        console.error('[HuggingFace] No access_token in response:', tokenData);
        return res.redirect('pensine://auth/huggingface?error=no_token');
      }

      console.log('[HuggingFace] OAuth successful, redirecting to app');

      // Serve HTML page that redirects to mobile app via deep link
      const deepLink = `pensine://auth/huggingface?access_token=${encodeURIComponent(accessToken)}`;

      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>HuggingFace Connected</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #FFD21E 0%, #FF9500 100%);
            }
            .container {
              background: white;
              padding: 40px;
              border-radius: 12px;
              box-shadow: 0 10px 40px rgba(0,0,0,0.2);
              text-align: center;
              max-width: 400px;
            }
            h1 { color: #333; margin-bottom: 20px; }
            p { color: #666; margin-bottom: 30px; }
            .emoji { font-size: 64px; margin-bottom: 20px; }
            .button {
              display: inline-block;
              background: #FFD21E;
              color: #333;
              padding: 12px 24px;
              border-radius: 6px;
              text-decoration: none;
              font-weight: 600;
              margin-top: 20px;
            }
            .button:hover {
              background: #FFC000;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="emoji">🤗</div>
            <h1>HuggingFace Connected!</h1>
            <p id="message">Opening Pensieve app...</p>
            <a id="deeplink" href="${deepLink}" class="button">Open Pensieve App</a>
          </div>
          <script>
            // Try to open app automatically
            setTimeout(() => {
              window.location.href = "${deepLink}";
            }, 500);

            // Update message after delay
            setTimeout(() => {
              document.getElementById('message').textContent = 'Click the button below if the app did not open automatically.';
            }, 2000);
          </script>
        </body>
        </html>
      `);

    } catch (err) {
      console.error('[HuggingFace] Callback error:', err);
      return res.redirect('pensine://auth/huggingface?error=server_error');
    }
  }
}
