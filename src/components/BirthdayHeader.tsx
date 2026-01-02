import { motion } from 'framer-motion';

interface BirthdayHeaderProps {
  title: string;
  subtitle: string;
}

export function BirthdayHeader({ title, subtitle }: BirthdayHeaderProps) {
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
        <span className="text-gold">{title}</span>
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
