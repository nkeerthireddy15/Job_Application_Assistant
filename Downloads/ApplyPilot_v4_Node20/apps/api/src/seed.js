import "dotenv/config";
import { connectDB } from "./db.js";
import Profile from "./models/Profile.js";
import Job from "./models/Job.js";
import { scoreJob } from "./services/matcher.js";

await connectDB();
const profile = await Profile.findOneAndUpdate({ singletonKey: "default" }, { $setOnInsert: { singletonKey: "default" } }, { upsert: true, new: true });
const sample = [
  { company:"Demo Labs",title:"MERN Stack Developer",location:"Remote - India",url:"https://example.com/jobs/mern-developer",description:"Looking for 2-4 years experience with React, Node.js, Express and MongoDB.",source:"sample",sourceType:"sample" },
  { company:"Product Studio",title:"Frontend React Developer",location:"Bengaluru",url:"https://example.com/jobs/react-developer",description:"React, JavaScript, Next.js. 2+ years experience.",source:"sample",sourceType:"sample" },
  { company:"Enterprise Co",title:"Staff Backend Engineer",location:"Hyderabad",url:"https://example.com/jobs/staff-backend",description:"8+ years of Node.js backend experience required.",source:"sample",sourceType:"sample" }
];
for(const raw of sample){const match=scoreJob(raw,profile.toObject());await Job.findOneAndUpdate({url:raw.url},{$set:{...raw,localScore:match.score,matchScore:match.score,matchReasons:match.reasons}},{upsert:true});}
console.log("ApplyPilot v2 seed complete");process.exit(0);
