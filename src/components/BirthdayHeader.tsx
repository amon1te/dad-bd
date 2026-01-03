import { motion } from 'framer-motion';

interface BirthdayHeaderProps {
  title: string;
  subtitle: string;
}

export function BirthdayHeader({ title, subtitle }: BirthdayHeaderProps) {
  // If the title ends with emoji(s), render them in native emoji font (so they stay colorful)
  const emojiMatch = title.match(/^(.*?)(\s*[\p{Extended_Pictographic}]+)\s*$/u);
  const titleText = emojiMatch ? emojiMatch[1] : title;
  const titleEmoji = emojiMatch ? emojiMatch[2] : '';

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="text-center py-8 px-4"
    >
      <motion.h1
        className="text-4xl md:text-5xl lg:text-6xl font-display font-bold mb-4"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        <span className="text-gold">
          {titleText}
          {titleEmoji ? (
            <span
              className="inline-block ml-2 align-middle"
              style={{
                color: 'initial',
                fontFamily:
                  '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif',
              }}
            >
              {titleEmoji}
            </span>
          ) : null}
        </span>
      </motion.h1>
      <motion.p
        className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.5 }}
      >
        {subtitle}
      </motion.p>
      <motion.div
        className="mt-6 h-1 w-24 mx-auto rounded-full gold-gradient"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 0.6, duration: 0.5 }}
      />
    </motion.header>
  );
}
