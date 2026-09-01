import { PrismaClient, Prisma } from '@prisma/client';
import argon2 from 'argon2';
import { nanoid } from 'nanoid';
import { getTemplate } from '@letter/templates';
import { parseBlockContent } from '@letter/validation';
import {
  dateFromDaysAhead,
  memoryDate,
  openWhenUnlockDate,
  resolveCountdownContent,
} from '../apps/api/src/services/template.helpers';
import { mergeCopyOverrides, mergeFeatureOverrides } from '../apps/api/src/services/config.helpers';

const prisma = new PrismaClient();

/**
 * Build a second experience straight from one of the packaged templates,
 * the same way a creator would from the "Start a new one" gallery — sections,
 * blocks, memories, open-when notes, the future letter, the final surprise
 * and the config's microcopy/feature overrides, all stamped from the
 * template's JSON via the very same pure helpers TemplateService uses
 * (apps/api/src/services/template.helpers.ts + config.helpers.ts). Left as a
 * DRAFT: a template applied but not yet finished is the more common state.
 */
async function seedTemplateExperience(userId: string) {
  const slug = 'anniversary-timeline';
  const template = getTemplate(slug);
  if (!template) {
    console.warn(`⚠️  Template "${slug}" not found — skipping the template-based sample.`);
    return null;
  }

  // Same lookup TemplateService.apply() does: a template naming a theme that
  // was never seeded simply leaves the experience without one.
  const theme = await prisma.theme.findUnique({ where: { slug: template.themeSlug } });

  const now = new Date();
  const eventDate = new Date('2027-06-15');

  const experience = await prisma.experience.create({
    data: {
      userId,
      title: template.defaults.title,
      recipientName: 'Priya',
      eventType: template.eventType,
      eventDate,
      openingMessage: template.defaults.openingMessage ?? null,
      closingMessage: template.defaults.closingMessage ?? null,
      publicToken: nanoid(32),
      templateSlug: template.slug,
      themeId: theme?.id ?? null,
    },
  });

  for (const [sectionOrder, section] of template.sections.entries()) {
    await prisma.experienceSection.create({
      data: {
        experienceId: experience.id,
        title: section.title,
        order: sectionOrder,
        enabled: section.enabled ?? true,
        blocks: {
          create: section.blocks.map((block, blockOrder) => ({
            type: block.type,
            order: blockOrder,
            enabled: block.enabled ?? true,
            content: parseBlockContent(
              block.type,
              block.type === 'COUNTDOWN'
                ? resolveCountdownContent(block.content, eventDate, now)
                : block.content,
            ) as Prisma.InputJsonValue,
          })),
        },
      },
    });
  }

  if (template.memories?.length) {
    await prisma.memory.createMany({
      data: template.memories.map((memory, index) => ({
        experienceId: experience.id,
        date: memoryDate(memory, now),
        title: memory.title,
        description: memory.description ?? null,
        location: memory.location ?? null,
        order: index,
      })),
    });
  }

  if (template.openWhen?.length) {
    await prisma.openWhenMessage.createMany({
      data: template.openWhen.map((note, index) => ({
        experienceId: experience.id,
        label: note.label,
        emoji: note.emoji ?? null,
        content: note.content,
        unlockType: note.unlockType ?? 'IMMEDIATE',
        unlockDate: openWhenUnlockDate(note, now),
        isOneTime: note.isOneTime ?? false,
        order: index,
      })),
    });
  }

  if (template.futureLetter) {
    await prisma.futureLetter.create({
      data: {
        experienceId: experience.id,
        title: template.futureLetter.title,
        content: template.futureLetter.content,
        unlockDate: dateFromDaysAhead(template.futureLetter.unlockInDays, now),
      },
    });
  }

  if (template.finalSurprise) {
    const surprise = template.finalSurprise;
    await prisma.finalSurprise.create({
      data: {
        experienceId: experience.id,
        question: surprise.question,
        buttonText: surprise.buttonText ?? 'Reveal',
        successMessage: surprise.successMessage,
        responseType: surprise.responseType ?? 'YES_NO',
        ctaText: surprise.ctaText ?? null,
        ctaUrl: surprise.ctaUrl ?? null,
        ...(surprise.options ? { options: surprise.options as Prisma.InputJsonValue } : {}),
      },
    });
  }

  if (template.config) {
    await prisma.experienceConfig.create({
      data: {
        experienceId: experience.id,
        ...(template.config.navigationMode ? { navigationMode: template.config.navigationMode } : {}),
        ...(template.config.enableConfetti !== undefined
          ? { enableConfetti: template.config.enableConfetti }
          : {}),
        copy: mergeCopyOverrides(
          undefined,
          template.config.copy as Record<string, string> | undefined,
        ) as Prisma.InputJsonValue,
        features: mergeFeatureOverrides(
          undefined,
          template.config.features as Record<string, boolean> | undefined,
        ) as Prisma.InputJsonValue,
      },
    });
  }

  await prisma.auditLog.create({
    data: { userId, experienceId: experience.id, action: 'EXPERIENCE_CREATED' },
  });
  await prisma.auditLog.create({
    data: {
      userId,
      experienceId: experience.id,
      action: 'TEMPLATE_APPLIED',
      metadata: { slug: template.slug, mode: 'REPLACE' } as Prisma.InputJsonValue,
    },
  });

  return experience;
}

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

  // ─── A custom theme, owned by the creator ────────────────────────────────────
  // Demonstrates the theme system going beyond the five built-ins: a creator can
  // start from scratch (or fork a built-in — see ThemeService.fork) and land on
  // something like this, complete with the newer per-theme fields.

  const customTheme = await prisma.theme.create({
    data: {
      name: 'Golden Hour',
      slug: `golden-hour-${nanoid(6).toLowerCase()}`,
      description: 'A warm custom look Demo Creator put together for Priya.',
      isBuiltIn: false,
      userId: creator.id,
      primaryColor: '#c2410c',
      secondaryColor: '#f59e0b',
      backgroundColor: '#fffaf0',
      surfaceColor: '#fff4e0',
      textColor: '#241206',
      mutedColor: '#8a6a4d',
      borderColor: '#f0dcc0',
      fontFamily: "'Outfit', 'system-ui', sans-serif",
      headingFontFamily: "'Lora', 'Georgia', serif",
      baseFontSize: '17px',
      borderRadius: '1rem',
      backgroundGradient: 'linear-gradient(180deg, #fffaf0 0%, #ffe9c7 100%)',
      animationLevel: 'NORMAL',
      transitionStyle: 'FADE',
    },
  });

  console.log(`✅ Created custom theme: ${customTheme.name}`);

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

  // Customization: a few microcopy overrides and a couple of features turned
  // off, exercising the same sparse-override shape the API's ConfigService
  // stores (see apps/api/src/services/config.helpers.ts — everything not
  // named here still falls back to DEFAULT_COPY / DEFAULT_FEATURES).
  await prisma.experienceConfig.create({
    data: {
      experienceId: experience.id,
      navigationMode: 'SCROLL',
      showProgressBar: true,
      enableConfetti: true,
      musicAutoplay: false,
      musicVolume: 45,
      copy: mergeCopyOverrides(undefined, {
        'welcome.greeting': 'Hey {recipient}, happy birthday.',
        'closing.title': "That's everything — for now.",
      }) as Prisma.InputJsonValue,
      features: mergeFeatureOverrides(undefined, {
        // No music was uploaded for this one, so the player stays hidden
        // rather than showing up with nothing to play.
        music: false,
      }) as Prisma.InputJsonValue,
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

  // ─── Sample Experience: built from a template, still a draft ────────────────
  // Shows the "start from a template" path end to end — the same JSON in
  // packages/templates that /api/templates serves, stamped onto a real
  // experience via the same pure helpers the API applies it with.

  const templateExperience = await seedTemplateExperience(creator.id);
  if (templateExperience) {
    console.log(
      `✅ Created draft from template "anniversary-timeline": "${templateExperience.title}" for ${templateExperience.recipientName}`,
    );
  }

  console.log(`👤 Login: creator@example.com / Password123!`);
  console.log('🌱 Seed complete!');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
