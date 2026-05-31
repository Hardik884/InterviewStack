import { motion } from "framer-motion";
import type { ReactNode } from "react";

const pageVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

const pageTransition = {
  duration: 0.22,
  ease: [0.25, 0.1, 0.25, 1.0] as [number, number, number, number],
};

type PageTransitionProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Wraps a page with a subtle fade+slide entrance animation.
 * Keep this lightweight – it should feel instant, not dramatic.
 */
const PageTransition = ({ children, className }: PageTransitionProps) => (
  <motion.div
    variants={pageVariants}
    initial="hidden"
    animate="visible"
    exit="exit"
    transition={pageTransition}
    className={className}
  >
    {children}
  </motion.div>
);

export default PageTransition;
