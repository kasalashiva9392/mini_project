const bcrypt = require("bcryptjs");
const { PrismaClient, Role, PostType, EventOrganizerType } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await prisma.message.deleteMany();
  await prisma.chatRoom.deleteMany();
  await prisma.mentorshipRequest.deleteMany();
  await prisma.postLike.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.post.deleteMany();
  await prisma.eventRegistration.deleteMany();
  await prisma.event.deleteMany();
  await prisma.user.deleteMany();

  const password = await bcrypt.hash("Password@123", 10);

  const admin = await prisma.user.create({
    data: {
      name: "Admin User",
      username: "admin",
      email: "admin@college.edu",
      password,
      role: Role.ADMIN,
      department: "Administration",
      skills: "operations,management",
    },
  });

  const faculty = await prisma.user.create({
    data: {
      name: "Dr. Priya Faculty",
      username: "dr_priya",
      email: "faculty@college.edu",
      password,
      role: Role.FACULTY,
      department: "CSE",
      skills: "ai,ml,mentoring,academics",
      mentorshipAvailable: true,
    },
  });

  const alumni = await prisma.user.create({
    data: {
      name: "Rahul Alumni",
      username: "rahul_alumni",
      email: "alumni@college.edu",
      password,
      role: Role.ALUMNI,
      department: "CSE",
      batch: 2021,
      company: "TechNova",
      domain: "Backend Engineering",
      skills: "nodejs,express,system design,postgresql",
      isVerifiedAlumni: true,
      mentorshipAvailable: true,
    },
  });

  const student = await prisma.user.create({
    data: {
      name: "Anu Student",
      username: "anu_student",
      email: "student@college.edu",
      password,
      role: Role.STUDENT,
      department: "CSE",
      year: 3,
      batch: 2027,
      skills: "javascript,react,sql",
      bio: "Interested in backend and product engineering.",
    },
  });

  await prisma.user.create({
    data: {
      name: "Mukku",
      username: "mukku",
      email: "mukku@mgit.ac.in",
      password,
      role: Role.STUDENT,
      department: "CSE",
      year: 2,
      batch: 2028,
      skills: "testing,chat",
      bio: "Test student for messaging.",
    },
  });

  await prisma.post.createMany({
    data: [
      {
        authorId: alumni.id,
        type: PostType.JOB,
        title: "Backend Intern Opening",
        content: "Looking for interns with Node.js and SQL basics.",
      },
      {
        authorId: faculty.id,
        type: PostType.ACADEMIC,
        title: "ML Workshop Week",
        content: "Hands-on workshop on model deployment next week.",
      },
      {
        authorId: student.id,
        type: PostType.QUERY,
        title: "How to prepare for SDE internships?",
        content: "Need roadmap for DSA + projects + resume.",
      },
    ],
  });

  const event = await prisma.event.create({
    data: {
      title: "Career Accelerator Bootcamp",
      description: "Resume review + mock interviews + alumni networking",
      organizerType: EventOrganizerType.DEPARTMENT,
      organizerName: "CSE Department",
      eventDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      location: "Main Seminar Hall",
      createdById: faculty.id,
    },
  });

  await prisma.eventRegistration.create({
    data: {
      eventId: event.id,
      studentId: student.id,
    },
  });

  await prisma.mentorshipRequest.create({
    data: {
      studentId: student.id,
      mentorId: alumni.id,
      message: "Need guidance for backend role preparation.",
    },
  });

  console.log("Seed complete.");
    console.log({
    admin: "admin@college.edu / Password@123",
    faculty: "faculty@college.edu / Password@123",
    alumni: "alumni@college.edu / Password@123",
    student: "student@college.edu / Password@123",
    mukku: "mukku@mgit.ac.in or username mukku / Password@123",
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
