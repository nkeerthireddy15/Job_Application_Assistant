import mongoose from "mongoose";

const profileSchema = new mongoose.Schema({
  singletonKey: { type: String, default: "default", unique: true },
  firstName: { type: String, default: "" },
  lastName: { type: String, default: "" },
  email: { type: String, default: "" },
  phone: { type: String, default: "" },
  city: { type: String, default: "" },
  currentTitle: { type: String, default: "MERN Stack Developer" },
  yearsExperience: { type: Number, default: 3 },
  skills: { type: [String], default: ["React", "Node.js", "MongoDB", "Express", "Next.js", "JavaScript", "React Native"] },
  targetRoles: { type: [String], default: ["MERN Stack Developer", "Full Stack Developer", "React Developer", "Node.js Developer"] },
  preferredLocations: { type: [String], default: ["Remote", "Bengaluru", "Hyderabad", "Goa", "Pune"] },
  excludedKeywords: { type: [String], default: ["intern", "principal", "staff engineer"] },
  currentCTC: { type: String, default: "7.9 LPA" },
  expectedCTC: { type: String, default: "" },
  noticePeriod: { type: String, default: "90 days" },
  linkedin: { type: String, default: "" },
  github: { type: String, default: "" },
  portfolio: { type: String, default: "" },
  sponsorshipAnswer: { type: String, default: "No" },
  about: { type: String, default: "" },
  customAnswers: { type: Map, of: String, default: {} }
}, { timestamps: true });

export default mongoose.model("Profile", profileSchema);
