import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="mt-8 pb-4 border-t border-border pt-6">
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

        <nav className="flex items-center gap-5">
          <Link
            to="/about"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            About
          </Link>

          <Link
            to="/contact"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Contact
          </Link>
        </nav>
      </div>
    </footer>
  );
}
