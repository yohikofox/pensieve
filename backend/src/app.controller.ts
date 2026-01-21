import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';

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

  @Get()
  async handleAuthCallback(@Res() res: Response) {
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
}
