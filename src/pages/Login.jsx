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
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (loading) return;

    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanFirstName = firstName.trim();
      const cleanLastName = lastName.trim();

      if (!cleanEmail) {
        throw new Error('Please enter your email address.');
      }

      if (!password) {
        throw new Error('Please enter a password.');
      }

      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters.');
      }

      /*
       * ============================
       * CREATE ACCOUNT
       * ============================
       */
      if (mode === 'signup') {
        if (!cleanFirstName) {
          throw new Error('Please enter your first name.');
        }

        const fullName = [
          cleanFirstName,
          cleanLastName,
        ]
          .filter(Boolean)
          .join(' ');

        const {
          data,
          error,
        } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              first_name: cleanFirstName,
              last_name: cleanLastName,
              full_name: fullName,
            },
          },
        });

        if (error) {
          throw error;
        }

        if (!data?.user) {
          throw new Error(
            'Supabase did not return a user.'
          );
        }

        /*
         * Email confirmation MUST be disabled in Supabase
         * for the signup flow you want.
         */
        if (!data.session) {
          throw new Error(
            'Account was created, but Supabase did not create a session. Make sure "Confirm email" is OFF in Authentication → Providers → Email.'
          );
        }

        toast.success('Account created.');

        /*
         * The database trigger creates the profile
         * automatically.
         *
         * The user is already signed in here.
         */
        navigate('/onboarding', {
          replace: true,
        });

        return;
      }

      /*
       * ============================
       * SIGN IN
       * ============================
       */

      const {
        data,
        error,
      } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        throw error;
      }

      if (!data?.session || !data?.user) {
        throw new Error(
          'Supabase did not return an active session.'
        );
      }

      toast.success('Welcome back.');

      /*
       * Check whether onboarding has already
       * been completed.
       */
      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from('profiles')
        .select('onboarded')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      if (!profile || !profile.onboarded) {
        navigate('/onboarding', {
          replace: true,
        });
      } else {
        navigate('/', {
          replace: true,
        });
      }
    } catch (error) {
      console.error(
        '[AUTH] Authentication error:',
        error
      );

      toast.error(
        error?.message ||
          'Authentication failed.'
      );
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode((current) =>
      current === 'login'
        ? 'signup'
        : 'login'
    );

    setPassword('');
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
          onSubmit={handleSubmit}
          className="space-y-4 bg-card border border-border rounded-3xl p-6"
        >

          {mode === 'signup' && (
            <>
              <Input
                type="text"
                placeholder="First name"
                value={firstName}
                onChange={(event) =>
                  setFirstName(event.target.value)
                }
                autoComplete="given-name"
                required
              />

              <Input
                type="text"
                placeholder="Last name"
                value={lastName}
                onChange={(event) =>
                  setLastName(event.target.value)
                }
                autoComplete="family-name"
              />
            </>
          )}

          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) =>
              setEmail(event.target.value)
            }
            autoComplete="email"
            required
          />

          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
            autoComplete={
              mode === 'signup'
                ? 'new-password'
                : 'current-password'
            }
            minLength={6}
            required
          />

          <Button
            type="submit"
            className="w-full h-12"
            disabled={loading}
          >
            {loading
              ? 'Please wait…'
              : mode === 'login'
                ? 'Sign In'
                : 'Create Account'}
          </Button>

          <button
            type="button"
            className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
            onClick={switchMode}
            disabled={loading}
          >
            {mode === 'login'
              ? 'Need an account? Create one'
              : 'Already have an account? Sign in'}
          </button>

        </form>
      </div>
    </div>
  );
}
