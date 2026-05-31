import { motion } from "framer-motion";

type LogoProps = {
  size?: number;
  className?: string;
};

/**
 * InterviewStack SVG logo — code brackets + stacked layers forming an "IS" monogram.
 * Works on both light and dark backgrounds.
 */
const Logo = ({ size = 32, className = "" }: LogoProps) => (
  <motion.svg
    width={size}
    height={size}
    viewBox="0 0 40 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    whileHover={{ scale: 1.08 }}
    transition={{ type: "spring", stiffness: 400, damping: 20 }}
    aria-label="InterviewStack logo"
    role="img"
  >
    {/* Background rounded square */}
    <rect width="40" height="40" rx="10" fill="#1c1a22" />

    {/* Left bracket < */}
    <motion.path
      d="M10 14 L6 20 L10 26"
      stroke="#ff6a3d"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
    />

    {/* Right bracket > */}
    <motion.path
      d="M30 14 L34 20 L30 26"
      stroke="#ff6a3d"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
    />

    {/* Stack line 1 (top) */}
    <motion.rect
      x="14"
      y="14"
      width="12"
      height="2.5"
      rx="1.25"
      fill="white"
      initial={{ scaleX: 0, opacity: 0 }}
      animate={{ scaleX: 1, opacity: 1 }}
      transition={{ duration: 0.4, delay: 0.35 }}
    />

    {/* Stack line 2 (middle) */}
    <motion.rect
      x="14"
      y="18.75"
      width="9"
      height="2.5"
      rx="1.25"
      fill="white"
      opacity="0.7"
      initial={{ scaleX: 0, opacity: 0 }}
      animate={{ scaleX: 1, opacity: 0.7 }}
      transition={{ duration: 0.4, delay: 0.45 }}
    />

    {/* Stack line 3 (bottom) */}
    <motion.rect
      x="14"
      y="23.5"
      width="6"
      height="2.5"
      rx="1.25"
      fill="white"
      opacity="0.4"
      initial={{ scaleX: 0, opacity: 0 }}
      animate={{ scaleX: 1, opacity: 0.4 }}
      transition={{ duration: 0.4, delay: 0.55 }}
    />
  </motion.svg>
);

export default Logo;
