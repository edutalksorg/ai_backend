const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
    pool: true, // Use pooling to keep connections open
    maxConnections: 5,
    maxMessages: 100,
});

const sendVerificationEmail = async (email, fullName, token) => {
    try {
        const shortToken = token.substring(0, 8).toUpperCase();
        const timestamp = new Date().toLocaleTimeString();
        console.log(`[DEBUG] Attempting unique send for ${email} with ID: ${shortToken}`);

        const frontendUrl = process.env.FRONTEND_URL;
        const verifyUrl = `${frontendUrl}/verify-email?token=${token}&email=${encodeURIComponent(email)}`;

        const mailOptions = {
            from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
            to: email,
            subject: `Welcome to EduTalks! 🚀 - Confirmation Email`,
            text: `Hello ${fullName},\n\nWelcome to EduTalks! Please confirm your account by clicking the link below or copying it into your browser:\n\n${verifyUrl}\n\nYour security code is: ${shortToken}\n\nThis link expires in 24 hours.\n\nBest regards,\nThe EduTalks Team`,
            html: `
            <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; background-color: #f8fafc; border-radius: 16px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #1e40af; font-size: 28px; margin-bottom: 10px;">EduTalks</h1>
                </div>
                
                <div style="background-color: #ffffff; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                    <h2 style="color: #0f172a; font-size: 20px; margin-top: 0;">Hello ${fullName}! 👋</h2>
                    <p style="color: #334155; line-height: 1.6; font-size: 16px;">
                        Welcome to EduTalks! To complete your registration and start mastering your English pronunciation, please confirm your email address.
                    </p>
                    
                    <div style="text-align: center; margin: 40px 0;">
                        <a href="${verifyUrl}" 
                           style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); 
                                  color: white; 
                                  padding: 16px 32px; 
                                  text-decoration: none; 
                                  border-radius: 8px; 
                                  font-weight: bold; 
                                  display: inline-block;
                                  box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.2);">
                            Confirm My Email
                        </a>
                    </div>

                    <div style="background-color: #f1f5f9; padding: 20px; border-radius: 8px; text-align: center;">
                        <p style="color: #64748b; font-size: 14px; margin-bottom: 5px;">Your security code is:</p>
                        <span style="font-family: monospace; font-size: 24px; font-weight: bold; color: #1e40af; letter-spacing: 4px;">${shortToken}</span>
                    </div>

                    <p style="color: #94a3b8; font-size: 14px; margin-top: 30px; line-height: 1.6;">
                        If the button above doesn't work, copy and paste this link into your browser:<br>
                        <a href="${verifyUrl}" style="color: #3b82f6; word-break: break-all;">${verifyUrl}</a>
                    </p>
                </div>
                
                <div style="margin-top: 30px; text-align: center; color: #94a3b8; font-size: 12px;">
                    <p>&copy; 2026 EduTalks Team. All rights reserved.</p>
                    <p>This link will expire in 24 hours. If you did not request this email, please ignore it.</p>
                </div>
            </div>
            `
        };

        console.log('-----------------------------------------');
        console.log(`🚀 ATTEMPTING UNIQUE SEND: ${mailOptions.subject}`);

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ SUCCESS: Email accepted by Gmail');
        console.log(' - MsgID:', info.messageId);
        console.log(' - SMTP:', info.response);
        console.log('-----------------------------------------');

    } catch (error) {
        console.error('❌ FAILURE: Mail server error:', error);
        throw new Error(`Email could not be sent: ${error.message}`);
    }
};

