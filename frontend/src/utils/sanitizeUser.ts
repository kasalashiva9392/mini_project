import type { User } from "../types";

/** Normalizes API / DB user payloads into the frontend `User` shape. */
export function sanitizeUser(data: Record<string, unknown>): User {
  return {
    id: String(data.id),
    username: String(data.username ?? ""),
    name: String(data.name),
    email: String(data.email),
    role: data.role as User["role"],
    department: data.department != null ? String(data.department) : undefined,
    batch: typeof data.batch === "number" ? data.batch : undefined,
    year: typeof data.year === "number" ? data.year : undefined,
    skills: data.skills != null ? String(data.skills) : undefined,
    bio: data.bio != null ? String(data.bio) : undefined,
    age: typeof data.age === "number" ? data.age : undefined,
    gender: data.gender != null ? String(data.gender) : undefined,
    education: data.education != null ? String(data.education) : undefined,
    location: data.location != null ? String(data.location) : undefined,
    currentPosition: data.currentPosition != null ? String(data.currentPosition) : undefined,
    experience: data.experience != null ? String(data.experience) : undefined,
    company: data.company != null ? String(data.company) : undefined,
    domain: data.domain != null ? String(data.domain) : undefined,
    profilePicture: data.profilePicture != null ? String(data.profilePicture) : undefined,
    mentorshipAvailable: typeof data.mentorshipAvailable === "boolean" ? data.mentorshipAvailable : undefined,
    isVerifiedAlumni: typeof data.isVerifiedAlumni === "boolean" ? data.isVerifiedAlumni : undefined,
  };
}
