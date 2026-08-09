import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { NotificationChannel, NotificationType } from '../types/domain';
import { omitInternal } from './serialization';

/**
 * In-app notifications today. `channels` and `deliveries` exist so email / SMS
 * / WhatsApp / push can be layered on later by adding a transport that reads
 * pending rows — no schema change and no external provider wired in now.
 */
export interface NotificationDelivery {
  channel: NotificationChannel;
  status: 'PENDING' | 'SENT' | 'FAILED';
  sentAt?: Date;
  error?: string;
}

export interface NotificationAttrs {
  recipient: Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  appointment?: Types.ObjectId;
  readAt?: Date;
  channels: NotificationChannel[];
  deliveries: NotificationDelivery[];
}

export type NotificationDocument = HydratedDocument<NotificationAttrs>;

const deliverySchema = new Schema<NotificationDelivery>(
  {
    channel: { type: String, enum: Object.values(NotificationChannel), required: true },
    status: { type: String, enum: ['PENDING', 'SENT', 'FAILED'], default: 'PENDING' },
    sentAt: { type: Date },
    error: { type: String, maxlength: 500 },
  },
  { _id: false },
);

const notificationSchema = new Schema<NotificationAttrs>(
  {
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: Object.values(NotificationType), required: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    body: { type: String, required: true, trim: true, maxlength: 600 },
    appointment: { type: Schema.Types.ObjectId, ref: 'Appointment' },
    readAt: { type: Date },
    channels: {
      type: [String],
      enum: Object.values(NotificationChannel),
      default: [NotificationChannel.IN_APP],
    },
    deliveries: { type: [deliverySchema], default: [] },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => omitInternal(ret),
    },
  },
);

// Inbox query: a recipient's notifications newest-first, unread first.
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, readAt: 1 });

export const Notification = model<NotificationAttrs>('Notification', notificationSchema);
