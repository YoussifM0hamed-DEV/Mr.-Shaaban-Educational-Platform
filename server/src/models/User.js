const crypto = require('crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES, ACCOUNT_STATUS, PERMISSION_LIST } = require('../config/constants');

const SALT_ROUNDS = 12;

const hashResetToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

/**
 * Single user collection for the three roles of this platform.
 * The platform belongs to exactly one teacher, so there is no tenant/teacher reference.
 */
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true, maxlength: 120 },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: { type: String, required: true, select: false, minlength: 8 },
    phone: { type: String, trim: true, maxlength: 30 },

    role: {
      type: String,
      enum: Object.values(ROLES),
      required: true,
      default: ROLES.STUDENT,
      index: true,
    },

    status: {
      type: String,
      enum: Object.values(ACCOUNT_STATUS),
      default: ACCOUNT_STATUS.PENDING,
      index: true,
    },

    avatarUrl: { type: String, default: '' },

    // ---- Assistant only ----
    permissions: {
      type: [{ type: String, enum: PERMISSION_LIST }],
      default: [],
    },

    // ---- Student only ----
    studentInfo: {
      grade: { type: String, trim: true, maxlength: 60 },
      school: { type: String, trim: true, maxlength: 120 },
      parentPhone: { type: String, trim: true, maxlength: 30 },
      notes: { type: String, trim: true, maxlength: 500 },
    },

    // ---- Moderation ----
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    rejectionReason: { type: String, trim: true, maxlength: 300 },

    // ---- Password reset ----
    // Only the SHA-256 hash of the token is stored, so a database leak cannot be
    // replayed as a reset link. Never selected by default.
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    passwordChangedAt: { type: Date },

    // ---- Engagement signals ----
    lastLoginAt: { type: Date },
    lastActivityAt: { type: Date, index: true },

    isDeleted: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

userSchema.index({ role: 1, status: 1, createdAt: -1 });
userSchema.index({ name: 'text', email: 'text' });

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
  if (!this.isNew) this.passwordChangedAt = new Date();
  next();
});

/**
 * Issues a single-use reset token.
 * The plain token is returned to be emailed and is never stored anywhere.
 */
userSchema.methods.createPasswordResetToken = function createPasswordResetToken(ttlMinutes = 60) {
  const token = crypto.randomBytes(32).toString('hex');
  this.passwordResetTokenHash = hashResetToken(token);
  this.passwordResetExpires = new Date(Date.now() + ttlMinutes * 60 * 1000);
  return token;
};

userSchema.methods.clearPasswordResetToken = function clearPasswordResetToken() {
  this.passwordResetTokenHash = undefined;
  this.passwordResetExpires = undefined;
};

/** Finds the account a valid, unexpired reset token belongs to. */
userSchema.statics.findByPasswordResetToken = function findByPasswordResetToken(token) {
  if (typeof token !== 'string' || token.length !== 64) return null;
  return this.findOne({
    passwordResetTokenHash: hashResetToken(token),
    passwordResetExpires: { $gt: new Date() },
    isDeleted: false,
  }).select('+password +passwordResetTokenHash +passwordResetExpires');
};

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.hasPermission = function hasPermission(permission) {
  if (this.role === ROLES.TEACHER) return true;
  if (this.role !== ROLES.ASSISTANT) return false;
  return this.permissions.includes(permission);
};

userSchema.virtual('isActiveAccount').get(function isActiveAccount() {
  if (this.isDeleted) return false;
  if (this.role === ROLES.TEACHER) return true;
  if (this.role === ROLES.ASSISTANT) return this.status === ACCOUNT_STATUS.APPROVED;
  return this.status === ACCOUNT_STATUS.APPROVED;
});

module.exports = mongoose.model('User', userSchema);
