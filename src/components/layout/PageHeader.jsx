import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ROOT_PAGES = ['/', '/program', '/nutrition', '/profile', '/kael'];

export default function PageHeader({ title, subtitle }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isRoot = ROOT_PAGES.includes(location.pathname);

  return (
    <div className="flex items-center gap-3 mb-2 pt-2">
      {isRoot ? (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <Zap className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="font-heading font-bold text-sm text-primary">Washek Fitness</span>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 -ml-2"
          onClick={() => navigate(-1)}
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
      )}
      {title && (
        <div className="flex-1">
          <h1 className="font-heading text-2xl font-bold leading-tight">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      )}
    </div>
  );
}