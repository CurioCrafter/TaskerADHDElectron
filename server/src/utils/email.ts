import nodemailer from 'nodemailer';

// Email configuration
const createTransporter = () => {
  if (process.env.NODE_ENV === 'development' || !process.env.SMTP_HOST) {
    // Development: Use console output or ethereal email
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: {
        user: 'ethereal.user@ethereal.email',
        pass: 'ethereal.pass'
      }
    });
  }

  // Production: Use configured SMTP
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

export async function sendMagicLinkEmail(email: string, magicLink: string): Promise<void> {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: process.env.FROM_EMAIL || 'noreply@taskeradhd.com',
      to: email,
      subject: '🎯 Your TaskerADHD Magic Link',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>TaskerADHD Magic Link</title>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
              line-height: 1.6; 
              color: #333; 
              max-width: 600px; 
              margin: 0 auto; 
              padding: 20px;
              background-color: #f8f9fa;
            }
            .container {
              background: white;
              padding: 40px;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            .button {
              display: inline-block;
              padding: 12px 24px;
              background-color: #4f46e5;
              color: white;
              text-decoration: none;
              border-radius: 6px;
              font-weight: 500;
              margin: 20px 0;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #eee;
              font-size: 14px;
              color: #666;
            }
            .focus-friendly {
              background-color: #f0f9ff;
              padding: 15px;
              border-radius: 4px;
              border-left: 4px solid #4f46e5;
              margin: 20px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎯 TaskerADHD</h1>
              <p>Your ADHD-friendly task management system</p>
            </div>

            <div class="focus-friendly">
              <h2>✨ Ready to focus?</h2>
              <p>Click the button below to access your TaskerADHD workspace. This link will expire in 15 minutes for your security.</p>
            </div>

            <div style="text-align: center;">
              <a href="${magicLink}" class="button">Access TaskerADHD 🚀</a>
            </div>

            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 4px; font-family: monospace;">
              ${magicLink}
            </p>

            <div class="footer">
              <p><strong>Security note:</strong> This magic link is single-use and expires in 15 minutes. If you didn't request this login, you can safely ignore this email.</p>
              <p><strong>ADHD-friendly features:</strong> TaskerADHD is designed with neurodivergent users in mind, featuring voice-to-task capture, focus modes, and energy-based task filtering.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        🎯 TaskerADHD Magic Link

        Ready to focus? Use this link to access your TaskerADHD workspace:
        ${magicLink}

        This link will expire in 15 minutes for your security.

        If you didn't request this login, you can safely ignore this email.

        TaskerADHD is designed with neurodivergent users in mind, featuring voice-to-task capture, focus modes, and energy-based task filtering.
      `
    };

    if (process.env.NODE_ENV === 'development') {
      console.log('📧 Magic link email would be sent:');
      console.log(`To: ${email}`);
      console.log(`Link: ${magicLink}`);
      return;
    }

    const info = await transporter.sendMail(mailOptions);
    console.log('📧 Magic link email sent:', info.messageId);
    
  } catch (error) {
    console.error('Email sending error:', error);
    throw new Error('Failed to send magic link email');
  }
}
