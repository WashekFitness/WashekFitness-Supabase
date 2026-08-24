import { Link } from 'react-router-dom';
import { Zap } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="mt-8 pb-4 border-t border-border pt-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-primary/15 flex items-center justify-center">
            <Zap className="w-3 h-3 text-primary" />
          </div>
          <span className="font-heading font-semibold text-xs text-muted-foreground">
            Washek Fitness
          </span>
        </div>
        <nav className="flex items-center gap-5">
          <Link to="/about" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            About
          </Link>
          <Link to="/contact" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Contact
          </Link>
        </nav>
      </div>
    </footer>
  );
}