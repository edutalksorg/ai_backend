const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = require('../config/db');
const createUserTable = require('../models/userModel');
const createInstructorProfileTable = require('../models/instructorProfileModel');
const createPlanTable = require('../models/planModel');
const createSubscriptionTable = require('../models/subscriptionModel');
const createTransactionTable = require('../models/transactionModel');
const createTopicTable = require('../models/topicModel');
const createQuizTable = require('../models/quizModel');
const createPermissionTable = require('../models/permissionModel');
const createRolePermissionTable = require('../models/rolePermissionModel');
const createUserPermissionTable = require('../models/userPermissionModel');
const createCouponTable = require('../models/couponModel');
const createCallHistoryTable = require('../models/callHistoryModel');
const createReferralTable = require('../models/referralModel');
const createUserProgressTable = require('../models/userProgressModel');
const createPronunciationTable = require('../models/pronunciationModel');
const createQuizAttemptTable = require('../models/quizAttemptModel');

const initDb = async () => {
  try {
    console.log(`🚀 Checking database existence...`);
    console.log(`DEBUG: DB_HOST=${process.env.DB_HOST}, DB_USER=${process.env.DB_USER}, DB_NAME=${process.env.DB_NAME}`);
    console.log(`DEBUG: DB_PASSWORD length=${process.env.DB_PASSWORD ? process.env.DB_PASSWORD.length : 'undefined'}`);

    const tempConnection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD, // Remove fallback to empty string to test strictness

    });

    await tempConnection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || 'ai_pronunciation_db'}\``);
    await tempConnection.end();

    console.log(`✅ Database ready.`);

    // Initialize tables in order
    await createPermissionTable();
    await createUserTable();
    await createInstructorProfileTable();
    await createPlanTable();
    await createSubscriptionTable();
    await createTransactionTable();
    await createTopicTable();
    await createQuizTable();
    await createRolePermissionTable();
    await createUserPermissionTable();
    await createCouponTable();
    await createCallHistoryTable();
    await createReferralTable();
    await createUserProgressTable();
    await createPronunciationTable();
    await createQuizAttemptTable();

    console.log('✅ All tables initialized.');

    // ---------------------------------------------------------
    // SCHEMA UPDATES (Ensure new columns exist)
    // ---------------------------------------------------------
    try {
      const [cols] = await pool.query('SHOW COLUMNS FROM users LIKE "status"');
      if (cols.length === 0) {
        await pool.query("ALTER TABLE users ADD COLUMN status ENUM('Online', 'Offline', 'Busy') DEFAULT 'Offline'");
        console.log("✅ Added 'status' column to users.");
      }
    } catch (e) { console.log("Note: Status column check skipped or failed."); }

    try {
      const [cols] = await pool.query('SHOW COLUMNS FROM users LIKE "lastActiveAt"');
      if (cols.length === 0) {
        await pool.query("ALTER TABLE users ADD COLUMN lastActiveAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
        console.log("✅ Added 'lastActiveAt' column to users.");
      }
    } catch (e) { }

    try {
      const [cols] = await pool.query('SHOW COLUMNS FROM users LIKE "referralCode"');
      if (cols.length === 0) {
        await pool.query("ALTER TABLE users ADD COLUMN referralCode VARCHAR(50) UNIQUE");
        console.log("✅ Added 'referralCode' column to users.");
      }
    } catch (e) { }

    try {
      const [cols] = await pool.query('SHOW COLUMNS FROM users LIKE "resetPasswordToken"');
      if (cols.length === 0) {
        await pool.query("ALTER TABLE users ADD COLUMN resetPasswordToken VARCHAR(255)");
        await pool.query("ALTER TABLE users ADD COLUMN resetPasswordExpire DATETIME");
        console.log("✅ Added password reset columns to users.");
      }
    } catch (e) { }

    // Seed or Update Super Admin
    const [existingAdmin] = await pool.query('SELECT * FROM users WHERE role = "SuperAdmin"');
    const superAdminEmail = process.env.DEFAULT_SUPERADMIN_EMAIL || 'superadmin@edutalks.com';
    const superAdminPassword = process.env.DEFAULT_SUPERADMIN_PASSWORD || 'Superadmin@123';
    const hashedPassword = await bcrypt.hash(superAdminPassword, 10);

    if (existingAdmin.length === 0) {
      await pool.query(
        'INSERT INTO users (fullName, email, password, role, isApproved) VALUES (?, ?, ?, ?, ?)',
        ['Super Admin', superAdminEmail, hashedPassword, 'SuperAdmin', true]
      );
      console.log('✅ Default Super Admin seeded.');
    } else {
      await pool.query(
        'UPDATE users SET password = ? WHERE role = "SuperAdmin"',
        [hashedPassword]
      );
      console.log('✅ Super Admin password synced with environment.');
    }


    // Seed Permissions
    const allPermissions = [
      ['Topics.View', 'View Topics', 'TopicManagement', 'View'],
      ['Content.ViewTopics', 'View Topics', 'ContentAccess', 'View'],
      ['Payments.Withdrawals.Manage', 'Manage Withdrawals', 'PaymentManagement', 'Manage'],
      ['VoiceCall.UseTrial', 'Use Voice Call (Trial)', 'VoiceCall', 'Manage'],
      ['Referrals.UpdateSettings', 'Update Referral Settings', 'ReferralManagement', 'Update'],
      ['Coupons.Manage', 'Manage Coupons', 'CouponManagement', 'Manage'],
      ['Quizzes.Unpublish', 'Unpublish Quizzes', 'QuizManagement', 'Update'],
      ['ContentAnalysis.ViewPronunciationStats', 'View Pronunciation Statistics', 'ContentAnalysis', 'View'],
      ['Payments.Refunds.Create', 'Create Refunds', 'PaymentManagement', 'Create'],
      ['Quizzes.ViewOwn', 'View Own Quizzes', 'QuizManagement', 'View'],
      ['Referrals.Update', 'Update Referrals', 'ReferralManagement', 'Update'],
      ['Audit.ViewAll', 'View All Audit Logs', 'AuditManagement', 'View'],
      ['Content.ViewQuizzes', 'View Quizzes', 'ContentAccess', 'View'],
      ['Payments.Refunds.Reject', 'Reject Refunds', 'PaymentManagement', 'Reject'],
      ['Instructors.ViewPending', 'View Pending Applications', 'InstructorApproval', 'View'],
      ['Paragraphs.Update', 'Update Paragraphs', 'ParagraphManagement', 'Update'],
      ['Admins.View', 'View Admins', 'AdminManagement', 'View'],
      ['Quizzes.View', 'View Quizzes', 'QuizManagement', 'View'],
      ['Reports.ViewRevenue', 'View Revenue Reports', 'ReportManagement', 'View'],
      ['Subscriptions.View', 'View Subscriptions', 'SubscriptionManagement', 'View'],
      ['Audit.ViewOwn', 'View Own Audit Logs', 'AuditManagement', 'View'],
      ['Notifications.Send', 'Send Notifications', 'NotificationManagement', 'Create'],
      ['Payments.Refunds.View', 'View Refunds', 'PaymentManagement', 'View'],
      ['Wallet.View', 'View Wallet', 'WalletManagement', 'View'],
      ['Profile.ViewSubscription', 'View Subscription', 'ProfileManagement', 'View'],
      ['Paragraphs.Manage', 'Manage Paragraphs', 'ParagraphManagement', 'Manage'],
      ['Profile.View', 'View Profile', 'ProfileManagement', 'View'],
      ['Wallet.RequestWithdrawal', 'Request Withdrawal', 'WalletManagement', 'Create'],
      ['Content.TakeQuiz', 'Take Quiz', 'ContentAccess', 'Manage'],
      ['Paragraphs.View', 'View Paragraphs', 'ParagraphManagement', 'View'],
      ['Payments.Transactions.View', 'View Transactions', 'PaymentManagement', 'View'],
      ['Topics.ViewOwn', 'View Own Topics', 'TopicManagement', 'View'],
      ['Coupons.ViewUsage', 'View Coupon Usage', 'CouponManagement', 'View'],
      ['Coupons.Activate', 'Activate Coupons', 'CouponManagement', 'Update'],
      ['Referrals.Manage', 'Manage Referrals', 'ReferralManagement', 'Manage'],
      ['Coupons.View', 'View Coupons', 'CouponManagement', 'View'],
      ['Profile.ViewActivity', 'View Activity', 'ProfileManagement', 'View'],
      ['Payments.Withdrawals.View', 'View Withdrawals', 'PaymentManagement', 'View'],
      ['Paragraphs.ViewOwn', 'View Own Paragraphs', 'ParagraphManagement', 'View'],
      ['Quizzes.Manage', 'Manage Quizzes', 'QuizManagement', 'Manage'],
      ['System.ManagePermissions', 'Manage Permissions', 'SystemManagement', 'Manage'],
      ['Instructors.Manage', 'Manage Instructors', 'InstructorApproval', 'Manage'],
      ['Reports.View', 'View Reports', 'ReportManagement', 'View'],
      ['Payments.Withdrawals.Reject', 'Reject Withdrawals', 'PaymentManagement', 'Reject'],
      ['Payments.Transactions.Manage', 'Manage Transactions', 'PaymentManagement', 'Manage'],
      ['VoiceCall.UseUnlimited', 'Unlimited Voice Call', 'VoiceCall', 'Manage'],
      ['Payments.Refunds.Process', 'Process Refunds', 'PaymentManagement', 'Manage'],
      ['Topics.Publish', 'Publish Topics', 'TopicManagement', 'Update'],
      ['Admins.Update', 'Update Admins', 'AdminManagement', 'Update'],
      ['Subscriptions.Update', 'Update Subscriptions', 'SubscriptionManagement', 'Update'],
      ['Platform.Access', 'Platform Access', 'PlatformAccess', 'View'],
      ['ContentAnalysis.ViewTopicsOverview', 'View Topics Overview', 'ContentAnalysis', 'View'],
      ['Admins.Manage', 'Manage Admins', 'AdminManagement', 'Manage'],
      ['Users.Create', 'Create Users', 'UserManagement', 'Create'],
      ['Paragraphs.Unpublish', 'Unpublish Paragraphs', 'ParagraphManagement', 'Update'],
      ['Coupons.Create', 'Create Coupons', 'CouponManagement', 'Create'],
      ['Subscriptions.Delete', 'Delete Subscriptions', 'SubscriptionManagement', 'Delete'],
      ['Paragraphs.Delete', 'Delete Paragraphs', 'ParagraphManagement', 'Delete'],
      ['Coupons.Deactivate', 'Deactivate Coupons', 'CouponManagement', 'Update'],
      ['Payments.Transactions.Export', 'Export Transactions', 'PaymentManagement', 'Export'],
      ['Topics.Update', 'Update Topics', 'TopicManagement', 'Update'],
      ['Reports.ViewInstructorPerformance', 'View Instructor Performance', 'ReportManagement', 'View'],
      ['Payments.Refunds.Manage', 'Manage Refunds', 'PaymentManagement', 'Manage'],
      ['Admins.Create', 'Create Admins', 'AdminManagement', 'Create'],
      ['ContentAnalysis.ViewVoiceCallStats', 'View Voice Call Statistics', 'ContentAnalysis', 'View'],
      ['Subscriptions.ViewUserSubscriptions', 'View User Subscriptions', 'SubscriptionManagement', 'View'],
      ['Quizzes.Delete', 'Delete Quizzes', 'QuizManagement', 'Delete'],
      ['ContentAnalysis.Export', 'Export Content Analytics', 'ContentAnalysis', 'Export'],
      ['Profile.UploadAvatar', 'Upload Avatar', 'ProfileManagement', 'Update'],
      ['Instructor.ViewOwnStats', 'View Own Statistics', 'ContentManagement', 'View'],
      ['System.Settings', 'Manage System Settings', 'SystemManagement', 'Manage'],
      ['Payments.View', 'View Payments', 'PaymentManagement', 'View'],
      ['System.ManageRoles', 'Manage Roles', 'SystemManagement', 'Manage'],
      ['Platform.AccessPremium', 'Premium Platform Access', 'PlatformAccess', 'View'],
      ['Admins.AssignPermissions', 'Assign Admin Permissions', 'AdminManagement', 'Manage'],
      ['Payments.Withdrawals.Complete', 'Complete Withdrawals', 'PaymentManagement', 'Manage'],
      ['Subscriptions.ManageFeatures', 'Manage Subscription Features', 'SubscriptionManagement', 'Manage'],
      ['Instructors.View', 'View Instructors', 'InstructorApproval', 'View'],
      ['Instructor.ExportReports', 'Export Reports', 'ContentManagement', 'Export'],
      ['Profile.Update', 'Update Profile', 'ProfileManagement', 'Update'],
      ['Quizzes.Create', 'Create Quizzes', 'QuizManagement', 'Create'],
      ['Payments.Transactions.ViewDetails', 'View Transaction Details', 'PaymentManagement', 'View'],
      ['Paragraphs.Create', 'Create Paragraphs', 'ParagraphManagement', 'Create'],
      ['Wallet.ViewTransactions', 'View Wallet Transactions', 'WalletManagement', 'View'],
      ['ContentAnalysis.View', 'View Content Analysis', 'ContentAnalysis', 'View'],
      ['Payments.Withdrawals.Approve', 'Approve Withdrawals', 'PaymentManagement', 'Approve'],
      ['Payments.WalletAdjustments.Create', 'Create Wallet Adjustments', 'PaymentManagement', 'Create'],
      ['Notifications.SendBulk', 'Send Bulk Notifications', 'NotificationManagement', 'Create'],
      ['Payments.WalletAdjustments.View', 'View Wallet Adjustments', 'PaymentManagement', 'View'],
      ['Payments.WalletAdjustments.Manage', 'Manage Wallet Adjustments', 'PaymentManagement', 'Manage'],
      ['Referrals.View', 'View Referrals', 'ReferralManagement', 'View'],
      ['Topics.Manage', 'Manage Topics', 'TopicManagement', 'Manage'],
      ['Users.Update', 'Update Users', 'UserManagement', 'Update'],
      ['Content.View', 'View Content', 'ContentAccess', 'View'],
      ['Users.Manage', 'Manage Users', 'UserManagement', 'Manage'],
      ['Instructors.Reject', 'Reject Instructors', 'InstructorApproval', 'Reject'],
      ['System.ViewLogs', 'View System Logs', 'SystemManagement', 'View'],
      ['Content.ViewParagraphs', 'View Paragraphs', 'ContentAccess', 'View'],
      ['Instructor.ManageContent', 'Manage Content', 'ContentManagement', 'Manage'],
      ['Referrals.ViewStats', 'View Referral Statistics', 'ReferralManagement', 'View'],
      ['Users.Lock', 'Lock Users', 'UserManagement', 'Update'],
      ['Payments.Refunds.Approve', 'Approve Refunds', 'PaymentManagement', 'Approve'],
      ['Instructor.ViewStudents', 'View Students', 'ContentManagement', 'View'],
      ['Platform.AccessBasic', 'Basic Platform Access', 'PlatformAccess', 'View'],
      ['Users.Unlock', 'Unlock Users', 'UserManagement', 'Update'],
      ['Reports.ViewUserActivity', 'View User Activity Reports', 'ReportManagement', 'View'],
      ['Reports.Export', 'Export Reports', 'ReportManagement', 'Export'],
      ['ContentAnalysis.ViewQuizzesOverview', 'View Quizzes Overview', 'ContentAnalysis', 'View'],
      ['Instructors.Approve', 'Approve Instructors', 'InstructorApproval', 'Approve'],
      ['Subscriptions.Manage', 'Manage Subscriptions', 'SubscriptionManagement', 'Manage'],
      ['Admins.Delete', 'Delete Admins', 'AdminManagement', 'Delete'],
      ['Notifications.View', 'View Notifications', 'NotificationManagement', 'View'],
      ['Audit.View', 'View Audit Logs', 'AuditManagement', 'View'],
      ['Users.View', 'View Users', 'UserManagement', 'View'],
      ['Instructors.ViewStats', 'View Instructor Statistics', 'InstructorApproval', 'View'],
      ['Referrals.Create', 'Create Referrals', 'ReferralManagement', 'Create'],
      ['VoiceCall.Use', 'Use Voice Call', 'VoiceCall', 'Manage'],
      ['Users.Delete', 'Delete Users', 'UserManagement', 'Delete'],
      ['Topics.Unpublish', 'Unpublish Topics', 'TopicManagement', 'Update'],
      ['Profile.Manage', 'Manage Profile', 'ProfileManagement', 'Manage'],
      ['Audit.Export', 'Export Audit Logs', 'AuditManagement', 'Export'],
      ['Quizzes.Update', 'Update Quizzes', 'QuizManagement', 'Update'],
      ['Coupons.Update', 'Update Coupons', 'CouponManagement', 'Update'],
      ['Coupons.Delete', 'Delete Coupons', 'CouponManagement', 'Delete'],
      ['Payments.ViewAll', 'View All Payments', 'PaymentManagement', 'View'],
      ['Quizzes.Publish', 'Publish Quizzes', 'QuizManagement', 'Update'],
      ['Topics.Delete', 'Delete Topics', 'TopicManagement', 'Delete'],
      ['Subscriptions.Create', 'Create Subscriptions', 'SubscriptionManagement', 'Create'],
      ['Topics.Create', 'Create Topics', 'TopicManagement', 'Create'],
      ['Paragraphs.Publish', 'Publish Paragraphs', 'ParagraphManagement', 'Update'],
      ['Notifications.Manage', 'Manage Notifications', 'NotificationManagement', 'Manage'],
      ['Wallet.ViewBalance', 'View Wallet Balance', 'WalletManagement', 'View']
    ];

    console.log(`ℹ️  Syncing ${allPermissions.length} permissions...`);

    // Using INSERT IGNORE to ensure we add missing ones without failing on duplicates
    // Note: 'name' column in permissions has UNIQUE constraint
    await pool.query('INSERT IGNORE INTO permissions (name, displayName, module, action) VALUES ?', [allPermissions]);
    console.log('✅ Permissions synced (duplicates ignored).');

  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
};

module.exports = initDb;
