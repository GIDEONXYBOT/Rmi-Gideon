import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      trim: true,
      default: "",
    },
    // ✅ Unified password field (hashed)
    password: {
      type: String,
      required: true,
    },
    // 🔑 Plain text password for admin reference only
    plainTextPassword: {
      type: String,
      required: false,
      default: "",
    },
    // 🧩 Legacy support
    passwordHash: {
      type: String,
      required: false,
    },
    role: {
      type: String,
      enum: ["super_admin", "admin", "supervisor", "teller", "supervisor_teller", "declarator", "head_watcher", "sub_watcher"],
      default: "teller",
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    // 🔗 Link tellers to supervisors
    supervisorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // 💰 Base salary for payroll calculation
    baseSalary: {
      type: Number,
      default: 0,
    },

    // 💰 Active capital link (for tellerManagement)
    activeCapital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Capital",
      default: null,
    },

    // 📅 Work schedule tracking
    lastWorked: {
      type: String, // yyyy-MM-dd format
      default: null,
    },
    totalWorkDays: {
      type: Number,
      default: 0,
    },
    
    // ⏭️ Penalty: Skip work until this date
    skipUntil: {
      type: String, // yyyy-MM-dd format  
      default: null,
    },
    lastAbsentReason: {
      type: String,
      default: "",
    },

    // 🎨 User-specific theme preferences
    theme: {
      mode: {
        type: String,
        enum: ["light", "dark"],
        default: "light",
      },
      lightFont: {
        type: String,
        default: "#1f2937",
      },
      darkFont: {
        type: String,
        default: "#f9fafb",
      },
      lightBg: {
        type: String,
        default: "#ffffff",
      },
      darkBg: {
        type: String,
        default: "#1e3a8a",
      },
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// 🔐 Password comparison method
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    // First try direct comparison (for plain text stored passwords)
    if (this.password === candidatePassword) {
      return true;
    }
    
    // If that fails, try bcrypt comparison (for hashed passwords)
    const bcrypt = await import('bcrypt');
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    console.error('Password comparison error:', error);
    return false;
  }
};

// 🧠 Auto-migrate legacy users
userSchema.pre("save", function (next) {
  if (!this.password && this.passwordHash) {
    this.password = this.passwordHash;
    this.passwordHash = undefined;
  }
  next();
});

// Ensure 'admin' username is always super_admin
userSchema.pre('save', function(next) {
  if (this.username === 'admin') {
    this.role = 'super_admin';
  }
  next();
});

export default mongoose.models.User || mongoose.model("User", userSchema);
