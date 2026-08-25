import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Zap,
  ArrowLeft,
  Mail,
  Send,
} from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { supabaseApi } from '@/lib/supabaseApi';

const CONTACT_EMAIL = 'washekfitness@gmail.com';

export default function Contact() {
  const { toast } = useToast();

  const [form, setForm] = useState({
    name: '',
    email: '',
    message: '',
  });

  const [submitting, setSubmitting] = useState(false);

  const updateField = (field, value) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const name = form.name.trim();
    const email = form.email.trim();
    const message = form.message.trim();

    if (!name || !email || !message) {
      toast({
        title: 'Please complete the form',
        description:
          'Name, email, and message are required.',
        variant: 'destructive',
      });

      return;
    }

    setSubmitting(true);

    try {
      const result = await supabaseApi.email.send({
        name,
        email,
        message,
      });

      setForm({
        name: '',
        email: '',
        message: '',
      });

      if (result?.queued) {
        toast({
          title: 'Message received',
          description:
            'Your message was saved successfully. Email notifications still need to be configured.',
        });
      } else {
        toast({
          title: 'Message sent',
          description:
            'Thanks for reaching out — Adrian will get back to you soon.',
        });
      }
    } catch (error) {
      console.error(
        '[CONTACT] Failed to send message:',
        error
      );

      toast({
        title: 'Message could not be sent',
        description:
          error?.message ||
          `Please try emailing ${CONTACT_EMAIL} directly.`,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-5 pb-4">
      <div className="mb-6 flex items-center gap-3 pt-2">
        <Link
          to="/"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>

        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15">
            <Zap className="h-4 w-4 text-primary" />
          </div>

          <span className="font-heading text-sm font-bold">
            Washek Fitness
          </span>
        </div>
      </div>

      <h1 className="mb-3 font-heading text-3xl font-bold tracking-tight">
        Contact Us
      </h1>

      <p className="mb-8 text-muted-foreground">
        Questions, feedback, or partnership ideas?
        We'd love to hear from you.
      </p>

      <div className="space-y-6">
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
            <Mail className="h-5 w-5 text-primary" />
          </div>

          <div>
            <p className="text-sm font-semibold">
              Email
            </p>

            <p className="text-xs text-muted-foreground">
              {CONTACT_EMAIL}
            </p>
          </div>
        </a>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border border-border bg-card p-5"
        >
          <h2 className="font-heading text-lg font-semibold">
            Send a Message
          </h2>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Name
              </label>

              <Input
                required
                value={form.name}
                onChange={(event) =>
                  updateField(
                    'name',
                    event.target.value
                  )
                }
                placeholder="Your name"
                disabled={submitting}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Email
              </label>

              <Input
                required
                type="email"
                value={form.email}
                onChange={(event) =>
                  updateField(
                    'email',
                    event.target.value
                  )
                }
                placeholder="you@example.com"
                disabled={submitting}
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Message
            </label>

            <Textarea
              required
              value={form.message}
              onChange={(event) =>
                updateField(
                  'message',
                  event.target.value
                )
              }
              placeholder="How can we help?"
              className="min-h-[120px] resize-none"
              disabled={submitting}
            />
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="h-11 w-full"
          >
            {submitting ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
            ) : (
              <>
                Send Message
                <Send className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
