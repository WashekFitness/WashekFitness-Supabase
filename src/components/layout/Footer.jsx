```jsx
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

        <nav className="flex items-center gap-2">
          <Link
            to="/about"
            className="inline-flex items-center justify-center min-h-10 px-4 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            About
          </Link>

          <Link
            to="/contact"
            className="inline-flex items-center justify-center min-h-10 px-4 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            Contact
          </Link>
        </nav>
      </div>
    </footer>
  );
}
```
