import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const RiotAccountSchema = new mongoose.Schema({
  riotId: { type: String, required: true },
  tagLine: { type: String, required: true },
  puuid: { type: String, required: true, unique: true },
  region: { type: String, required: true },
  verified: { type: Boolean, default: false }
}, { timestamps: true });

const UserSchema = new mongoose.Schema({
  username: { 
    type: String, 
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20
  },
  email: { 
    type: String, 
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: { 
    type: String, 
    required: true,
    select: false
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  linkedAccounts: [RiotAccountSchema],
  refreshToken: { type: String, select: false }
}, { timestamps: true });

// Hash da senha antes de salvar
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Método para comparar senhas
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model('User', UserSchema);