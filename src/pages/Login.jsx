import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Zap } from 'lucide-react';
import { toast } from 'sonner';

export default function Login() {
  const navigate = useNavigate();

  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [loading, setLoading] = useState(false);

  const isSignup = mode === 'signup';

  const submit = async (e) => {
    e.preventDefault();

    if (loading) return;

    const cleanEmail = email.trim();
    const cleanFirstName = firstName.trim();

    if (!cleanEmail) {
      toast.error('Please enter your email address.');
      return;
    }

    if (!password) {
      toast.error('Please enter your password.');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }

    if (isSignup && !cleanFirstName) {
      toast.error('Please enter your first name.');
      return;
    }

    setLoading(true);

    try {
      if (isSignup) {
        /*
         * CREATE ACCOUNT
         *
         * Supabase will create the account.
         *
         * When "Confirm email" is disabled in Supabase:
         *   data.user   -> newly created user
         *   data.session -> active logged-in session
         *
         * We intentionally check for the session before navigating.
         */
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              first_name: cleanFirstName,
            },
          },
        });

        if (error) {
          throw error;
        }

        /*
         * If there is no session, Supabase is requiring email
         * confirmation. The app should NOT pretend the user
         * has been signed in.
         */
        if (!data?.session) {
          toast.error(
            'The account was created, but Supabase is requiring email confirmation. Turn off "Confirm email" in Supabase Authentication settings.'
          );

          return;
        }

        toast.success('Account created successfully!');

        /*
         * The Supabase session is already stored by the client.
         * AuthContext will detect the session and mark the user
         * as authenticated.
         */
        navigate('/', { replace: true });

        return;
      }

      /*
       * SIGN IN
       */
      const { data, error } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

      if (error) {
        throw error;
      }

      if (!data?.session) {
        throw new Error(
          'Sign in succeeded but no active session was returned.'
        );
      }

      toast.success('Welcome back!');

      navigate('/', { replace: true });
    } catch (error) {
      console.error('[AUTH] Authentication error:', error);

      let message = error?.message || 'Authentication failed.';

      if (
        message.toLowerCase().includes('email not confirmed')
      ) {
        message =
          'Your email has not been confirmed. Turn off "Confirm email" in Supabase if you want users to sign in immediately after creating an account.';
      }

      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    if (loading) return;

    setMode((currentMode) =>
      currentMode === 'login' ? 'signup' : 'login'
    );

    setEmail('');
    setPassword('');
    setFirstName('');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto mb-4">
            <Zap className="w-7 h-7 text-primary" />
          </div>

          <h1 className="font-heading text-3xl font-bold">
            Washek Fitness
          </h1>

          <p className="text-muted-foreground mt-2">
            Your AI-powered training coach.
          </p>
        </div>

        <form
          onSubmit={submit}
          className="space-y-4 bg-card border border-border rounded-3xl p-6"
        >
          {isSignup && (
            <Input
              type="text"
              placeholder="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
              required
              disabled={loading}
            />
          )}

          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            disabled={loading}
          />

          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={
              isSignup ? 'new-password' : 'current-password'
            }
            minLength={6}
            required
            disabled={loading}
          />

          <Button
            type="submit"
            className="w-full h-12"
            disabled={loading}
          >
            {loading
              ? 'Please wait…'
              : isSignup
                ? 'Create Account'
                : 'Sign In'}
          </Button>

          <button
            type="button"
            className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
            onClick={toggleMode}
            disabled={loading}
          >
            {isSignup
              ? 'Already have an account? Sign in'
              : 'Need an account? Create one'}
          </button>
        </form>
      </div>
    </div>
  );
}
