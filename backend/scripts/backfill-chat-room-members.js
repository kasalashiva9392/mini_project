/**
 * Run once after adding ChatRoomMember: links existing mentorship rooms to members.
 * Usage: node scripts/backfill-chat-room-members.js
 */
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const rooms = await prisma.chatRoom.findMany({
    where: { studentId: { not: null }, mentorId: { not: null } },
  });
  let n = 0;
  for (const r of rooms) {
    const rows = await prisma.chatRoomMember.createMany({
      data: [
        { roomId: r.id, userId: r.studentId },
        { roomId: r.id, userId: r.mentorId },
      ],
      skipDuplicates: true,
    });
    n += rows.count;
  }
  console.log(`Backfill done. Member rows inserted (skipped duplicates): ${n}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
