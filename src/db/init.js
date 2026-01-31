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

// Preserving settings table for Referral Settings
const createSettingsTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS settings (
      setting_key VARCHAR(255) PRIMARY KEY,
      setting_value TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `;
  await pool.query(query);
};

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
    await createSettingsTable(); // Ensure this is called

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

    try {
      const [cols] = await pool.query('SHOW COLUMNS FROM users');
      const colNames = cols.map(c => c.Field);

      if (!colNames.includes('isVerified')) {
        await pool.query("ALTER TABLE users ADD COLUMN isVerified BOOLEAN DEFAULT FALSE");
        console.log("✅ Added 'isVerified' column to users.");
      }
      if (!colNames.includes('verificationToken')) {
        await pool.query("ALTER TABLE users ADD COLUMN verificationToken VARCHAR(255)");
        console.log("✅ Added 'verificationToken' column to users.");
      }
      if (!colNames.includes('verificationTokenExpires')) {
        await pool.query("ALTER TABLE users ADD COLUMN verificationTokenExpires TIMESTAMP NULL");
        console.log("✅ Added 'verificationTokenExpires' column to users.");
      }
    } catch (e) {
      console.error("❌ Failed to sync verification columns:", e.message);
    }

    // Update topics table schema if needed
    try {
      const [cols] = await pool.query('SHOW COLUMNS FROM topics');
      const colNames = cols.map(c => c.Field);

      if (!colNames.includes('content')) await pool.query('ALTER TABLE topics ADD COLUMN content LONGTEXT');
      if (!colNames.includes('category')) await pool.query("ALTER TABLE topics ADD COLUMN category VARCHAR(100) DEFAULT 'General'");
      if (!colNames.includes('difficulty')) await pool.query("ALTER TABLE topics ADD COLUMN difficulty ENUM('Beginner', 'Intermediate', 'Advanced') DEFAULT 'Beginner'");
      if (!colNames.includes('estimatedTime')) await pool.query("ALTER TABLE topics ADD COLUMN estimatedTime INT DEFAULT 15");
      if (!colNames.includes('imageUrl')) await pool.query("ALTER TABLE topics ADD COLUMN imageUrl TEXT");
      if (!colNames.includes('vocabularyList')) await pool.query("ALTER TABLE topics ADD COLUMN vocabularyList JSON");
      if (!colNames.includes('discussionPoints')) await pool.query("ALTER TABLE topics ADD COLUMN discussionPoints JSON");

      console.log("✅ Topics table schema verified/updated.");
    } catch (e) {
      console.error("❌ Failed to update topics table schema:", e.message);
    }

    // Sync Quizzes Table Schema
    try {
      const [cols] = await pool.query('SHOW COLUMNS FROM quizzes');
      const colNames = cols.map(c => c.Field);

      if (!colNames.includes('instructorId')) await pool.query('ALTER TABLE quizzes ADD COLUMN instructorId INT NOT NULL');
      if (!colNames.includes('description')) await pool.query('ALTER TABLE quizzes ADD COLUMN description TEXT');
      if (!colNames.includes('duration')) await pool.query('ALTER TABLE quizzes ADD COLUMN duration INT DEFAULT 30');
      if (!colNames.includes('passingScore')) await pool.query('ALTER TABLE quizzes ADD COLUMN passingScore INT DEFAULT 60');
      if (!colNames.includes('difficulty')) await pool.query("ALTER TABLE quizzes ADD COLUMN difficulty ENUM('Beginner', 'Intermediate', 'Advanced') DEFAULT 'Beginner'");
      if (!colNames.includes('categoryId')) await pool.query('ALTER TABLE quizzes ADD COLUMN categoryId VARCHAR(100)');
      if (!colNames.includes('isPublished')) await pool.query('ALTER TABLE quizzes ADD COLUMN isPublished BOOLEAN DEFAULT FALSE');
      if (!colNames.includes('isDeleted')) await pool.query('ALTER TABLE quizzes ADD COLUMN isDeleted BOOLEAN DEFAULT FALSE');
      if (!colNames.includes('timeLimitMinutes')) await pool.query('ALTER TABLE quizzes ADD COLUMN timeLimitMinutes INT DEFAULT 20');
      if (!colNames.includes('maxAttempts')) await pool.query('ALTER TABLE quizzes ADD COLUMN maxAttempts INT DEFAULT 2');
      if (!colNames.includes('randomizeQuestions')) await pool.query('ALTER TABLE quizzes ADD COLUMN randomizeQuestions BOOLEAN DEFAULT TRUE');
      if (!colNames.includes('showCorrectAnswers')) await pool.query('ALTER TABLE quizzes ADD COLUMN showCorrectAnswers BOOLEAN DEFAULT TRUE');

      // Ensure topicId is nullable for standalone quizzes
      await pool.query('ALTER TABLE quizzes MODIFY COLUMN topicId INT NULL');

      // Update foreign key if it exists (dropping and recreating is safest in a sync script if we want to change ON DELETE)
      try {
        // Find the FK name for topicId if it exists
        const [fks] = await pool.query(`
              SELECT CONSTRAINT_NAME 
              FROM information_schema.KEY_COLUMN_USAGE 
              WHERE TABLE_NAME = 'quizzes' 
                AND COLUMN_NAME = 'topicId' 
                AND REFERENCED_TABLE_NAME = 'topics'
                AND TABLE_SCHEMA = DATABASE()
          `);

        if (fks.length > 0) {
          const fkName = fks[0].CONSTRAINT_NAME;
          await pool.query(`ALTER TABLE quizzes DROP FOREIGN KEY ${fkName}`);
          await pool.query('ALTER TABLE quizzes ADD CONSTRAINT fk_quizzes_topics FOREIGN KEY (topicId) REFERENCES topics(id) ON DELETE SET NULL');
        }
      } catch (fkError) {
        console.warn("⚠️ Could not update quizzes foreign key:", fkError.message);
      }

      console.log("✅ Quizzes table schema verified/updated.");
    } catch (e) {
      console.error("❌ Failed to update quizzes table schema:", e.message);
    }

    // Sync Pronunciation Paragraphs Table Schema
    try {
      const [cols] = await pool.query('SHOW COLUMNS FROM pronunciation_paragraphs');
      const colNames = cols.map(c => c.Field);

      if (!colNames.includes('language')) await pool.query("ALTER TABLE pronunciation_paragraphs ADD COLUMN language VARCHAR(50) DEFAULT 'en-US'");
      if (!colNames.includes('phoneticTranscription')) await pool.query("ALTER TABLE pronunciation_paragraphs ADD COLUMN phoneticTranscription TEXT");
      if (!colNames.includes('referenceAudioUrl')) await pool.query("ALTER TABLE pronunciation_paragraphs ADD COLUMN referenceAudioUrl TEXT");

      console.log("✅ Pronunciation Paragraphs table schema verified/updated.");
    } catch (e) {
      console.error("❌ Failed to update pronunciation paragraphs table schema:", e.message);
    }

    // Sync Call History Table Schema
    try {
      const [cols] = await pool.query('SHOW COLUMNS FROM call_history');
      const colNames = cols.map(c => c.Field);

      if (!colNames.includes('rating')) {
        await pool.query('ALTER TABLE call_history ADD COLUMN rating INT DEFAULT NULL');
        console.log("✅ Added 'rating' column to call_history.");
      }

      console.log("✅ Call history table schema verified/updated.");
    } catch (e) {
      console.error("❌ Failed to update call_history table schema:", e.message);
    }

    // Sync Instructor Profiles Table Schema
    try {
      const [cols] = await pool.query('SHOW COLUMNS FROM instructor_profiles');
      const colNames = cols.map(c => c.Field);

      if (!colNames.includes('country')) {
        await pool.query('ALTER TABLE instructor_profiles ADD COLUMN country VARCHAR(100)');
        console.log("✅ Added 'country' column to instructor_profiles.");
      }

      console.log("✅ Instructor profiles table schema verified/updated.");
    } catch (e) {
      console.error("❌ Failed to update instructor_profiles table schema:", e.message);
    }

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

    // Sync Plans Table Schema
    try {
      console.log('🔄 Syncing plans table schema...');
      const [cols] = await pool.query('SHOW COLUMNS FROM plans');
      const colNames = cols.map(c => c.Field);

      if (!colNames.includes('displayOrder')) {
        await pool.query("ALTER TABLE plans ADD COLUMN displayOrder INT DEFAULT 0");
        console.log("✅ Added 'displayOrder' column to plans.");
      }
      if (!colNames.includes('trialDays')) {
        await pool.query("ALTER TABLE plans ADD COLUMN trialDays INT DEFAULT 0");
        console.log("✅ Added 'trialDays' column to plans.");
      }
      if (!colNames.includes('isMostPopular')) {
        await pool.query("ALTER TABLE plans ADD COLUMN isMostPopular BOOLEAN DEFAULT FALSE");
        console.log("✅ Added 'isMostPopular' column to plans.");
      }
      if (!colNames.includes('marketingTagline')) {
        await pool.query("ALTER TABLE plans ADD COLUMN marketingTagline VARCHAR(255)");
        console.log("✅ Added 'marketingTagline' column to plans.");
      }
      if (!colNames.includes('features')) {
        await pool.query("ALTER TABLE plans ADD COLUMN features JSON");
        console.log("✅ Added 'features' column to plans.");
      }

      // Update billingCycle ENUM to include 'Free'
      await pool.query("ALTER TABLE plans MODIFY COLUMN billingCycle ENUM('Monthly', 'Yearly', 'Quarterly', 'Free') NOT NULL");
      console.log("✅ Updated billingCycle ENUM to include 'Free'.");

    } catch (e) {
      console.error("❌ Failed to update plans table schema:", e.message);
    }

    // Seed Default Plans
    try {
      const defaultPlans = [
        ['Free Trial', '24-hour full access trial', 0, 'Free', 1, 0, false],
        ['Monthly', 'Full monthly access', 0, 'Monthly', 0, 1, false],
        ['Quarterly', 'Full quarterly access', 0, 'Quarterly', 0, 2, false],
        ['Yearly', 'Full yearly access', 0, 'Yearly', 0, 3, true]
      ];

      for (const [name, desc, price, cycle, trial, order, popular] of defaultPlans) {
        const [exists] = await pool.query('SELECT * FROM plans WHERE name = ?', [name]);
        if (exists.length === 0) {
          await pool.query(
            'INSERT INTO plans (name, description, price, billingCycle, trialDays, displayOrder, isMostPopular, isActive) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [name, desc, price, cycle, trial, order, popular, true]
          );
          console.log(`✅ Seeded plan: ${name}`);
        }
      }
    } catch (e) {
      console.error("❌ Failed to seed default plans:", e.message);
    }

    // Sync Subscriptions Table Schema
    try {
      const [cols] = await pool.query('SHOW COLUMNS FROM subscriptions');
      const colNames = cols.map(c => c.Field);

      if (!colNames.includes('paymentStatus')) {
        await pool.query("ALTER TABLE subscriptions ADD COLUMN paymentStatus ENUM('paid', 'pending', 'failed', 'refunded', 'free', 'completed') DEFAULT 'pending'");
        console.log("✅ Added 'paymentStatus' column to subscriptions.");
      } else {
        await pool.query("ALTER TABLE subscriptions MODIFY COLUMN paymentStatus ENUM('paid', 'pending', 'failed', 'refunded', 'free', 'completed') DEFAULT 'pending'");
        console.log("✅ Updated 'paymentStatus' ENUM on subscriptions.");
      }
      if (!colNames.includes('createdAt')) {
        await pool.query("ALTER TABLE subscriptions ADD COLUMN createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
        console.log("✅ Added 'createdAt' column to subscriptions.");
      }
      if (!colNames.includes('updatedAt')) {
        await pool.query("ALTER TABLE subscriptions ADD COLUMN updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
        console.log("✅ Added 'updatedAt' column to subscriptions.");
      }
    } catch (e) {
      console.error("❌ Failed to update subscriptions table schema:", e.message);
    }

    // Sync Transactions Table Schema
    try {
      const [cols] = await pool.query('SHOW COLUMNS FROM transactions');
      const colNames = cols.map(c => c.Field);

      if (!colNames.includes('updatedAt')) {
        await pool.query("ALTER TABLE transactions ADD COLUMN updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
        console.log("✅ Added 'updatedAt' column to transactions.");
      }
      await pool.query("ALTER TABLE transactions MODIFY COLUMN status ENUM('pending', 'initiated', 'completed', 'failed', 'refunded') DEFAULT 'pending'");
      console.log("✅ Updated 'status' ENUM on transactions.");

      // ADDED: Update transactions schema for referrals
      const [tCols] = await pool.query('SHOW COLUMNS FROM transactions');
      const tColNames = tCols.map(c => c.Field);
      if (!tColNames.includes('description')) {
        await pool.query('ALTER TABLE transactions ADD COLUMN description TEXT AFTER status');
        console.log("✅ Added 'description' column to transactions.");
      }
      if (!tColNames.includes('metadata')) {
        await pool.query('ALTER TABLE transactions ADD COLUMN metadata JSON AFTER description');
        console.log("✅ Added 'metadata' column to transactions.");
      }
      if (!tColNames.includes('fee')) {
        await pool.query('ALTER TABLE transactions ADD COLUMN fee DECIMAL(10, 2) DEFAULT 0 AFTER amount');
        console.log("✅ Added 'fee' column to transactions.");
      }
      await pool.query("ALTER TABLE transactions MODIFY COLUMN type ENUM('payment', 'withdrawal', 'refund', 'wallet_add', 'credit') NOT NULL");
      console.log("✅ Updated 'type' ENUM on transactions.");
    } catch (e) {
      console.error("❌ Failed to update transactions table schema:", e.message);
    }

    // Sync Call History Table Schema
    try {
      await pool.query("ALTER TABLE call_history MODIFY COLUMN status ENUM('initiated', 'ringing', 'accepted', 'rejected', 'completed', 'missed', 'declined', 'failed', 'busy') DEFAULT 'ringing'");
      console.log("✅ Updated call_history status ENUM to include 'initiated', 'accepted', and 'rejected'.");
    } catch (e) {
      console.error("❌ Failed to update call_history table schema:", e.message);
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
