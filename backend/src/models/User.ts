import bcrypt from 'bcryptjs';
import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';
import { UserRole } from '../types/domain';
import { omitInternal } from './serialization';

const SALT_ROUNDS = 12;

/**
 * Client-specific fields live as an embedded sub-document rather than a
 * separate `ClientProfile` collection: it is a strict 1:1 relationship that is
 * always loaded together with the user, so embedding removes a join on the
 * hottest read path (appointment lists) with no downside.
 */
export interface ClientProfile {
  /** Internal notes written by the lounge. Never exposed to the client. */
  notes?: string;
  preferredServices: Types.ObjectId[];
  marketingOptIn: boolean;
}

export interface UserAttrs {
  fullName: string;
  email: string;
  phone?: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  clientProfile: ClientProfile;
  tokenVersion: number;
  lastLoginAt?: Date;
  passwordResetTokenHash?: string;
  passwordResetExpiresAt?: Date;
}

export interface UserDocument extends HydratedDocument<UserAttrs> {
  comparePassword(candidate: string): Promise<boolean>;
}

interface UserModel extends Model<UserAttrs, {}, { comparePassword(c: string): Promise<boolean> }> {
  hashPassword(plain: string): Promise<string>;
}

const clientProfileSchema = new Schema<ClientProfile>(
  {
    notes: { type: String, trim: true, maxlength: 2000 },
    preferredServices: [{ type: Schema.Types.ObjectId, ref: 'Service' }],
    marketingOptIn: { type: Boolean, default: false },
  },
  { _id: false },
);

const userSchema = new Schema<UserAttrs, UserModel>(
  {
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: { type: String, trim: true, maxlength: 32 },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.CLIENT,
      required: true,
      index: true,
    },
    isActive: { type: Boolean, default: true, index: true },
    clientProfile: { type: clientProfileSchema, default: () => ({}) },
    /**
     * Bumped on logout-everywhere and password change; refresh tokens carrying
     * an older version are rejected.
     */
    tokenVersion: { type: Number, default: 0 },
    lastLoginAt: { type: Date },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpiresAt: { type: Date, select: false },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) =>
        omitInternal(ret, ['passwordHash', 'passwordResetTokenHash', 'passwordResetExpiresAt']),
    },
  },
);

// Supports the admin client search (name / email / phone).
userSchema.index({ fullName: 'text', email: 'text', phone: 'text' });

userSchema.method('comparePassword', function comparePassword(candidate: string) {
  return bcrypt.compare(candidate, this.passwordHash);
});

userSchema.static('hashPassword', function hashPassword(plain: string) {
  return bcrypt.hash(plain, SALT_ROUNDS);
});

export const User = model<UserAttrs, UserModel>('User', userSchema);
