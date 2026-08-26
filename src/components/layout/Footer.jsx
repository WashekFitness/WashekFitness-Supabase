
import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="mt-8 border-t border-border pt-6 pb-4">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <img
            src="/washek-fitness-logo.jpg"
            alt="Washek Fitness"
            className="w-6 h-6 rounded-lg object-contain"
          />

          <span className="font-heading font-semibold text-xs text-muted-foreground">
            Washek Fitness
          </span>
        </div>

        <nav
          aria-label="Footer navigation"
          className="flex items-center gap-2"
        >
          <Link
            to="/about"
            className="inline-flex min-h-10 items-center justify-center rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            About
          </Link>

          <Link
            to="/contact"
            className="inline-flex min-h-10 items-center justify-center rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            Contact
          </Link>
        </nav>
      </div>
    </footer>
  );
}
