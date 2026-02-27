import mongoose, { Schema, Document } from 'mongoose';

export interface IApplicationHistory {
  internshipId: mongoose.Types.ObjectId;
  status: 'applied' | 'interview' | 'offer' | 'rejected';
  appliedAt: Date;
}

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  name: string;
  course: string;
  skills: string[];
  preferredLocations: string[];
  resumeUrl?: string;
  applicationHistory: IApplicationHistory[];
  createdAt: Date;
  updatedAt: Date;
}

const ApplicationHistorySchema = new Schema<IApplicationHistory>(
  {
    internshipId: { type: Schema.Types.ObjectId, ref: 'Internship', required: true },
    status: {
      type: String,
      enum: ['applied', 'interview', 'offer', 'rejected'],
      default: 'applied',
    },
    appliedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true },
    course: { type: String, required: true },
    skills: [{ type: String }],
    preferredLocations: [{ type: String }],
    resumeUrl: { type: String },
    applicationHistory: [ApplicationHistorySchema],
  },
  { timestamps: true },
);

export default mongoose.model<IUser>('User', UserSchema);

