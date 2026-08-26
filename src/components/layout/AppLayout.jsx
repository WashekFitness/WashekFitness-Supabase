```jsx
import { Outlet, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import Footer from '@/components/layout/Footer';
import BrandLogo from '@/components/BrandLogo';

export default function AppLayout() {
  const location = useLocation();

  // The Kael experience uses its own dedicated layout and should not
  // receive the standard site footer.
  const isKael = location.pathname.startsWith('/kael');

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="shrink-0">
        <div className="container mx-auto flex h-16 items-center px-4">
          <BrandLogo />
        </div>
      </header>

      <main className={cn('flex-1', isKael && 'min-h-0')}>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="h-full"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      {!isKael && <Footer />}
    </div>
  );
}
```
