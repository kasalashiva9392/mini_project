export type Role = "STUDENT" | "ALUMNI" | "FACULTY" | "ADMIN";

export type User = {
  id: string;
  username: string;
  name: string;
  email: string;
  role: Role;
  department?: string;
  batch?: number;
  year?: number;
  skills?: string;
  bio?: string;
  age?: number;
  gender?: string;
  education?: string;
  location?: string;
  currentPosition?: string;
  experience?: string;
  company?: string;
  domain?: string;
  profilePicture?: string;
  isVerifiedAlumni?: boolean;
  mentorshipAvailable?: boolean;
};
