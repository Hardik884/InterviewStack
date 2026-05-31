import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import Button from "../components/ui/Button";
import Logo from "../components/Logo";

const NotFound = () => {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center gap-6 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35 }}
      >
        <Logo size={48} />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="space-y-2"
      >
        <p className="text-6xl font-bold tracking-tight text-ink/10">404</p>
        <h1 className="text-xl font-semibold text-ink">Page not found</h1>
        <p className="text-sm text-ink/50">
          This page doesn't exist or was moved.
        </p>
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <Link to="/">
          <Button variant="primary">← Back to Dashboard</Button>
        </Link>
      </motion.div>
    </div>
  );
};

export default NotFound;
