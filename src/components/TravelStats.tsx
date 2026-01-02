import { motion } from 'framer-motion';
import { Globe, Route, Compass } from 'lucide-react';

interface TravelStatsProps {
  countriesVisited: number;
  worldPercentage: number;
  mostVisitedContinent: string;
}

export function TravelStats({
  countriesVisited,
  worldPercentage,
  mostVisitedContinent,
}: TravelStatsProps) {
  const stats = [
    {
      icon: Globe,
      value: countriesVisited,
      label: 'Посещённые страны',
      color: 'text-primary',
    },
    {
      icon: Route,
      value: `${worldPercentage}%`,
      label: 'Мир исследован',
      color: 'text-accent',
    },
    {
      icon: Compass,
      value: mostVisitedContinent,
      label: 'Любимый континент',
      color: 'text-primary',
      isText: true,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-3xl mx-auto">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 + index * 0.1, duration: 0.5 }}
          className="stat-card text-center"
        >
          <stat.icon className={`w-8 h-8 mx-auto mb-3 ${stat.color}`} />
          <div className={`text-3xl font-display font-bold ${stat.color} mb-1`}>
            {stat.isText ? stat.value : stat.value}
          </div>
          <div className="text-sm text-muted-foreground">{stat.label}</div>
        </motion.div>
      ))}
    </div>
  );
}
