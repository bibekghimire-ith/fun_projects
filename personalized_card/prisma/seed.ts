import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import { nanoid } from 'nanoid';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clean up
  await prisma.auditLog.deleteMany();
  await prisma.response.deleteMany();
  await prisma.experienceAccess.deleteMany();
  await prisma.contentBlock.deleteMany();
  await prisma.experienceSection.deleteMany();
  await prisma.openWhenMessage.deleteMany();
  await prisma.futureLetter.deleteMany();
  await prisma.finalSurprise.deleteMany();
  await prisma.memory.deleteMany();
  await prisma.media.deleteMany();
  await prisma.experience.deleteMany();
  await prisma.theme.deleteMany();
  await prisma.user.deleteMany();

  // ─── Themes ─────────────────────────────────────────────────────────────────

  const themes = await Promise.all([
    prisma.theme.create({
      data: {
        name: 'Midnight',
        slug: 'midnight',
        isBuiltIn: true,
        primaryColor: '#c084fc',
        secondaryColor: '#a855f7',
        backgroundColor: '#09090b',
        surfaceColor: '#18181b',
        textColor: '#fafafa',
        fontFamily: "'Inter', 'system-ui', sans-serif",
        borderRadius: '1rem',
        animationLevel: 'NORMAL',
      },
    }),
    prisma.theme.create({
      data: {
        name: 'Paper Love',
        slug: 'paper-love',
        isBuiltIn: true,
        primaryColor: '#8b5e3c',
        secondaryColor: '#a47551',
        backgroundColor: '#fdf6e3',
        surfaceColor: '#fef9ef',
        textColor: '#2c1810',
        fontFamily: "'Lora', 'Georgia', serif",
        borderRadius: '0.5rem',
        animationLevel: 'MINIMAL',
      },
    }),
    prisma.theme.create({
      data: {
        name: 'Minimal',
        slug: 'minimal',
        isBuiltIn: true,
        primaryColor: '#1a1a1a',
        secondaryColor: '#444444',
        backgroundColor: '#fafafa',
        surfaceColor: '#ffffff',
        textColor: '#111111',
        fontFamily: "'Inter', 'system-ui', sans-serif",
        borderRadius: '0.25rem',
        animationLevel: 'MINIMAL',
      },
    }),
    prisma.theme.create({
      data: {
        name: 'Sunset',
        slug: 'sunset',
        isBuiltIn: true,
        primaryColor: '#e85d04',
        secondaryColor: '#f48c06',
        backgroundColor: '#fff8f0',
        surfaceColor: '#fff1e0',
        textColor: '#1a0a00',
        fontFamily: "'Outfit', 'system-ui', sans-serif",
        borderRadius: '0.75rem',
        animationLevel: 'NORMAL',
      },
    }),
    prisma.theme.create({
      data: {
        name: 'Memory',
        slug: 'memory',
        isBuiltIn: true,
        primaryColor: '#5c7a6c',
        secondaryColor: '#7a9e8e',
        backgroundColor: '#f5f0eb',
        surfaceColor: '#faf7f4',
        textColor: '#1e2d27',
        fontFamily: "'Lora', 'Georgia', serif",
        borderRadius: '0.75rem',
        animationLevel: 'NORMAL',
      },
    }),
  ]);

  console.log(`✅ Created ${themes.length} themes`);

  // ─── Creator User ────────────────────────────────────────────────────────────

  const passwordHash = await argon2.hash('Password123!', { type: argon2.argon2id });
  const creator = await prisma.user.create({
    data: {
      email: 'creator@example.com',
      name: 'Demo Creator',
      passwordHash,
    },
  });

  console.log(`✅ Created user: ${creator.email}`);

  // ─── Sample Experience: Alex's Birthday ──────────────────────────────────────

  const midnightTheme = themes.find((t) => t.slug === 'midnight')!;

  const experience = await prisma.experience.create({
    data: {
      userId: creator.id,
      title: 'A Little Something For You',
      recipientName: 'Alex',
      eventType: 'BIRTHDAY',
      eventDate: new Date('2026-08-25'),
      openingMessage:
        "I could have just sent a message...\nbut where's the fun in that?\n\nTake a few minutes. There's no rush. ❤️",
      closingMessage:
        "That's everything.\n\nExcept...\n\nthere will always be more memories to make.\n\n❤️",
      status: 'PUBLISHED',
      publicToken: nanoid(32),
      themeId: midnightTheme.id,
    },
  });

  // Sections
  const s1 = await prisma.experienceSection.create({
    data: {
      experienceId: experience.id,
      title: 'How It Started',
      order: 0,
    },
  });

  const s2 = await prisma.experienceSection.create({
    data: {
      experienceId: experience.id,
      title: 'Things I Remember',
      order: 1,
    },
  });

  const s3 = await prisma.experienceSection.create({
    data: {
      experienceId: experience.id,
      title: 'My Favorite Moments',
      order: 2,
    },
  });

  const s4 = await prisma.experienceSection.create({
    data: {
      experienceId: experience.id,
      title: 'What You Mean To Me',
      order: 3,
    },
  });

  // Blocks in s1
  await prisma.contentBlock.create({
    data: {
      sectionId: s1.id,
      type: 'HEADING',
      order: 0,
      content: { text: 'Chapter 01', level: 2 },
    },
  });
  await prisma.contentBlock.create({
    data: {
      sectionId: s1.id,
      type: 'TEXT',
      order: 1,
      content: {
        text: "I remember the exact moment I realized you were going to be important to me. It wasn't dramatic. You were just being yourself — and somehow that was enough.",
      },
    },
  });

  // Blocks in s2
  await prisma.contentBlock.create({
    data: {
      sectionId: s2.id,
      type: 'HEADING',
      order: 0,
      content: { text: 'Chapter 02', level: 2 },
    },
  });
  await prisma.contentBlock.create({
    data: {
      sectionId: s2.id,
      type: 'QUOTE',
      order: 1,
      content: {
        text: 'The best memories are the ones that surprise you — the ones you never planned for.',
        author: null,
      },
    },
  });

  // Blocks in s3
  await prisma.contentBlock.create({
    data: {
      sectionId: s3.id,
      type: 'HEADING',
      order: 0,
      content: { text: 'Chapter 03', level: 2 },
    },
  });
  await prisma.contentBlock.create({
    data: {
      sectionId: s3.id,
      type: 'TEXT',
      order: 1,
      content: {
        text: 'Some moments deserve to be revisited. Not because they were perfect — but because they were ours.',
      },
    },
  });

  // Blocks in s4
  await prisma.contentBlock.create({
    data: {
      sectionId: s4.id,
      type: 'HEADING',
      order: 0,
      content: { text: 'Chapter 04', level: 2 },
    },
  });
  await prisma.contentBlock.create({
    data: {
      sectionId: s4.id,
      type: 'TEXT',
      order: 1,
      content: {
        text: "You make ordinary days feel special. And I don't say that enough. So I made this instead.",
      },
    },
  });

  // Memories
  const memories = [
    { date: '2024-03-15', title: 'First Conversation', description: 'The day everything started.', order: 0 },
    { date: '2024-06-22', title: 'First Meeting', description: 'I was nervous. You made it easy.', order: 1 },
    { date: '2024-09-10', title: 'First Photo Together', description: 'You laughed right before this was taken.', order: 2 },
    { date: '2025-01-05', title: 'Our First Trip', description: 'The trip that turned into a story worth telling.', order: 3 },
    { date: '2025-08-25', title: 'Last Birthday', description: 'One year ago, and already a favorite memory.', order: 4 },
    { date: '2026-08-25', title: 'Today ❤️', description: 'Another year. Another reason to celebrate you.', order: 5 },
  ];

  await Promise.all(
    memories.map((m) =>
      prisma.memory.create({
        data: { ...m, date: new Date(m.date), experienceId: experience.id },
      }),
    ),
  );

  // Open When messages
  const openWhenMessages = [
    { label: 'You miss me', emoji: '❤️', content: "Close your eyes. Remember the last time we laughed until it hurt. That version of us? Still here.", order: 0, unlockType: 'IMMEDIATE' as const },
    { label: 'You need to laugh', emoji: '😂', content: "Remember when I completely mispronounced that word and you would not let me forget it for three weeks? Yeah. That.", order: 1, unlockType: 'IMMEDIATE' as const },
    { label: "You're having a bad day", emoji: '🥺', content: "Hey. It is okay for today to be hard. You do not have to be okay all the time. I am here when you need me.", order: 2, unlockType: 'IMMEDIATE' as const },
    { label: "You can't sleep", emoji: '😴', content: "If you are reading this at 2am, put your phone down after this. Breathe. You are doing better than you think. Good night. ❤️", order: 3, unlockType: 'IMMEDIATE' as const },
    { label: 'You need motivation', emoji: '🎉', content: "You have done hard things before. This is just another one of them. And you will get through this too.", order: 4, unlockType: 'IMMEDIATE' as const },
    { label: 'You need a reminder of us', emoji: '✨', content: "We have been through a lot. And every single time, we figured it out. That is who we are.", order: 5, unlockType: 'IMMEDIATE' as const },
  ];

  await Promise.all(
    openWhenMessages.map((msg) =>
      prisma.openWhenMessage.create({
        data: { ...msg, experienceId: experience.id },
      }),
    ),
  );

  // Future letter (unlocks 1 year from now)
  const nextYear = new Date();
  nextYear.setFullYear(nextYear.getFullYear() + 1);

  await prisma.futureLetter.create({
    data: {
      experienceId: experience.id,
      title: 'Read This Next Year',
      content:
        "If you are reading this, a whole year has passed.\n\nI hope it was full of good moments. I hope there were more good days than hard ones.\n\nAnd I hope, wherever we are — we are still doing this together.\n\nHappy future birthday, Alex.\n\n❤️",
      unlockDate: nextYear,
    },
  });

  // Final surprise
  await prisma.finalSurprise.create({
    data: {
      experienceId: experience.id,
      question: 'Ready for another adventure?',
      buttonText: 'Reveal',
      successMessage: "I thought so. ❤️\n\nHappy birthday, Alex.\n\nHere's to everything still ahead.",
      responseType: 'YES_NO',
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: creator.id,
      experienceId: experience.id,
      action: 'EXPERIENCE_CREATED',
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: creator.id,
      experienceId: experience.id,
      action: 'EXPERIENCE_PUBLISHED',
    },
  });

  console.log(`✅ Created sample experience: "${experience.title}" for ${experience.recipientName}`);
  console.log(`🔗 Public token: ${experience.publicToken}`);
  console.log(`👤 Login: creator@example.com / Password123!`);
  console.log('🌱 Seed complete!');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