const sendPromotionalEmail = async (email, fullName) => {
    try {
        const mailOptions = {
            from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
            to: email,
            subject: `✨ Unlock Your English Potential with EduTalks!`,
            html: `
            <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; background-color: #f8fafc; border-radius: 16px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #1e40af; font-size: 28px; margin-bottom: 10px;">EduTalks</h1>
                    <p style="color: #64748b; font-size: 16px;">Master your English pronunciation today</p>
                </div>
                
                <div style="background-color: #ffffff; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                    <h2 style="color: #0f172a; font-size: 20px; margin-top: 0;">Hello ${fullName}! 👋</h2>
                    <p style="color: #334155; line-height: 1.6; font-size: 16px;">
                        Are you ready to take your English speaking skills to the next level? 
                        EduTalks provides the most advanced AI-powered tools to help you speak with confidence.
                    </p>
                    
                    <div style="margin: 30px 0;">
                        <h3 style="color: #1e40af; font-size: 18px;">Why choose EduTalks?</h3>
                        <ul style="color: #334155; padding-left: 20px; line-height: 1.8;">
                            <li><strong>AI Feedback:</strong> Real-time analysis of your pronunciation.</li>
                            <li><strong>24/7 Practice:</strong> Practice anytime, anywhere with our AI instructors.</li>
                            <li><strong>Personalized Path:</strong> Quizzes and paragraphs tailored to your level.</li>
                        </ul>
                    </div>

                    <div style="text-align: center; margin-top: 40px;">
                        <a href="${process.env.FRONTEND_URL}" 
                           style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); 
                                  color: white; 
                                  padding: 16px 32px; 
                                  text-decoration: none; 
                                  border-radius: 8px; 
                                  font-weight: bold; 
                                  display: inline-block;
                                  box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.2);">
                            Start Practicing Now
                        </a>
                    </div>
                </div>
                
                <div style="margin-top: 30px; text-align: center; color: #94a3b8; font-size: 12px;">
                    <p>&copy; 2026 EduTalks Team. All rights reserved.</p>
                    <p>If you wish to unsubscribe from these promotional emails, please update your profile settings.</p>
                </div>
            </div>
            `,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Promotional email sent to ${email}. MessageId: ${info.messageId}`);
    } catch (error) {
        console.error(`❌ Error sending promotional email to ${email}:`, error.message);
    }
};

const sendRawEmail = async (email, subject, text) => {
    try {
        const mailOptions = {
            from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
            to: email,
            subject: subject,
            text: text,
        };
        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Raw email sent to ${email}. MessageId: ${info.messageId}`);
        return info;
    } catch (error) {
        console.error(`❌ Error sending raw email to ${email}:`, error.message);
        throw error;
    }
};

const sendPasswordResetEmail = async (email, fullName, resetUrl) => {
    try {
        const mailOptions = {
            from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
            to: email,
            subject: 'Reset Your Password - EduTalks',
            html: `
            <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; background-color: #f8fafc; border-radius: 16px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #1e40af; font-size: 28px; margin-bottom: 10px;">EduTalks</h1>
                    <p style="color: #64748b; font-size: 16px;">Password Reset Request</p>
                </div>
                
                <div style="background-color: #ffffff; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                    <h2 style="color: #0f172a; font-size: 20px; margin-top: 0;">Hello ${fullName}! 👋</h2>
                    <p style="color: #334155; line-height: 1.6; font-size: 16px;">
                        We received a request to reset the password for your EduTalks account. No changes have been made yet.
                    </p>
                    
                    <p style="color: #334155; line-height: 1.6; font-size: 16px;">
                        Click the button below to choose a new password. This link is valid for 10 minutes.
                    </p>
                    
                    <div style="text-align: center; margin: 40px 0;">
                        <a href="${resetUrl}" 
                           style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); 
                                  color: white; 
                                  padding: 16px 32px; 
                                  text-decoration: none; 
                                  border-radius: 8px; 
                                  font-weight: bold; 
                                  display: inline-block;
                                  box-shadow: 0 10px 15px -3px rgba(220, 38, 38, 0.2);">
                            Reset My Password
                        </a>
                    </div>
 
                    <p style="color: #94a3b8; font-size: 14px; margin-top: 30px; line-height: 1.6;">
                        If the button above doesn't work, copy and paste this link into your browser:<br>
                        <a href="${resetUrl}" style="color: #3b82f6; word-break: break-all;">${resetUrl}</a>
                    </p>
 
                    <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;">
                    
                    <p style="color: #64748b; font-size: 14px;">
                        If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.
                    </p>
                </div>
                
                <div style="margin-top: 30px; text-align: center; color: #94a3b8; font-size: 12px;">
                    <p>&copy; 2026 EduTalks Team. All rights reserved.</p>
                </div>
            </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Password reset email sent to ${email}. MessageId: ${info.messageId}`);
    } catch (error) {
        console.error(`❌ Error sending password reset email to ${email}:`, error.message);
        throw error;
    }
};

module.exports = {
    sendVerificationEmail,
    sendPromotionalEmail,
    sendRawEmail,
    sendPasswordResetEmail
};
