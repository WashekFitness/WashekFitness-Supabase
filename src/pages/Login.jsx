import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function Login() {
  const navigate = useNavigate();

  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              first_name: firstName.trim(),
            },
          },
        });

        if (error) throw error;

        toast.success(
          'Account created. Check your email if confirmation is enabled.'
        );

        navigate('/');
      } else {
        const { error } =
          await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });

        if (error) throw error;

        navigate('/');
      }
    } catch (error) {
      toast.error(
        error?.message || 'Authentication failed.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8">
          <img
            src="/washek-fitness-logo.jpg"
            alt="Washek Fitness"
            className="w-24 h-24 rounded-3xl object-contain mx-auto mb-5"
          />

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
            <Input
              placeholder="First name"
              value={firstName}
              onChange={(e) =>
                setFirstName(e.target.value)
              }
              required
            />
          )}

          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
            required
          />

          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) =>
              setPassword(e.target.value)
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
            className="w-full text-sm text-muted-foreground hover:text-foreground"
            onClick={() =>
              setMode(
                mode === 'login'
                  ? 'signup'
                  : 'login'
              )
            }
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
