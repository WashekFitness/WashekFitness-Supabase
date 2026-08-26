
import { Link } from 'react-router-dom';

function Footer() {
  return (
    <footer className="mt-8 w-full border-t border-border pt-6 pb-4">
      <div className="flex w-full flex-col items-center justify-between gap-4 px-4 sm:flex-row">
        <div className="flex items-center gap-2">
          <img
            src="/washek-fitness-logo.jpg"
            alt="Washek Fitness"
            className="h-6 w-6 rounded-lg object-contain"
          />

          <span className="font-heading text-xs font-semibold text-muted-foreground">
            Washek Fitness
          </span>
        </div>

        <nav
          aria-label="Footer navigation"
          className="flex items-center gap-2"
        >
          <Link
            to="/about"
            className="inline-flex min-h-10 min-w-20 items-center justify-center rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            About
          </Link>

          <Link
            to="/contact"
            className="inline-flex min-h-10 min-w-20 items-center justify-center rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            Contact
          </Link>
        </nav>
      </div>
    </footer>
  );
}

export default Footer;
