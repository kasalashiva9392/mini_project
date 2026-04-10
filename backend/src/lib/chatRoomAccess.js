const prisma = require("../config/prisma");
const { ChatRoomKind } = require("@prisma/client");

function accessSync(userId, room) {
  if (!room) return false;
  if (room.kind === ChatRoomKind.MENTORSHIP) {
    return room.studentId === userId || room.mentorId === userId;
  }
  return (room.members || []).some((m) => m.userId === userId);
}

async function userCanAccessRoomById(userId, roomId) {
  const room = await prisma.chatRoom.findUnique({
    where: { id: roomId },
    include: { members: true },
  });
  if (!room) return false;
  return accessSync(userId, room);
}

module.exports = { userCanAccessRoomById, ChatRoomKind };
