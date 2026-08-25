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

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setFirstName('');
    setLastName('');
  };

  const handleSignup = async () => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();

    if (!cleanFirstName) {
      throw new Error('Please enter your first name.');
    }

    if (!cleanEmail) {
      throw new Error('Please enter your email address.');
    }

    if (password.length < 6) {
      throw new Error(
        'Your password must be at least 6 characters.'
      );
    }

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
          full_name: [cleanFirstName, cleanLastName]
            .filter(Boolean)
            .join(' '),
        },
      },
    });

    if (error) {
      throw error;
    }

    if (!data?.user) {
      throw new Error(
        'Supabase did not return a user after signup.'
      );
    }

    /*
     * If email confirmation is disabled, Supabase gives us
     * a session immediately.
     *
     * If email confirmation is enabled, session will be null
     * until the user confirms their email.
     */
    if (data.session) {
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(
          {
            id: data.user.id,
            first_name: cleanFirstName,
            last_name: cleanLastName,
            full_name: [cleanFirstName, cleanLastName]
              .filter(Boolean)
              .join(' '),
            role: 'user',
            onboarded: false,
          },
          {
            onConflict: 'id',
          }
        );

      if (profileError) {
        throw profileError;
      }

      toast.success(
        'Account created successfully.'
      );

      resetForm();

      navigate('/onboarding', {
        replace: true,
      });

      return;
    }

    /*
     * No session means email confirmation is probably enabled.
     */
    toast.success(
      'Account created. Check your email to confirm your account.'
    );

    setMode('login');
    setPassword('');
  };

  const handleLogin = async () => {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      throw new Error(
        'Please enter your email address.'
      );
    }

    if (!password) {
      throw new Error(
        'Please enter your password.'
      );
    }

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
        'Login succeeded but no active session was returned.'
      );
    }

    /*
     * Make sure the profile exists.
     *
     * This also protects accounts that were created
     * before the new signup flow was installed.
     */
    const { data: existingProfile, error: profileReadError } =
      await supabase
        .from('profiles')
        .select('id, onboarded')
        .eq('id', data.user.id)
        .maybeSingle();

    if (profileReadError) {
      throw profileReadError;
    }

    if (!existingProfile) {
      const metadata = data.user.user_metadata || {};

      const fallbackFirstName =
        metadata.first_name || '';

      const fallbackLastName =
        metadata.last_name || '';

      const { error: profileCreateError } =
        await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            first_name: fallbackFirstName,
            last_name: fallbackLastName,
            full_name:
              metadata.full_name ||
              [fallbackFirstName, fallbackLastName]
                .filter(Boolean)
                .join(' '),
            role: 'user',
            onboarded: false,
          });

      if (profileCreateError) {
        throw profileCreateError;
      }

      toast.success('Welcome to Washek Fitness.');

      navigate('/onboarding', {
        replace: true,
      });

      return;
    }

    toast.success('Welcome back.');

    if (existingProfile.onboarded) {
      navigate('/', {
        replace: true,
      });
    } else {
      navigate('/onboarding', {
        replace: true,
      });
    }
  };

  const submit = async (event) => {
    event.preventDefault();

    if (loading) {
      return;
    }

    setLoading(true);

    try {
      if (mode === 'signup') {
        await handleSignup();
      } else {
        await handleLogin();
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

  const toggleMode = () => {
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
          onSubmit={submit}
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
            autoComplete={
              mode === 'signup'
                ? 'email'
                : 'username'
            }
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
            onClick={toggleMode}
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
