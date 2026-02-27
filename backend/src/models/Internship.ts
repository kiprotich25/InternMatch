import mongoose, { Schema, Document } from 'mongoose';

export interface IInternship extends Document {
  title: string;
  company: string;
  location: string;
  source: string;
  externalId?: string;
  description: string;
  skillsRequired: string[];
  seniority: 'intern' | 'junior';
  isRemote: boolean;
  applyUrl: string;
  postedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const InternshipSchema = new Schema<IInternship>(
  {
    title: { type: String, required: true },
    company: { type: String, required: true },
    location: { type: String, required: true },
    source: { type: String, required: true },
    externalId: { type: String },
    description: { type: String, required: true },
    skillsRequired: [{ type: String }],
    seniority: { type: String, enum: ['intern', 'junior'], default: 'intern' },
    isRemote: { type: Boolean, default: false },
    applyUrl: { type: String, required: true },
    postedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

InternshipSchema.index({ title: 'text', company: 'text', description: 'text' });

export default mongoose.model<IInternship>('Internship', InternshipSchema);

