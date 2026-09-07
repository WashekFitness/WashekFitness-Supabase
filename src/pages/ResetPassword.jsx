import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function ResetPassword() {
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    const handleRecovery = async () => {
      const { data } = await supabase.auth.getSession();

      if (mounted && data?.session) {
        setReady(true);
      }
    };

    handleRecovery();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (event === 'PASSWORD_RECOVERY' && session) {
        setReady(true);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const updatePassword = async (e) => {
    e.preventDefault();

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) throw error;

      toast.success('Password updated successfully.');
      await supabase.auth.signOut();
      navigate('/login', { replace: true });
    } catch (error) {
      toast.error(error?.message || 'Unable to update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img
            src="/washek-fitness-logo.jpg"
            alt="Washek Fitness"
            className="w-24 h-24 rounded-3xl object-contain mx-auto mb-5"
          />

          <h1 className="font-heading text-3xl font-bold">
            Reset Password
          </h1>

          <p className="text-muted-foreground mt-2">
            Choose a new password for your Washek Fitness account.
          </p>
        </div>

        <form
          onSubmit={updatePassword}
          className="space-y-4 bg-card border border-border rounded-3xl p-6"
        >
          {!ready && (
            <p className="text-sm text-muted-foreground text-center">
              Verifying your password reset link…
            </p>
          )}

          <Input
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
            disabled={!ready || loading}
          />

          <Input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={6}
            required
            disabled={!ready || loading}
          />

          <Button
            type="submit"
            className="w-full h-12"
            disabled={!ready || loading}
          >
            {loading ? 'Please wait…' : 'Update Password'}
          </Button>

          {!ready && (
            <button
              type="button"
              className="w-full text-sm text-muted-foreground hover:text-foreground"
              onClick={() => navigate('/login')}
            >
              Back to Sign In
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
